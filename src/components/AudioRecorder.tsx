
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle, Radio } from 'lucide-react';
import { AppStatus } from '@/types';
import { formatDuration } from '@/utils/audioHelpers';

interface AudioRecorderProps {
  status: AppStatus;
  progress?: number; 
  processingStatus?: string;
  onStartRecording: () => void;
  onStopRecording: () => void; 
  onChunkReady: (blob: Blob) => void; 
  error?: string | null;
}

const CHUNK_INTERVAL_MS = 20 * 60 * 1000; 

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  status, 
  progress = 0, 
  processingStatus = '', 
  onStartRecording, 
  onStopRecording, 
  onChunkReady, 
  error 
}) => {
  const [duration, setDuration] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const chunkTimerRef = useRef<number | null>(null); 
  const wakeLockRef = useRef<any>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupAudioResources = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (analyserRef.current) analyserRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
    }
  };

  const startVisualizer = () => {
    if (!canvasRef.current || !streamRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    canvasRef.current.width = container.offsetWidth;
    canvasRef.current.height = container.offsetHeight;

    const stream = streamRef.current;
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      analyserRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!ctx || !analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(draw);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height * 0.7;
          ctx.fillStyle = '#18181b';
          if (barHeight > 0) {
              ctx.beginPath();
              const centerY = canvas.height / 2;
              ctx.roundRect(x, centerY - barHeight / 2, Math.max(1, barWidth - 2), barHeight, 2);
              ctx.fill();
          }
          x += barWidth;
        }
      };
      draw();
    } catch (e) { console.warn("Visualizer failed", e); }
  };

  const handleStart = async () => {
    setLocalError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorder.start(5000); 
      onStartRecording();
      
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration(prev => prev + 1), 1000);
      chunkTimerRef.current = window.setInterval(() => restartRecordingForChunking(), CHUNK_INTERVAL_MS);

    } catch (err: any) {
      setLocalError("Akses mikrofon ditolak.");
    }
  };

  const restartRecordingForChunking = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
            if (blob.size > 0) onChunkReady(blob);
            chunksRef.current = [];
            
            if (streamRef.current && streamRef.current.active) {
                const newRecorder = new MediaRecorder(streamRef.current, { mimeType: mediaRecorderRef.current?.mimeType });
                mediaRecorderRef.current = newRecorder;
                newRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
                newRecorder.start(5000);
            }
        };
        mediaRecorderRef.current.stop();
    }
  };

  const handleManualStop = () => {
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
         const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
         if (blob.size > 0) onChunkReady(blob);
         if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
         cleanupAudioResources();
         onStopRecording();
      };
      mediaRecorderRef.current.stop();
    }
  };

  const isRecording = status === AppStatus.RECORDING || status === AppStatus.PROCESSING_CHUNK;
  const isProcessingFinal = status === AppStatus.PROCESSING_FINAL;

  useEffect(() => {
    if (isRecording && streamRef.current) {
        setTimeout(() => startVisualizer(), 100);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      cleanupAudioResources();
    };
  }, []);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-none overflow-hidden p-6 sm:p-8 space-y-6 sm:space-y-8 max-w-xl mx-auto">
      <div className="flex flex-col items-center text-center space-y-2">
        <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
          {isRecording ? 'Perekaman Aktif' : isProcessingFinal ? 'Menyusun Notulensi' : 'Status: Siap'}
        </h3>
        <div className="h-5">
          {processingStatus ? (
            <span className="text-xs font-bold text-[#431317] flex items-center gap-2 uppercase tracking-wide">
              <Loader2 className="w-3 h-3 animate-spin" /> {processingStatus}
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-widest font-bold">
              {isRecording ? 'Suara dideteksi' : isProcessingFinal ? 'Memproses dokumen...' : 'Klik Mic untuk mulai'}
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef} className="h-24 sm:h-32 w-full bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-center relative overflow-hidden">
          {isRecording ? (
            <>
              <canvas ref={canvasRef} className="w-full h-full" />
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl shadow-none">
                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[11px] font-mono font-bold text-slate-800 tracking-tight">{formatDuration(duration)}</span>
              </div>
            </>
          ) : isProcessingFinal ? (
            <div className="w-full px-8 sm:px-12 space-y-3">
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#431317] transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-[10px] text-center font-extrabold text-[#431317] uppercase tracking-wider">{progress}% Progres</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-300">
               <Radio className="w-8 h-8 opacity-40" />
               <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Visualizer Standby</span>
            </div>
          )}
      </div>

      <div className="flex flex-col items-center gap-6">
        {!isRecording && !isProcessingFinal && (
          <button
            onClick={handleStart}
            className="group h-16 w-16 sm:h-20 sm:w-20 bg-[#431317] text-white rounded-full flex items-center justify-center hover:bg-[#5a1a1f] transition-all shadow-none border border-[#431317] active:scale-95"
          >
            <Mic className="w-7 h-7 sm:w-8 sm:h-8" />
          </button>
        )}

        {isRecording && (
          <button
            onClick={handleManualStop}
            className="group h-16 w-16 sm:h-20 sm:w-20 bg-white border-2 border-slate-200 text-[#431317] rounded-full flex items-center justify-center hover:bg-slate-50 transition-all shadow-none active:scale-95"
          >
            <Square className="w-6 h-6 sm:w-7 sm:h-7 fill-[#431317]" />
          </button>
        )}

        {isProcessingFinal && (
          <div className="h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
          </div>
        )}
        
        {(error || localError) && (
          <div className="w-full bg-red-50 border border-red-100 px-4 py-3 rounded-xl flex items-center gap-3 text-xs text-red-600 animate-in shake duration-300 shadow-none">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-bold">{error || localError}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
