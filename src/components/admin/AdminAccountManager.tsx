import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, UserPlus, Mail, Key, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { subscribeToUsers, createPetugasAccount, deletePetugasAccount } from '@/services/firebase';
import SignaturePad from '../SignaturePad';

interface PetugasAccount {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
  role: string;
}

const AdminAccountManager: React.FC = () => {
  const [users, setUsers] = useState<PetugasAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ displayName: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [useDrawMode, setUseDrawMode] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToUsers((data) => {
      setUsers(data as PetugasAccount[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim() || !formData.email.trim() || !formData.password.trim()) return;
    if (formData.password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      await createPetugasAccount(formData.email.trim(), formData.password, formData.displayName.trim(), signaturePreview);
      setSuccess(`Akun "${formData.displayName}" berhasil dibuat.`);
      setFormData({ displayName: '', email: '', password: '' });
      setSignaturePreview(null);
      setShowForm(false);
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/email-already-in-use') {
        setError('Email sudah digunakan.');
      } else if (code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError(err.message || 'Gagal membuat akun.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('png')) {
      setError('Format TTD harus PNG transparan.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran file maksimal 2MB.');
      return;
    }
    setError(null);
    try {
      const base64 = await compressImageToBase64DataUri(file);
      setSignaturePreview(base64);
    } catch {
      setError('Gagal memproses gambar TTD.');
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
        if (width > 400) {
          height = Math.round((height * 400) / width);
          width = 400;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas error"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.9));
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject();
      };
    });
  };

  const handleDelete = async (uid: string, name: string) => {
    if (!window.confirm(`Hapus akun "${name}"? Data login akan dihapus.`)) return;
    setDeleting(uid);
    try {
      await deletePetugasAccount(uid);
      setSuccess(`Akun "${name}" dihapus dari daftar.`);
    } catch {
      setError('Gagal menghapus akun.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[#111827]">Manajemen Akun Petugas</h2>
          <p className="text-xs text-slate-500 mt-0.5">Buat dan kelola akun untuk petugas notulensi.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null); setSuccess(null); setSignaturePreview(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#431317] text-white rounded-xl text-xs font-bold hover:bg-[#5a1a1f] transition-all active:scale-95 shadow-none"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Buat Akun
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-medium text-emerald-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-slate-900">Buat Akun Baru</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required
                    type="text"
                    placeholder="Nama petugas..."
                    value={formData.displayName}
                    onChange={e => setFormData(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                </div>
              </div>
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required
                    type="email"
                    placeholder="email@kpu.go.id"
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                </div>
              </div>
              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 6 karakter"
                    value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    className="w-full h-10 pl-9 pr-9 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Signature Upload / Draw */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanda Tangan Digital (Opsional)</label>
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
              
              <div className="mt-2">
                {useDrawMode ? (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <SignaturePad onSave={(base64) => setSignaturePreview(base64)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    {signaturePreview ? (
                      <div className="relative group w-32 h-20 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                        <img src={signaturePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                        <button 
                          type="button" 
                          onClick={() => setSignaturePreview(null)}
                          className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-20 w-full sm:w-64 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors bg-slate-50"
                      >
                        <span className="text-xs font-bold mb-1">Upload PNG Transparan</span>
                      </button>
                    )}
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/png" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 bg-[#431317] text-white text-xs font-bold rounded-xl hover:bg-[#5a1a1f] transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {creating ? 'Membuat...' : 'Buat Akun'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Daftar Akun ({users.length})
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
              <User className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">Belum ada akun petugas</p>
            <p className="text-xs text-slate-300 mt-1">Klik "Buat Akun" untuk menambahkan.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors group">
                <div className="w-8 h-8 bg-[#431317]/10 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-[#431317] text-xs font-black">
                    {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{u.displayName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-bold rounded uppercase">
                    {u.role || 'petugas'}
                  </span>
                  <span className="hidden sm:block text-[10px] text-slate-400">
                    {u.createdAt instanceof Date 
                      ? u.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-'}
                  </span>
                  <button
                    onClick={() => handleDelete(u.uid || u.id, u.displayName)}
                    disabled={deleting === (u.uid || u.id)}
                    className="p-2 sm:p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 disabled:opacity-40 active:scale-95"
                  >
                    {deleting === (u.uid || u.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center font-medium">
        ⓘ Akun yang dihapus dari daftar ini tidak otomatis terhapus dari Firebase Auth. Hubungi developer untuk penghapusan penuh.
      </p>
    </div>
  );
};

export default AdminAccountManager;
