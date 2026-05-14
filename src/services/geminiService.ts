
import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from '@/utils/fileHelpers';
import { MeetingContext } from '@/types';

// === CONFIG ===
const KPU_LOGO_URL = "https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309";

// Model fallback chain — prioritas dari paling capable ke paling stabil
const MODEL_CHAIN = [
  "gemini-3-flash-preview",         // Prioritas utama — Flash 3 terbaru
  "gemini-2.5-flash-preview-05-20", // Cadangan 1
  "gemini-2.5-flash",               // Cadangan 2
  "gemini-2.0-flash",               // Cadangan 3
  "gemini-1.5-flash",               // Cadangan 4 — paling stabil
];

const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5,
].filter(Boolean) as string[];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Rate limiting state
let lastRequestTime = 0;
const MIN_DELAY_MS = 1500;

const waitIfNeeded = async () => {
  const now = Date.now();
  const diff = now - lastRequestTime;
  if (diff < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - diff);
  lastRequestTime = Date.now();
};

// === CORE: callGemini ===
// Strategi: Loop setiap API Key. Tiap key dicoba hingga 3 kali (retry).
// Jika gagal 3x pada key yang sama → pindah ke key berikutnya.
// Error token limit / model error → langsung ganti model, tidak retry.
// parts: array of Part objects ({ text } atau { inlineData: { mimeType, data } })
export const callGemini = async (parts: any[], systemInstruction?: string): Promise<string> => {
  const formattedContents = [{ role: 'user', parts }];

  // Debug ukuran audio jika ada
  const audioParts = parts.filter((p: any) => p.inlineData);
  if (audioParts.length > 0) {
    audioParts.forEach((p: any, idx: number) => {
      const sizeKB = Math.round((p.inlineData.data?.length || 0) * 0.75 / 1024);
      console.log(`[Gemini] 🎵 Audio part ${idx + 1}: mimeType=${p.inlineData.mimeType}, size≈${sizeKB}KB`);
    });
  }

  const allErrors: string[] = [];

  // Loop setiap model — model menjadi outer loop
  for (let mi = 0; mi < MODEL_CHAIN.length; mi++) {
    const modelName = MODEL_CHAIN[mi];

    // Loop setiap API key — tiap key dicoba 3x sebelum pindah
    for (let ki = 0; ki < API_KEYS.length; ki++) {
      const apiKey = API_KEYS[ki];
      const keyLabel = `Key-${ki + 1}`;

      let attempt = 0;
      const MAX_RETRIES_PER_KEY = 3;

      while (attempt < MAX_RETRIES_PER_KEY) {
        attempt++;
        try {
          await waitIfNeeded();

          const genAI = new GoogleGenAI({ apiKey });
          console.log(`[Gemini] 🔄 ${modelName} | ${keyLabel} | attempt ${attempt}/${MAX_RETRIES_PER_KEY}`);

          const requestPayload: any = {
            model: modelName,
            contents: formattedContents,
          };
          if (systemInstruction) {
            requestPayload.config = { systemInstruction };
          }

          const response = await genAI.models.generateContent(requestPayload);

          let text = '';
          if (response.text) {
            text = response.text;
          } else if (response.candidates?.[0]?.content?.parts) {
            text = response.candidates[0].content.parts
              .filter((p: any) => p.text && !p.thought)
              .map((p: any) => p.text)
              .join('');
          }

          if (!text) throw new Error(`Respons kosong (finishReason: ${response.candidates?.[0]?.finishReason})`);

          console.log(`[Gemini] ✅ Berhasil! ${text.length} karakter.`);
          return text;

        } catch (err: any) {
          const errMsg = err?.message || '';
          const is503 = errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('UNAVAILABLE') || errMsg.includes('unavailable');
          const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted') || errMsg.includes('Too Many Requests');
          const isTokenLimit = errMsg.includes('max tokens') || errMsg.includes('token limit') || errMsg.includes('MAX_TOKENS') || errMsg.includes('generation exceeded');

          console.warn(`[Gemini] ❌ ${modelName} | ${keyLabel} | attempt ${attempt}: ${errMsg.substring(0, 100)}`);
          allErrors.push(`${modelName}[${keyLabel}][attempt ${attempt}]: ${errMsg}`);

          if (isTokenLimit) {
            // Token limit = masalah MODEL, bukan key — langsung ganti model, jangan buang key lain
            console.log(`[Gemini] ⚠️ Token limit terlampaui di ${modelName}. Ganti model berikutnya...`);
            // Break semua loop key untuk model ini, pindah ke model berikutnya
            ki = API_KEYS.length; // exit key loop
            break; // exit while loop
          }

          if (is429) {
            // Quota habis di key ini untuk model ini — pindah ke key berikutnya langsung
            console.log(`[Gemini] ⚠️ Quota habis ${modelName} | ${keyLabel}. Pindah key...`);
            await sleep(1000);
            break; // keluar while, lanjut ki++ (key berikutnya)
          }

          if (is503) {
            if (attempt < MAX_RETRIES_PER_KEY) {
              // Server sibuk — tunggu dan retry key yang sama
              console.log(`[Gemini] ⏳ Server sibuk (503). Retry ${attempt}/${MAX_RETRIES_PER_KEY} tunggu 5 detik...`);
              await sleep(5000);
              continue; // retry attempt yang sama
            } else {
              // Sudah 3x coba, server masih mati — ganti key
              console.log(`[Gemini] 🔄 ${modelName} | ${keyLabel} sudah 3x gagal 503. Ganti key...`);
              break;
            }
          }

          // Error lain (bad request, dll) — retry key yang sama sampai habis
          if (attempt < MAX_RETRIES_PER_KEY) {
            console.log(`[Gemini] ↩️ Error umum. Retry ${attempt}/${MAX_RETRIES_PER_KEY}...`);
            await sleep(2000);
            continue;
          }
          // Habis attempt — ganti key
          console.log(`[Gemini] 🔁 ${keyLabel} habis ${MAX_RETRIES_PER_KEY} attempt. Pindah key...`);
          break;
        }
      }
    }
  }

  throw new Error(`Semua Model AI dan API Key Gagal.\n${allErrors.slice(-10).join('\n')}`);
};

// === Helper: deteksi MIME type dari file secara robust ===
const getAudioMimeType = (file: File | Blob): string => {
  if (file.type && file.type.startsWith('audio/')) return file.type;

  if (file instanceof File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'wma': 'audio/x-ms-wma',
    };
    if (ext && mimeMap[ext]) return mimeMap[ext];
  }

  return 'audio/mpeg';
};

// === API: Analyze Document Style ===
export const analyzeDocumentStyle = async (file: File): Promise<string> => {
  try {
    const fileBase64 = await fileToBase64(file);
    const mimeType = file.type || (file.name.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf');

    return await callGemini([
      { inlineData: { mimeType, data: fileBase64 } },
      { text: 'Analisis dokumen ini.' }
    ], `TUGAS: Buatlah "REPLIKA VISUAL MARKDOWN" dari dokumen yang diberikan untuk digunakan sebagai template.
    
    KEWAJIBAN MUTLAK:
    1. LOGO: Anda WAJIB menyertakan baris ini di baris paling atas: ![Logo KPU](${KPU_LOGO_URL})
    2. HEADER & FOOTER: Salin persis teks header (Lembaga, Alamat, dsb) secara verbatim.
    3. STRUKTUR KONTEN: Analisis bagaimana isi notulensi disusun (misal: penomoran, gaya paragraf, atau poin-poin). Gunakan placeholder [ISI NOTULENSI DI SINI] yang diletakkan di dalam struktur yang sesuai.
    4. GAYA BAHASA: Tiru gaya bahasa birokrasi KPU yang ada di dokumen.
    5. TANPA TABEL: DILARANG menggunakan tabel markdown. Gunakan paragraf naratif.`);
  } catch (error: any) {
    throw new Error(error.message || "Gagal membaca file referensi.");
  }
};

// System instruction standar untuk transkripsi audio
const buildTranscriptionSystemInstruction = (participants: string) =>
  `TUGAS SISTEM UTAMA: Anda adalah asisten transkripsi profesional KPU. Transkripsikan file audio yang diberikan secara VERBATIM dan SANGAT AKURAT.

DAFTAR PEMBICARA RESMI DALAM RAPAT INI:
${participants}

INSTRUKSI MUTLAK (SPEAKER DIARIZATION):
1. DENGARKAN DENGAN SEKSAMA perbedaan setiap suara (pria/wanita, aksen, intonasi, kecepatan bicara).
2. Setiap kali ada pergantian pembicara, WAJIB buat baris baru dengan format PERSIS:
   [Nama Pembicara]: [Apa yang diucapkan...]
3. COCOKKAN suara pembicara dengan "Daftar Pembicara Resmi" di atas. Gunakan logika konteks percakapan.
4. Jika 100% yakin suara milik siapa, sebutkan NAMA LENGKAPNYA sesuai daftar.
5. Jika ada suara yang tidak bisa diidentifikasi, beri label "Peserta Lain 1", "Peserta Lain 2", dst. secara konsisten.
6. JANGAN meringkas. Tuliskan setiap perkataan secara SANGAT DETAIL dan LENGKAP.
7. PEMISAHAN KETAT: JANGAN PERNAH menggabungkan ucapan dari dua orang berbeda dalam satu baris/paragraf.
8. TANPA BASA-BASI: LANGSUNG mulai dengan format [Nama]: tanpa intro apapun.
9. ATURAN ANTI-HALUSINASI MUTLAK: HANYA tuliskan apa yang benar-benar terdengar dalam audio. DILARANG KERAS mengarang, menyimpulkan, atau menambahkan kata/kalimat di luar rekaman suara asli.`;

// === Helper: Upload audio langsung dari browser ke Gemini Files API ===
// Menggunakan XHR agar upload.onprogress bisa dipakai — progress bytes nyata.
// Retry 3x per API key sebelum pindah ke key berikutnya.
const uploadAudioDirect = async (
  audioFile: File | Blob,
  mimeType: string,
  onProgress?: (pct: number) => void,  // 0-100 progress upload saja
  onStatus?: (msg: string) => void
): Promise<string> => {
  const sizeMB = (audioFile.size / 1024 / 1024).toFixed(1);
  console.log(`[Gemini] 📤 Upload ke Files API... (${sizeMB}MB, ${mimeType})`);

  // Upload via XHR supaya progress bytes bisa dilaporkan
  const uploadViaXHR = (apiKey: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const boundary = '----GeminiUpload' + Date.now();
      const metaJson = JSON.stringify({ file: { display_name: (audioFile as File).name || 'audio' } });
      const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`;
      const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
      const tail = `\r\n--${boundary}--`;

      const reader = new FileReader();
      reader.onload = () => {
        const metaBytes  = new TextEncoder().encode(metaPart);
        const fileBytes  = new TextEncoder().encode(filePart);
        const fileBuffer = reader.result as ArrayBuffer;
        const tailBytes  = new TextEncoder().encode(tail);

        const body = new Uint8Array(
          metaBytes.byteLength + fileBytes.byteLength + fileBuffer.byteLength + tailBytes.byteLength
        );
        let off = 0;
        body.set(metaBytes, off);  off += metaBytes.byteLength;
        body.set(fileBytes, off);  off += fileBytes.byteLength;
        body.set(new Uint8Array(fileBuffer), off); off += fileBuffer.byteLength;
        body.set(tailBytes, off);

        const xhr = new XMLHttpRequest();

        // ✅ Progress upload bytes nyata
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress?.(pct);
            onStatus?.(`Mengunggah audio... ${pct}% (${(e.loaded / 1024 / 1024).toFixed(1)} / ${sizeMB} MB)`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText);
              const uri = resp?.file?.uri || resp?.uri;
              if (uri) resolve(uri);
              else reject(new Error('URI tidak ditemukan dalam respons upload.'));
            } catch {
              reject(new Error('Respons upload tidak valid.'));
            }
          } else {
            reject(new Error(`Upload gagal: HTTP ${xhr.status} — ${xhr.responseText.substring(0, 120)}`))
          }
        };
        xhr.onerror = () => reject(new Error('Network error saat upload.'));
        xhr.open('POST', `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${apiKey}`);
        xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);
        xhr.send(body);
      };
      reader.onerror = () => reject(new Error('Gagal membaca file audio.'));
      reader.readAsArrayBuffer(audioFile);
    });

  const allErrors: string[] = [];

  for (let ki = 0; ki < API_KEYS.length; ki++) {
    const keyLabel = `Key-${ki + 1}`;
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        console.log(`[Gemini] Upload ${keyLabel} attempt ${attempt}/3...`);
        onStatus?.(`Mengunggah audio (${sizeMB}MB)... [${keyLabel}]`);
        const uri = await uploadViaXHR(API_KEYS[ki]);
        console.log(`[Gemini] ✅ Upload berhasil! URI: ${uri}`);
        return uri;
      } catch (err: any) {
        const errMsg = err?.message || '';
        allErrors.push(`${keyLabel}[attempt ${attempt}]: ${errMsg}`);
        console.warn(`[Gemini] ❌ Upload ${keyLabel} attempt ${attempt}: ${errMsg.substring(0, 80)}`);
        if (attempt < 3) {
          onStatus?.(`Upload gagal, mencoba ulang... (${attempt}/3)`);
          await sleep(3000);
        }
      }
    }
  }

  throw new Error(`Semua API key gagal upload.\n${allErrors.join('\n')}`);
};

// === Helper: Transcribe via fileUri (setelah Files API upload) ===
// Retry 3x per key sebelum ganti key, ganti model jika token limit.
// Timer status tiap 5 detik agar user tahu AI masih bekerja.
const transcribeViaFileUri = async (
  fileUri: string,
  mimeType: string,
  systemInstruction: string,
  promptText: string,
  onStatus?: (msg: string) => void
): Promise<string> => {
  const allErrors: string[] = [];

  // Timer untuk update status saat AI sedang proses (bisa 1-3 menit)
  let statusTimer: ReturnType<typeof setInterval> | null = null;
  const startStatusTimer = (modelName: string) => {
    let elapsed = 0;
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = setInterval(() => {
      elapsed += 5;
      const msgs = [
        `AI sedang membaca audio... (${elapsed}d)`,
        `Mentranskripsi percakapan... (${elapsed}d)`,
        `Mengidentifikasi pembicara... (${elapsed}d)`,
        `Memproses rekaman dengan ${modelName}... (${elapsed}d)`,
      ];
      onStatus?.(msgs[Math.floor(elapsed / 5) % msgs.length]);
    }, 5000);
  };
  const stopStatusTimer = () => {
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
  };

  try {
    for (let mi = 0; mi < MODEL_CHAIN.length; mi++) {
      const modelName = MODEL_CHAIN[mi];

      for (let ki = 0; ki < API_KEYS.length; ki++) {
        const keyLabel = `Key-${ki + 1}`;
        let attempt = 0;

        while (attempt < 3) {
          attempt++;
          try {
            await waitIfNeeded();
            const genAI = new GoogleGenAI({ apiKey: API_KEYS[ki] });
            console.log(`[Gemini] 🎙️ Transcribe via URI | ${modelName} | ${keyLabel} | attempt ${attempt}/3`);
            onStatus?.(`AI sedang mentranskripsi audio... [${modelName}]`);
            startStatusTimer(modelName);

            const requestPayload: any = {
              model: modelName,
              contents: [{
                role: 'user',
                parts: [
                  { fileData: { mimeType, fileUri } },
                  { text: promptText },
                ],
              }],
            };
            if (systemInstruction) requestPayload.config = { systemInstruction };

            const result = await genAI.models.generateContent(requestPayload);
            stopStatusTimer();

            let text = '';
            if (result.text) {
              text = result.text;
            } else if (result.candidates?.[0]?.content?.parts) {
              text = result.candidates[0].content.parts
                .filter((p: any) => p.text && !p.thought)
                .map((p: any) => p.text)
                .join('');
            }
            if (!text) throw new Error(`Respons kosong (${result.candidates?.[0]?.finishReason})`);

            console.log(`[Gemini] ✅ Transkripsi berhasil! ${text.length} karakter.`);
            onStatus?.('✅ Transkripsi selesai!');
            return text;

          } catch (err: any) {
            stopStatusTimer();
            const errMsg = err?.message || '';
            const is503 = errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('UNAVAILABLE');
            const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('exhausted');
            const isTokenLimit = errMsg.includes('max tokens') || errMsg.includes('token limit') || errMsg.includes('generation exceeded');

            allErrors.push(`${modelName}[${keyLabel}][attempt ${attempt}]: ${errMsg}`);
            console.warn(`[Gemini] ❌ ${modelName} | ${keyLabel} | attempt ${attempt}: ${errMsg.substring(0, 100)}`);

            if (isTokenLimit) {
              onStatus?.(`⚠️ Output terlalu panjang di ${modelName}, coba model lain...`);
              console.log(`[Gemini] ⚠️ Token limit di ${modelName}. Ganti model...`);
              ki = API_KEYS.length; // skip sisa key untuk model ini
              break;
            }
            if (is429) {
              onStatus?.(`⚠️ Quota habis ${keyLabel}, pindah key...`);
              console.log(`[Gemini] ⚠️ Quota habis ${keyLabel}. Pindah key...`);
              await sleep(1000);
              break;
            }
            if (is503 && attempt < 3) {
              onStatus?.(`⏳ Server sibuk, mencoba ulang (${attempt}/3)...`);
              console.log(`[Gemini] ⏳ 503 Server sibuk. Retry ${attempt}/3 tunggu 5 detik...`);
              await sleep(5000);
              continue;
            }
            if (attempt < 3) {
              onStatus?.(`↩️ Mencoba ulang... (${attempt}/3)`);
              await sleep(2000);
              continue;
            }
            break;
          }
        }
      }
    }
  } finally {
    stopStatusTimer();
  }

  throw new Error(`Semua model dan key gagal transkripsi.\n${allErrors.slice(-8).join('\n')}`);
};

// === API: Transcribe Full Audio ===
// File besar (>20MB): upload ke Files API dari browser → transcribe via URI (sama seperti AI Studio).
// File kecil (≤20MB): kirim inline base64 langsung.
export const transcribeFullAudio = async (
  audioFile: File,
  context: MeetingContext,
  onProgress?: (progress: number) => void,
  onStatus?: (message: string) => void
): Promise<string> => {
  const mimeType = getAudioMimeType(audioFile);
  const sizeMB = (audioFile.size / 1024 / 1024).toFixed(1);
  const isLarge = audioFile.size > 20 * 1024 * 1024; // >20MB pakai Files API

  console.log(`[Gemini] Transcribing: ${audioFile.name}, ${sizeMB}MB, ${mimeType}, mode=${isLarge ? 'Files API' : 'inline'}`);
  onProgress?.(5);

  const systemInstruction = buildTranscriptionSystemInstruction(context.participants);
  const promptText = `Transkripsikan seluruh rekaman rapat ini secara verbatim, kata demi kata.`;

  if (isLarge) {
    // Upload dengan progress bytes nyata (XHR)
    // onProgress: 5% → 10-50% saat upload → 50% saat transkripsi → 100%
    const fileUri = await uploadAudioDirect(
      audioFile,
      mimeType,
      (uploadPct) => {
        // Upload menempati progress 10%-50%
        onProgress?.(10 + Math.round(uploadPct * 0.4));
      },
      onStatus
    );

    onProgress?.(50);
    onStatus?.('Upload selesai! AI sedang mentranskripsi audio...');

    const transcript = await transcribeViaFileUri(fileUri, mimeType, systemInstruction, promptText, onStatus);
    onProgress?.(100);
    return transcript;
  } else {
    // File kecil: inline base64 langsung
    onStatus?.(`Memproses audio (${sizeMB}MB)...`);
    onProgress?.(20);
    const audioBase64 = await fileToBase64(audioFile);
    onProgress?.(50);
    onStatus?.('AI sedang mentranskripsi audio...');
    const transcript = await callGemini([
      { inlineData: { mimeType, data: audioBase64 } },
      { text: promptText }
    ], systemInstruction);
    onProgress?.(100);
    return transcript;
  }
};

// === API: Transcribe Audio Chunk (dari live recording) ===
// Chunk dikirim inline base64 langsung — tidak perlu upload Files API.
export const transcribeAudioChunk = async (
  audioBlob: Blob,
  context: MeetingContext,
  index: number,
  previousContext?: string
): Promise<string> => {
  const mimeType = getAudioMimeType(audioBlob);
  const systemInstruction = buildTranscriptionSystemInstruction(context.participants);

  const audioBase64 = await fileToBase64(audioBlob);

  const promptText = index === 0
    ? `Transkripsikan segmen rekaman pertama ini secara verbatim, kata demi kata.`
    : `LANJUTAN rekaman (segmen ke-${index + 1}).

${previousContext ? `KONTEKS TRANSKRIP SEBELUMNYA (20 baris terakhir):
--- MULAI KONTEKS ---
${previousContext}
--- AKHIR KONTEKS ---

` : ''}Lanjutkan transkrip dari audio ini. Pertahankan konsistensi nama pembicara.`;

  return await callGemini([
    { inlineData: { mimeType, data: audioBase64 } },
    { text: promptText }
  ], systemInstruction);
};

// === API: Generate Final Minutes ===
export const generateFinalMinutesFromText = async (fullTranscript: string, context: MeetingContext): Promise<string> => {

  const sortParticipantsByHierarchy = (participantsStr: string): string => {
    const items = participantsStr.split(/\n/).map(p => p.trim()).filter(Boolean);
    const getLevel = (entry: string): number => {
      const low = entry.toLowerCase();
      if (/\bketua\b/.test(low) && /kpu/.test(low)) return 0;
      if (/\banggota\b/.test(low) && /kpu/.test(low)) return 1;
      if (/sekretaris.*kpu|kpu.*sekretaris/.test(low)) return 2;
      if (/kepala sub bagian|kasubbag/.test(low)) return 3;
      if (/notulen|arsiparis|operator|staff|staf/.test(low)) return 5;
      return 4;
    };
    const indexed = items.map((item, i) => ({ item, level: getLevel(item), i }));
    indexed.sort((a, b) => a.level - b.level || a.i - b.i);
    return indexed.map(x => x.item).join('\n');
  };

  const numberedParticipants = sortParticipantsByHierarchy(context.participants)
    .split('\n')
    .filter(p => p.trim())
    .map((p, i) => `${i + 1}. ${p.trim().toUpperCase()}`)
    .join('\n');

  const styleInstruction = context.styleGuide
    ? `GUNAKAN RANGKA TEMPLATE INI (TERMASUK LOGO): \n${context.styleGuide}`
    : `
![Logo KPU](${KPU_LOGO_URL})

# KOMISI PEMILIHAN UMUM
## KABUPATEN GUNUNGKIDUL
### NOTULEN RAPAT ${context.title.toUpperCase()}

---

**Hari, tanggal** : ${context.date}
**Pukul** : ${context.startTime || '[JAM MULAI]'} WIB s.d. ${context.endTime || 'Selesai'}
**Tempat** : ${context.location || '[TEMPAT RAPAT]'}

**PESERTA RAPAT YANG HADIR BERDASARKAN YANG MENANDATANGANI DAFTAR HADIR**

${numberedParticipants}

---

**AGENDA RAPAT:**
1. [ISI AGENDA BERDASARKAN TRANSKRIP]

---

**KESIMPULAN / HASIL RAPAT:**
* [RINGKASAN POIN-POIN PENTING HASIL RAPAT DI SINI]
`;

  const photoPlaceholders = context.documentationPhotos
    ? `\n\n# DOKUMENTASI ${context.title.toUpperCase()} ${context.date.toUpperCase()}\n\n[DOKUMENTASI_FOTO_DI_SINI]`
    : '';

  const systemInstruction = `TUGAS UTAMA: Susun Notulensi Rapat KPU yang SANGAT DETAIL, KRONOLOGIS, dan BERBASIS ALUR PERCAKAPAN dari transkrip yang diberikan.

ATURAN FORMAT MUTLAK — WAJIB DIPATUHI:
1. MURNI MARKDOWN saja. DILARANG KERAS tag HTML apapun (<p>, <div>, <br>, <b>, <i>, dll).
2. Gunakan # untuk heading, bukan tag HTML.
3. LOGO: Baris PERTAMA dokumen HARUS: ![Logo KPU](${KPU_LOGO_URL})
4. DAFTAR PESERTA: Salin PERSIS dari template — jangan ubah urutan, nomor, nama, atau jabatan.
5. KESIMPULAN: Wajib ada bagian "KESIMPULAN / HASIL RAPAT" berisi poin-poin ringkasan.
6. DOKUMENTASI: Placeholder [DOKUMENTASI_FOTO_DI_SINI] di baris paling akhir.

FORMAT PENULISAN ISI RAPAT — INI YANG PALING PENTING:
Setiap pembicara WAJIB ditulis dalam paragraf tersendiri dengan pola berikut:

  **[NAMA LENGKAP]**, menyampaikan bahwa [isi pernyataan lengkap dan detail].

  **[NAMA LAIN]**, menanggapi dengan menyampaikan bahwa [isi tanggapan lengkap].

  **[NAMA PERTAMA]**, menambahkan bahwa [isi tambahan].

CONTOH YANG BENAR:
  **Budi Santoso**, menyampaikan bahwa agenda rapat hari ini adalah membahas persiapan pemilu serentak yang akan dilaksanakan pada bulan November. Beliau menjelaskan bahwa terdapat beberapa hal yang perlu mendapat perhatian serius dari seluruh peserta.

  **Sri Wahyuni**, menanggapi dengan menyampaikan bahwa pihaknya sudah menyiapkan daftar logistik yang diperlukan. Namun demikian, masih terdapat kekurangan pada beberapa item yang membutuhkan pengadaan tambahan.

  **Budi Santoso**, menambahkan bahwa pengadaan tambahan harus diselesaikan paling lambat dua minggu sebelum hari pemungutan suara.

ATURAN TAMBAHAN:
- JANGAN pernah gabungkan ucapan dua orang berbeda dalam satu paragraf.
- JANGAN meringkas — tulis LENGKAP apa yang disampaikan setiap orang.
- Gunakan kata penghubung yang sesuai: "menyampaikan", "menanggapi", "menambahkan", "menjelaskan", "menegaskan", "mengusulkan", "menyetujui", dll.
- Ikuti URUTAN KRONOLOGIS percakapan sesuai transkrip.

STRUKTUR DOKUMEN:
${styleInstruction}
${photoPlaceholders}`;

  const prompt = `DATA UNTUK DIPROSES:

Judul Rapat: ${context.title}
Tanggal: ${context.date}
Daftar Pembicara Resmi: 
${context.participants}

=== TRANSKRIP ===
${fullTranscript}`;

  return await callGemini([
    { text: prompt }
  ], systemInstruction);
};
