
import React, { useState, useRef } from 'react';
import { Camera, X, Upload, CheckCircle2, AlertCircle, Image as ImageIcon, Loader2, ArrowRight, Cloud } from 'lucide-react';
import { uploadPhotosToDrive } from '@/services/driveService';

// Kompresi foto sebelum upload — wajib agar tidak melebihi 6MB payload limit Netlify
const compressPhoto = (file: File, maxDim = 1200, quality = 0.75): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      // Data URI: "data:image/jpeg;base64,XXXX" → ambil bagian setelah koma
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject('Gagal memuat gambar'); };
  });

interface PhotoUploadProps {
  onComplete: (photoIds: string[]) => void;
  onCancel: () => void;
  meetingTitle?: string;
  meetingDate?: string;
  meetingSubBagian?: string;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ onComplete, onCancel, meetingTitle, meetingDate, meetingSubBagian }) => {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MIN_PHOTOS = 4;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter(file => file.type.startsWith('image/'));
    setPhotos(prev => [...prev, ...imageFiles]);
    const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleSubmit = async () => {
    if (!isReady) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      setUploadProgress('Mengompresi foto...');

      // Konversi semua File → base64 untuk dikirim ke Netlify function
      const photoData = await Promise.all(
        photos.map(async (file, i) => {
          const base64 = await compressPhoto(file); // kompresi dulu sebelum kirim
          return {
            name: `Foto_${i + 1}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
            base64,
          };
        })
      );

      setUploadProgress(`Mengunggah ${photos.length} foto ke Google Drive...`);

      const result = await uploadPhotosToDrive(
        photoData,
        meetingTitle || 'Rapat',
        meetingDate || new Date().toISOString().split('T')[0],
        meetingSubBagian || 'KUL'
      );

      if (!result.success || !result.photoIds) {
        throw new Error(result.error || 'Gagal mengunggah foto.');
      }

      setUploadProgress('Selesai!');
      onComplete(result.photoIds);
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat upload foto.');
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const isReady = photos.length >= MIN_PHOTOS;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-6 sm:py-10 px-4 h-full overflow-y-auto custom-scrollbar">
      {/* Header Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center px-3 py-1 bg-maroon/10 rounded-full text-[10px] font-bold text-maroon uppercase tracking-widest border border-maroon/20 mb-2">
          Langkah Terakhir
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dokumentasi Rapat</h2>
        <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
          Unggah minimal <span className="text-maroon font-bold">{MIN_PHOTOS} foto</span> dokumentasi. Foto akan otomatis tersimpan ke Google Drive dan bisa dilihat kapan saja dari riwayat.
        </p>
      </div>

      {/* Upload Area */}
      {!isUploading && (
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer rounded-[2.5rem] border-2 border-dashed transition-all duration-300 p-10 flex flex-col items-center justify-center gap-6 min-h-[280px]
            ${isDragging ? 'border-maroon bg-maroon/5 scale-[1.01]' : 'border-slate-200 bg-white hover:border-maroon/30 hover:bg-slate-50/50'}
          `}
        >
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
          />
          
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-sm
            ${photos.length > 0 ? 'bg-maroon text-white rotate-6' : 'bg-slate-50 text-slate-300 group-hover:scale-110 group-hover:bg-maroon/10 group-hover:text-maroon'}
          `}>
            {photos.length > 0 ? <CheckCircle2 className="w-10 h-10" /> : <Camera className="w-10 h-10" />}
          </div>

          <div className="text-center space-y-1">
            <p className="text-lg font-bold text-slate-900">
              {photos.length > 0 ? `${photos.length} Foto Terpilih` : 'Klik atau seret foto ke sini'}
            </p>
            <p className="text-xs text-slate-400 font-medium tracking-wide">Mendukung format JPG, PNG, atau WEBP</p>
          </div>

          <div className="flex items-center gap-2 px-6 py-2 bg-slate-100 rounded-full border border-slate-200">
             <Upload className="w-3.5 h-3.5 text-slate-400" />
             <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Pilih dari Perangkat</span>
          </div>
        </div>
      )}

      {/* Uploading State */}
      {isUploading && (
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-12 flex flex-col items-center justify-center gap-6 min-h-[280px]">
          <div className="relative">
            <div className="w-20 h-20 border-[3px] border-slate-100 border-t-maroon rounded-full animate-spin" />
            <Cloud className="absolute inset-0 m-auto w-8 h-8 text-maroon" />
          </div>
          <div className="text-center space-y-2">
            <p className="font-bold text-slate-900">{uploadProgress}</p>
            <p className="text-xs text-slate-400">Mohon jangan tutup halaman ini</p>
          </div>
        </div>
      )}

      {/* Preview Grid */}
      {previews.length > 0 && !isUploading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
          {previews.map((url, idx) => (
            <div key={idx} className="relative aspect-square group rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
              <img src={url} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <button 
                onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-maroon transition-colors"
                title="Hapus"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded-md">
                <p className="text-[9px] text-white font-bold uppercase tracking-widest leading-none">Foto {idx + 1}</p>
              </div>
            </div>
          ))}
          
          {/* Empty placeholders if less than 4 */}
          {photos.length < MIN_PHOTOS && Array.from({ length: MIN_PHOTOS - photos.length }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/30 flex flex-col items-center justify-center gap-2 opacity-50">
              <ImageIcon className="w-6 h-6 text-slate-200" />
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Wajib {photos.length + i + 1}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-xs font-bold text-red-600 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Progress & Actions */}
      {!isUploading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                 <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Progres: {photos.length}/{MIN_PHOTOS} Foto</p>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isReady ? 'Foto akan diunggah otomatis ke Google Drive.' : 'Lengkapi dokumentasi untuk hasil PDF yang profesional.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onCancel}
              className="flex-1 sm:flex-none px-8 py-4 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all border border-transparent"
            >
              BATAL
            </button>
            
            <button 
              onClick={handleSubmit}
              disabled={!isReady}
              className={`flex-1 sm:flex-none px-10 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-4 transition-all active:scale-95 shadow-lg shadow-maroon/10 border border-maroon
                ${isReady ? 'bg-maroon text-white hover:bg-maroon/90 shadow-maroon/20' : 'bg-slate-100 text-slate-300 border-slate-200 shadow-none grayscale cursor-not-allowed'}
              `}
            >
              <span>SIMPAN & LANJUTKAN</span>
              {isReady ? <ArrowRight className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
