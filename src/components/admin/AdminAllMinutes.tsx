import React, { useState, useEffect } from 'react';
import { FileText, Search, Calendar, User, Eye, X, Loader2, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { subscribeToAllMeetings } from '@/services/firebase';
import type { MeetingHistoryItem } from '@/types';

const AdminAllMinutes: React.FC = () => {
  const [meetings, setMeetings] = useState<MeetingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSubBagian, setFilterSubBagian] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'live'>('all');
  const [selected, setSelected] = useState<MeetingHistoryItem | null>(null);

  useEffect(() => {
    const unsub = subscribeToAllMeetings(data => {
      setMeetings(data as MeetingHistoryItem[]);
      setLoading(false);
    });
    return unsub;
  }, []);

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

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 h-full flex flex-col">
      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold text-[#111827]">Semua Notulensi</h2>
        <p className="text-xs text-slate-500 mt-0.5">Pantau seluruh hasil notulensi dari semua akun petugas.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
          <input
            type="text"
            placeholder="Cari judul, petugas, peserta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="relative w-40">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <select
              value={filterSubBagian}
              onChange={e => setFilterSubBagian(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all appearance-none cursor-pointer"
            >
              <option value="">Semua Sub-Bagian</option>
              {subBagianList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
          </div>
          <div className="relative w-32">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all appearance-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="completed">Selesai</option>
              <option value="live">Berlangsung</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* List */}
        <div className="lg:w-2/5 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-slate-100 shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Daftar Rapat</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-10 flex-1">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 flex-1 text-center">
              <FileText className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-xs font-bold text-slate-300">
                {meetings.length === 0 ? 'Belum ada notulensi' : 'Tidak ada yang cocok'}
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 custom-scrollbar divide-y divide-slate-50">
              {filtered.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors group ${
                    selected?.id === m.id
                      ? 'bg-[#431317]/5 border-l-2 border-[#431317]'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    m.status === 'live' ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'
                  }`}>
                    <FileText className={`w-3.5 h-3.5 ${m.status === 'live' ? 'text-amber-500' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${selected?.id === m.id ? 'text-[#431317]' : 'text-slate-900'}`}>
                      {m.title || '(Tanpa judul)'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {m.date || formatDate(m.createdAt)}
                      </span>
                      {m.subBagian && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold">
                          {m.subBagian}
                        </span>
                      )}
                    </div>
                    {m.status === 'live' ? (
                      <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50">
                        <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                        Recording
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">
                          Selesai
                        </span>
                        {m.driveWebViewLink && (
                          <div className="w-3.5 h-3.5 bg-blue-50 text-blue-500 rounded p-0.5 flex items-center justify-center">
                            <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-full h-full object-contain grayscale opacity-60" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-[#431317] shrink-0 mt-1 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col min-h-0">
          {!selected ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-6">
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Eye className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-300">Pilih notulensi</p>
              <p className="text-[10px] text-slate-200 mt-1">untuk melihat isi dokumen</p>
            </div>
          ) : (
            <>
              {/* Preview Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0">
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
                  <h3 className="text-base font-black text-slate-900 leading-tight">{selected.title}</h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {selected.date || formatDate(selected.createdAt)}
                    </span>
                    {selected.userDisplayName && (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <User className="w-3 h-3" /> {selected.userDisplayName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {selected.driveWebViewLink && (
                    <a
                      href={selected.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-3.5 h-3.5" />
                      Buka di Drive
                    </a>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Document Info Bar */}
              <div className="px-5 py-2.5 bg-white border-b border-slate-50 flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
                <div className="shrink-0">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Peserta</p>
                  <p className="text-[10px] text-slate-600 font-medium max-w-[200px] truncate">{selected.participants || '-'}</p>
                </div>
                <div className="shrink-0">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Format</p>
                  <p className="text-[10px] text-slate-600 font-medium">Google Docs / Draft</p>
                </div>
                <div className="shrink-0">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID Dokumen</p>
                  <p className="text-[10px] text-slate-600 font-mono">{selected.driveFileId?.substring(0, 8) || 'LOCAL-DRAFT'}...</p>
                </div>
              </div>

              {/* Preview Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50/30">
                <div className="max-w-2xl mx-auto my-6 p-8 sm:p-12 bg-white shadow-sm border border-slate-100 min-h-[500px]">
                  <header className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Berita Acara Notulensi</p>
                    <h4 className="text-sm font-black text-slate-900 uppercase">{selected.title}</h4>
                  </header>
                  
                  {selected.content ? (
                    <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-[11px] whitespace-pre-wrap">
                      {selected.content}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <FileText className="w-5 h-5 text-slate-200" />
                      </div>
                      <p className="text-xs font-bold text-slate-300">
                        {selected.status === 'live' ? 'Notulensi sedang direkam secara real-time...' : 'Isi notulensi belum tersedia.'}
                      </p>
                    </div>
                  )}
                  
                  {selected.status === 'completed' && (
                    <footer className="mt-12 pt-6 border-t border-slate-100 text-[9px] text-slate-400 italic">
                      Dokumen ini dihasilkan secara otomatis oleh sistem SINEGU pada {formatDate(selected.createdAt)}.
                    </footer>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAllMinutes;
