import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Calendar, User, Eye, X, Loader2, 
  Filter, ChevronDown, ChevronRight, ChevronLeft, 
  ArrowLeft, ExternalLink
} from 'lucide-react';
import { subscribeToAllMeetings } from '@/services/firebase';
import type { MeetingHistoryItem } from '@/types';

const AdminAllMinutes: React.FC = () => {
  const [meetings, setMeetings] = useState<MeetingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSubBagian, setFilterSubBagian] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'live'>('all');
  const [selected, setSelected] = useState<MeetingHistoryItem | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const unsub = subscribeToAllMeetings(data => {
      setMeetings(data as MeetingHistoryItem[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterSubBagian, filterStatus]);

  const subBagianList = Array.from(new Set(meetings.map(m => m.subBagian).filter(Boolean)));

  const filtered = meetings.filter(m => {
    const matchSearch = 
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.userDisplayName?.toLowerCase().includes(search.toLowerCase()) ||
      m.participants?.toLowerCase().includes(search.toLowerCase());
    
    const matchSubBagian = !filterSubBagian || m.subBagian === filterSubBagian;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    
    return matchSearch && matchSubBagian && matchStatus;
  });

  // Paginated Data
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (selected) {
    return (
      <div className="p-4 sm:p-6 space-y-5 animate-in fade-in duration-300">
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelected(null)}
              className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all group"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-[#431317]" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                  selected.status === 'live' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selected.status === 'live' ? 'Live Monitoring' : 'Hasil Notulensi'}
                </span>
                {selected.subBagian && (
                  <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-[#431317] text-white rounded">
                    {selected.subBagian}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 leading-tight">{selected.title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selected.driveWebViewLink && (
              <a
                href={selected.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-sm transition-all active:scale-[0.98]"
              >
                <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-3.5 h-3.5" />
                Buka di Drive
              </a>
            )}
            <button
              onClick={() => setSelected(null)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-1 flex-col min-h-[500px]">
          {/* Info Bar */}
          <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-8 items-center">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waktu Rapat</p>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> {selected.date || formatDate(selected.createdAt)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Petugas Notulensi</p>
              <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> {selected.userDisplayName || '-'}
              </p>
            </div>
            <div className="space-y-0.5 max-w-xs shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peserta</p>
              <p className="text-xs font-medium text-slate-700 truncate">{selected.participants || '-'}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-12 bg-slate-50/20">
            <div className="max-w-3xl mx-auto bg-white border border-slate-100 p-8 sm:p-16 rounded-lg min-h-[600px] relative">
              <header className="border-b-2 border-[#431317] pb-6 mb-8 text-center relative">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#431317]/30 mb-2">Berita Acara Notulensi</p>
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selected.title}</h4>
              </header>
              
              {selected.content ? (
                <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-sm whitespace-pre-wrap font-medium">
                  {selected.content}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-4 border border-slate-100">
                    <FileText className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">
                    {selected.status === 'live' ? 'Notulensi sedang direkam secara real-time...' : 'Isi notulensi belum tersedia.'}
                  </p>
                </div>
              )}
              
              {selected.status === 'completed' && (
                <footer className="mt-20 pt-8 border-t border-slate-100 text-[10px] text-slate-400 italic flex justify-between items-center">
                   <span>Dokumen otomatis SINEGU - {formatDate(selected.createdAt)}</span>
                   <span className="font-bold uppercase tracking-widest text-[#431317]/30">Salinan Digital</span>
                </footer>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#111827] tracking-tight">Semua Notulensi</h2>
          <p className="text-xs text-slate-500 mt-1">Pantau dan kelola seluruh hasil rapat dari semua unit kerja.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#431317]/5 rounded-2xl border border-[#431317]/10">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Data:</span>
          <span className="text-sm font-black text-[#431317]">{filtered.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-50/50 p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul rapat, nama petugas, atau peserta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/10 focus:border-[#431317] transition-all"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterSubBagian}
              onChange={e => setFilterSubBagian(e.target.value)}
              className="w-full h-11 pl-12 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#431317]/10 focus:border-[#431317] transition-all appearance-none cursor-pointer"
            >
              <option value="">Semua Sub-Bagian</option>
              {subBagianList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative w-40">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full h-11 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#431317]/10 focus:border-[#431317] transition-all appearance-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="completed">Selesai</option>
              <option value="live">Berlangsung</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border-x border-b border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="hidden md:block overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Judul Rapat</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Waktu & Tanggal</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Kerja</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Petugas</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-[#431317]" />
                      <p className="text-xs font-bold text-slate-400">Memuat data notulensi...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-2">
                        <FileText className="w-6 h-6 text-slate-200" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">Tidak ada notulensi ditemukan</p>
                      <p className="text-[10px] text-slate-300">Coba ubah kata kunci pencarian atau filter Anda.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((m) => (
                  <tr 
                    key={m.id} 
                    className="group hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
                    onClick={() => setSelected(m)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                          m.status === 'live' 
                            ? 'bg-amber-50 border-amber-100 text-amber-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:border-[#431317]/20 group-hover:bg-white group-hover:text-[#431317]'
                        }`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 group-hover:text-[#431317] truncate transition-colors">
                            {m.title || '(Tanpa Judul)'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">ID: {m.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{formatDate(m.createdAt)}</span>
                        <span className="text-[10px] text-slate-400">{m.date || 'Rapat Harian'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {m.subBagian ? (
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-lg group-hover:bg-white group-hover:border-[#431317]/10 border border-transparent transition-all">
                          {m.subBagian}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#431317]/10 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-black text-[#431317]">
                            {m.userDisplayName?.charAt(0) || 'P'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-600">{m.userDisplayName || 'Petugas'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {m.status === 'live' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-widest border border-amber-100 rounded-lg">
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                          Recording
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest border border-emerald-100 rounded-lg">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-400">
                      <div className="flex items-center justify-end gap-2">
                        {m.driveWebViewLink && (
                          <a 
                            href={m.driveWebViewLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={e => e.stopPropagation()}
                            className="p-2 hover:bg-white hover:text-blue-500 rounded-xl transition-all border border-transparent hover:border-slate-100"
                            title="Buka Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button 
                          className="p-2 hover:bg-white hover:text-[#431317] rounded-xl transition-all border border-transparent hover:border-slate-100"
                          title="Lihat Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col gap-3 p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#f8fafc]/50">
          {loading ? (
             <div className="py-20 text-center flex flex-col items-center gap-3">
               <Loader2 className="w-8 h-8 animate-spin text-[#431317]" />
               <p className="text-xs font-bold text-slate-400">Memuat data notulensi...</p>
             </div>
          ) : filtered.length === 0 ? (
             <div className="py-20 text-center flex flex-col items-center gap-3">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 mb-2 shadow-sm">
                 <FileText className="w-6 h-6 text-slate-300" />
               </div>
               <p className="text-sm font-bold text-slate-400">Tidak ada notulensi ditemukan</p>
             </div>
          ) : (
            paginatedData.map((m) => (
              <div 
                key={m.id}
                onClick={() => setSelected(m)}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-[#431317]/30 transition-all cursor-pointer relative shadow-sm"
              >
                 <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold mb-1.5 uppercase tracking-widest">
                        {formatDate(m.createdAt)}
                      </span>
                      <span className="font-black text-slate-900 leading-tight text-base mb-1">
                        {m.title || '(Tanpa Judul)'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">ID: {m.id.substring(0, 8)}</span>
                    </div>
                    <div className="shrink-0">
                      {m.status === 'live' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-100 rounded-xl">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                          LIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100 rounded-xl">
                          FINAL
                        </span>
                      )}
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center text-[10px] font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-1">
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-5 h-5 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-[9px] font-black text-[#431317]">{m.userDisplayName?.charAt(0) || 'P'}</span>
                      </div>
                      {m.userDisplayName || 'Petugas'}
                    </div>
                    {m.subBagian && (
                      <span className="text-slate-400 uppercase tracking-widest">{m.subBagian}</span>
                    )}
                 </div>
                 
                 <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-1">
                    {m.driveWebViewLink && (
                      <a 
                        href={m.driveWebViewLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={e => e.stopPropagation()}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all"
                        title="Buka Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button className="p-2 text-slate-400 hover:text-[#431317] hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400">
              Menampilkan <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> dari <span className="text-slate-900">{filtered.length}</span> notulen
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
                className="p-2 rounded-xl text-slate-400 hover:bg-white hover:text-[#431317] border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentPage(i + 1); }}
                    className={`min-w-[32px] h-8 text-[11px] font-black rounded-lg transition-all ${
                      currentPage === i + 1
                        ? 'bg-[#431317] text-white'
                        : 'text-slate-500 hover:bg-white hover:text-[#431317] border border-transparent hover:border-slate-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(totalPages, prev + 1)); }}
                className="p-2 rounded-xl text-slate-400 hover:bg-white hover:text-[#431317] border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-slate-400 text-center font-medium">
        ⓘ Klik baris pada tabel untuk melihat isi lengkap dokumen dan mengunduh salinan.
      </p>
    </div>
  );
};

export default AdminAllMinutes;

