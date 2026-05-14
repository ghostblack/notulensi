
/**
 * audioCompressor.ts
 * Kompres audio ke WAV 8kHz mono menggunakan Web Audio API (OfflineAudioContext).
 * Kualitas telephone (8kHz) sudah cukup untuk transkripsi bicara.
 * Output: ~0.96MB/menit (vs WAV asli hingga ~10MB/menit)
 */

const TARGET_SAMPLE_RATE = 8000; // 8kHz — telephone quality, ideal untuk speech
export const COMPRESS_THRESHOLD_MB = 20; // Compress jika file > 20MB

export const shouldCompress = (file: File | Blob): boolean => {
  return file.size > COMPRESS_THRESHOLD_MB * 1024 * 1024;
};

export const compressAudio = async (
  file: File | Blob,
  onProgress?: (pct: number) => void
): Promise<Blob> => {
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);
  console.log(`[Compress] Mulai kompresi: ${sizeMB}MB → target 8kHz mono WAV`);

  onProgress?.(5);

  // Baca file sebagai ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(20);

  // Decode audio menggunakan Web Audio API
  const audioContext = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }

  onProgress?.(40);

  const { duration } = audioBuffer;
  const numOutputSamples = Math.ceil(duration * TARGET_SAMPLE_RATE);
  console.log(`[Compress] Durasi: ${(duration / 60).toFixed(1)} menit`);

  // Resample ke 8kHz mono menggunakan OfflineAudioContext (jauh lebih cepat dari real-time)
  const offlineCtx = new OfflineAudioContext(1, numOutputSamples, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  onProgress?.(50);

  const renderedBuffer = await offlineCtx.startRendering();
  onProgress?.(80);

  // Encode ke WAV PCM 16-bit
  const wavBlob = encodePCMToWAV(renderedBuffer);
  const compressedMB = (wavBlob.size / 1024 / 1024).toFixed(1);
  console.log(`[Compress] ✅ Selesai: ${sizeMB}MB → ${compressedMB}MB`);

  onProgress?.(100);
  return wavBlob;
};

/**
 * Encode AudioBuffer ke format WAV PCM 16-bit
 */
const encodePCMToWAV = (buffer: AudioBuffer): Blob => {
  const samples = buffer.getChannelData(0); // channel 0 (sudah mono)
  const numSamples = samples.length;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const dataSize = numSamples * 2;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // WAV Header
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);           // fmt chunk size
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);            // block align
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // float32 → int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
};
