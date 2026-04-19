import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { saveUserSignature } from '../services/firebase';
import SignaturePad from './SignaturePad';

interface UserProfileModalProps {
  user: { uid: string; displayName: string | null; email?: string | null };
  currentSignature: string | null;
  onClose: () => void;
  onSaved: (newSignatureBase64: string) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, currentSignature, onClose, onSaved }) => {
  const [signaturePreview, setSignaturePreview] = useState<string | null>(currentSignature);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useDrawMode, setUseDrawMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      setError('Mohon upload file dengan format PNG (disarankan dengan background transparan).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran file terlalu besar. Maksimal 2MB.');
      return;
    }

    setError(null);
    try {
      const base64 = await compressImageToBase64DataUri(file);
      setSignaturePreview(base64);
    } catch (err) {
      setError('Gagal memproses gambar. Coba file lain.');
    }
  };

  const compressImageToBase64DataUri = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if too large limit to 400px width
        if (width > 400) {
          height = Math.round((height * 400) / width);
          width = 400;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Export as transparent PNG
        const dataUri = canvas.toDataURL('image/png', 0.9);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUri);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image"));
      };
    });
  };

  const handleSave = async () => {
    if (!signaturePreview) {
      setError("Silakan upload gambar tanda tangan.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      await saveUserSignature(user.uid, signaturePreview);
      onSaved(signaturePreview);
      onClose();
    } catch (err) {
      setError("Gagal menyimpan tanda tangan ke database.");
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      await saveUserSignature(user.uid, '');
      setSignaturePreview(null);
      onSaved('');
      onClose();
    } catch (err) {
      setError("Gagal menghapus tanda tangan.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Profil & Tanda Tangan</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#FDF2F3] text-[#A62731] font-bold text-xl rounded-full mx-auto flex items-center justify-center mb-3">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <h3 className="font-semibold text-slate-900">{user.displayName}</h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Tanda Tangan Digital</label>
              <div className="flex items-center gap-1.5 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                <button 
                  type="button"
                  onClick={() => { setUseDrawMode(false); setSignaturePreview(null); }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${!useDrawMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Upload
                </button>
                <button 
                  type="button"
                  onClick={() => { setUseDrawMode(true); setSignaturePreview(null); }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${useDrawMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Gambar Langsung
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">Mendukung file ukuran kecil, tanpa background (transparan). Tanda tangan otomatis ditempel di notulen.</p>
            
            <div className="mt-4">
              {useDrawMode ? (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <SignaturePad width={320} height={160} onSave={(base64) => setSignaturePreview(base64)} />
                </div>
              ) : (
                <>
                  {signaturePreview ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 relative group bg-slate-50">
                      <div className="h-32 flex items-center justify-center">
                        <img src={signaturePreview} alt="Tanda Tangan Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm"
                        >
                          Ubah
                        </button>
                        <button 
                          onClick={handleRemove}
                          className="px-4 py-2 bg-[#FDF2F3] text-[#A62731] rounded-lg text-sm font-medium hover:bg-[#FBE5E7]"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:border-[#A62731] hover:text-[#A62731] transition-colors bg-slate-50 hover:bg-[#FDF2F3]"
                    >
                      <Upload className="w-8 h-8 mb-3 text-slate-400" />
                      <span className="font-medium">Pilih File Tanda Tangan</span>
                      <span className="text-xs mt-1">PNG Transparan disarankan (Maks 2MB)</span>
                    </button>
                  )}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/png" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </>
              )}
            </div>
            
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-sm rounded-lg mt-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
            disabled={isLoading}
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading || !signaturePreview || signaturePreview === currentSignature}
            className="px-5 py-2.5 bg-slate-900 text-white font-medium hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
