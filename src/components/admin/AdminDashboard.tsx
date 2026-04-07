import React, { useState, useEffect } from 'react';
import { 
  Users, LayoutDashboard, FileText, ChevronRight, LogOut, 
  Settings, FolderOpen, Menu, X, Shield, Bell
} from 'lucide-react';
import { auth, logOut, subscribeToAllMeetings, subscribeToUsers, seedDefaultSubBagians, db } from '@/services/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import AdminAccountManager from '@/components/admin/AdminAccountManager';
import AdminParticipants from '@/components/admin/AdminParticipants';
import AdminAllMinutes from '@/components/admin/AdminAllMinutes';
import AdminSubBagian from '@/components/admin/AdminSubBagian';
import type { User } from 'firebase/auth';

interface AdminDashboardProps {
  user: User;
}

type AdminPage = 'overview' | 'accounts' | 'participants' | 'minutes' | 'subbagian';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [activePage, setActivePage] = useState<AdminPage>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalMeetings, setTotalMeetings] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    seedDefaultSubBagians().catch(() => {});
    
    // Auto-repair Firestore record for admin if it's the known email
    const EMAIL = "admin@sinegu.kpu";
    const PASSWORD = "kingmu";
    const NAME = "Administrator SINEGU";

    if (user.email === EMAIL) {
      const repairAdmin = async () => {
        try {
          const adminRef = doc(db, "admins", user.uid);
          const snap = await getDoc(adminRef);
          if (!snap.exists()) {
            await setDoc(adminRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Administrator',
              role: "admin",
              createdAt: serverTimestamp()
            });
            console.log("Admin record repaired.");
          }
        } catch (e) {
          console.error("Failed to repair admin record:", e);
        }
      };
      repairAdmin();
    }

    const unsub1 = subscribeToAllMeetings((data) => setTotalMeetings(data.length));
    const unsub2 = subscribeToUsers((data) => setTotalUsers(data.length));
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const navItems: { id: AdminPage; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'overview',     label: 'Ringkasan',        icon: LayoutDashboard, desc: 'Dashboard utama' },
    { id: 'accounts',     label: 'Akun Petugas',     icon: Users,           desc: 'Kelola akun pengguna' },
    { id: 'participants', label: 'Daftar Peserta',   icon: FolderOpen,      desc: 'Peserta & kategori rapat' },
    { id: 'subbagian',   label: 'Sub-Bagian',        icon: Settings,        desc: 'Kelola unit kerja' },
    { id: 'minutes',      label: 'Semua Notulensi',  icon: FileText,        desc: 'Pantau semua dokumen' },
  ];

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] font-sans">
      {/* ── Sidebar ── */}
      <>
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/30 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} 
          />
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Logo */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#431317] rounded-xl flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-[#111827] tracking-tight">SINEGU Admin</p>
              <p className="text-[10px] text-slate-400 font-medium">Panel Kontrol</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-1 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                  activePage === item.id
                    ? 'bg-[#431317] text-white shadow-none'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${activePage === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{item.label}</p>
                  <p className={`text-[9px] truncate ${activePage === item.id ? 'text-white/60' : 'text-slate-400'}`}>{item.desc}</p>
                </div>
                {activePage === item.id && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
              </button>
            ))}
          </nav>

          {/* Admin Info + Logout */}
          <div className="p-3 border-t border-slate-100">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 bg-[#431317] rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-black">
                  {user.displayName?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || 'Admin'}</p>
                <p className="text-[9px] text-slate-400 truncate">{user.email}</p>
              </div>
              <button
                onClick={logOut}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      </>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-[#111827] truncate">
              {navItems.find(n => n.id === activePage)?.label || 'Dashboard'}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              {navItems.find(n => n.id === activePage)?.desc}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Admin Aktif</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {activePage === 'overview' && (
            <OverviewPage 
              totalMeetings={totalMeetings} 
              totalUsers={totalUsers} 
              user={user}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'accounts' && <AdminAccountManager />}
          {activePage === 'participants' && <AdminParticipants />}
          {activePage === 'subbagian' && <AdminSubBagian />}
          {activePage === 'minutes' && <AdminAllMinutes />}
        </main>
      </div>
    </div>
  );
};

// ─── Overview Page ───────────────────────────────────────────────
const OverviewPage: React.FC<{
  totalMeetings: number;
  totalUsers: number;
  user: User;
  onNavigate: (page: AdminPage) => void;
}> = ({ totalMeetings, totalUsers, user, onNavigate }) => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Greeting */}
      <div className="space-y-1">
        <p className="text-xs text-slate-500 font-medium">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">
          Selamat Datang, {user.displayName?.split(' ')[0] || 'Admin'} 👋
        </h2>
        <p className="text-xs text-slate-500">Panel kontrol administrator SINEGU KPU Gunungkidul.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Notulensi', value: totalMeetings, color: 'bg-[#431317]', textColor: 'text-white', sub: 'Semua akun' },
          { label: 'Akun Petugas', value: totalUsers, color: 'bg-white', textColor: 'text-slate-900', sub: 'Pengguna aktif' },
          { label: 'Kategori Rapat', value: '—', color: 'bg-white', textColor: 'text-slate-900', sub: 'Tipe rapat' },
          { label: 'Sub-Bagian', value: 4, color: 'bg-white', textColor: 'text-slate-900', sub: 'Unit kerja' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} rounded-2xl p-5 border border-slate-200 shadow-none`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${stat.color === 'bg-[#431317]' ? 'text-white/60' : 'text-slate-400'}`}>
              {stat.label}
            </p>
            <p className={`text-3xl font-black tracking-tighter ${stat.textColor}`}>{stat.value}</p>
            <p className={`text-[10px] font-medium mt-1 ${stat.color === 'bg-[#431317]' ? 'text-white/60' : 'text-slate-400'}`}>
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Aksi Cepat</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Tambah Akun Petugas', page: 'accounts' as AdminPage, icon: Users, desc: 'Buat akun notulensi baru' },
            { label: 'Kelola Peserta', page: 'participants' as AdminPage, icon: FolderOpen, desc: 'Atur daftar peserta rapat' },
            { label: 'Sub-Bagian', page: 'subbagian' as AdminPage, icon: Settings, desc: 'Kelola unit kerja' },
            { label: 'Lihat Semua Notulen', page: 'minutes' as AdminPage, icon: FileText, desc: 'Pantau hasil notulensi' },
          ].map((action, i) => (
            <button
              key={i}
              onClick={() => onNavigate(action.page)}
              className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-[#431317]/30 hover:shadow-none transition-all text-left group"
            >
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-[#431317]/5 group-hover:border-[#431317]/10 transition-colors shrink-0">
                <action.icon className="w-4 h-4 text-slate-400 group-hover:text-[#431317] transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">{action.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{action.desc}</p>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-300 mt-0.5 ml-auto shrink-0 group-hover:text-[#431317] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
