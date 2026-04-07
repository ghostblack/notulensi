import React, { useState, useEffect } from 'react';
import { Mail, Key, Loader2, AlertCircle, Shield, ArrowLeft } from 'lucide-react';
import { loginAsAdmin, auth, onAuthStateChanged, checkIsAdmin, logOut } from '@/services/firebase';
import AdminDashboard from '@/components/admin/AdminDashboard';
import type { User } from 'firebase/auth';

const AdminPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isAdmin = await checkIsAdmin(user.uid);
        if (isAdmin) {
          setAdminUser(user);
        } else {
          // Not admin — sign out
          await logOut();
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
      }
      setChecking(false);
    });
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await loginAsAdmin(email.trim(), password);
      setAdminUser(user);
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Email atau password salah.');
      } else if (err.message === 'Akun ini bukan admin.') {
        setError('Akun ini tidak memiliki hak akses admin.');
      } else {
        setError(err.message || 'Terjadi kesalahan.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
      </div>
    );
  }

  if (adminUser) {
    return <AdminDashboard user={adminUser} />;
  }

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Left: Form (60%) */}
      <div className="w-full lg:w-[60%] flex flex-col justify-center items-center p-6 lg:p-12">
        <div className="w-full max-w-[320px] space-y-10">
          {/* Back to user login */}
          <a 
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-[#431317] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Kembali ke Login Petugas
          </a>

          {/* Header */}
          <div className="space-y-3">
            <div className="w-11 h-11 bg-[#431317] rounded-2xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">Panel Admin</h1>
              <p className="text-slate-500 text-xs font-medium">Masuk sebagai administrator SINEGU</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[10px] p-2.5 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Admin</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#431317] transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                    placeholder="admin@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#431317] transition-colors">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#431317] hover:bg-[#5a1a1f] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center border border-[#431317]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Masuk sebagai Admin
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-400 font-medium">
            © 2026 Notulensi AI • KPU Kab. Gunungkidul
          </p>
        </div>
      </div>

      {/* Right: Dark Panel (40%) */}
      <div className="hidden lg:flex lg:w-[40%] p-6">
        <div className="w-full h-full bg-[#431317] rounded-[40px] flex flex-col items-center justify-center relative overflow-hidden border border-[#431317] gap-6 p-8">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />

          <div className="relative z-10 text-center space-y-4">
            <div className="w-16 h-16 bg-white/10 border border-white/10 rounded-3xl flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Administrator</h2>
              <p className="text-white/50 text-xs mt-1 font-medium">SINEGU KPU Gunungkidul</p>
            </div>
            <div className="space-y-2 text-left">
              {[
                'Kelola akun petugas notulensi',
                'Atur daftar peserta per kategori',
                'Pantau semua notulensi',
                'Kelola sub-bagian & unit kerja',
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1 h-1 bg-white/40 rounded-full shrink-0" />
                  <p className="text-[11px] text-white/60 font-medium">{f}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
