
import React, { useState } from 'react';
import { Mail, Key, Loader2, AlertCircle, Shield } from 'lucide-react';
import { loginAsPetugas } from '@/services/firebase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Shortcut bypass for admin
      if (email.trim() === 'admin' && password === 'kingmu') {
        window.location.href = '/admin';
        return;
      }
      
      await loginAsPetugas(email.trim(), password);
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Email atau password tidak ditemukan.');
      } else if (code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else if (code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan. Coba lagi nanti.');
      } else {
        setError('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Left Side - Login Form (60%) */}
      <div className="w-full lg:w-[60%] flex flex-col justify-center items-center p-6 lg:p-12">
        <div className="w-full max-w-[320px] space-y-10">
          {/* Logo & Header */}
          <div className="flex items-center gap-2">
            <img 
              src="https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309" 
              alt="KPU Logo" 
              className="h-7 w-auto"
              referrerPolicy="no-referrer"
            />
            <span className="text-base font-bold text-[#111827] tracking-tight">KPU-Gunungkidul</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">Selamat Datang</h1>
            <p className="text-slate-500 text-xs font-medium">Sistem Notulensi KPU Gunungkidul (SINEGU)</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[10px] p-2.5 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#431317] transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all shadow-none"
                    placeholder="email@kpu.go.id"
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
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all shadow-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#431317] hover:bg-[#5a1a1f] text-white font-bold text-sm rounded-xl transition-all shadow-none active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center border border-[#431317]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Masuk ke Dashboard"
              )}
            </button>
          </form>

          {/* Admin link */}
          <div className="text-center space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">atau</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-[#431317] transition-colors"
            >
              <Shield className="w-3 h-3" />
              Login sebagai Admin
            </a>
          </div>

          <p className="text-center text-[10px] text-slate-400 font-medium pt-4">
            © 2026 Notulensi AI • KPU Kab. Gunungkidul
          </p>
        </div>
      </div>

      {/* Right Side - Illustration (40%) */}
      <div className="hidden lg:flex lg:w-[40%] p-6">
        <div className="w-full h-full bg-[#431317] rounded-[40px] flex items-center justify-center relative overflow-hidden border border-[#431317]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
          <img 
            src="https://ik.imagekit.io/gambarid/SINEGU/test" 
            alt="SINEGU Illustration" 
            className="w-full max-w-[380px] h-auto object-contain z-10"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
