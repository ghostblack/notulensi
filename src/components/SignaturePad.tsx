import React, { useRef, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, width = 300, height = 150 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set standard styles
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    // Support responsive scaling
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Draw dot for single click
    ctx.lineTo(x, y);
    ctx.stroke();
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.closePath();
    setIsDrawing(false);
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    triggerSave();
  };

  const triggerSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if empty by looking at pixel data
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(ctx!.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    const isBlank = !pixelBuffer.some(color => color !== 0);
    
    if (isBlank) {
      onSave(''); // Emtpy
    } else {
      // Export original transparent PNG, but crop bounds natively here if we really wanted to.
      // For simplicity, we just save the 300x150 canvas.
      onSave(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave('');
    if (onClear) onClear();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white hover:border-[#431317] transition-colors touch-none">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          className="cursor-crosshair w-full aspect-[2/1] block"
          style={{ touchAction: 'none' }}
        />
        <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
          <p className="text-sm font-bold text-slate-900 select-none uppercase tracking-widest">Tulis TTD Di Sini</p>
        </div>
      </div>
      
      <button 
        type="button" 
        onClick={clearCanvas}
        className="text-[10px] text-slate-500 hover:text-red-500 flex items-center gap-1 font-medium transition-colors"
      >
        <Trash2 className="w-3 h-3" /> Ulangi Coretan
      </button>
    </div>
  );
};

export default SignaturePad;
