
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronRight, Clock, Trash2, RefreshCw, FileText, Search, XCircle, ChevronLeft, Filter, ImageIcon } from 'lucide-react';
import { MeetingHistoryItem } from '@/types';
import { deleteMeeting } from '@/services/firebase';
import DeleteModal from './DeleteModal';

interface HistoryListProps {
  history: MeetingHistoryItem[];
  onSelect: (item: MeetingHistoryItem) => void;
  onRegenerate: (item: MeetingHistoryItem) => void;
  hideHeader?: boolean;
}

const ITEMS_PER_PAGE = 15;

const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onRegenerate, hideHeader = false }) => {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const lowerQuery = searchQuery.toLowerCase();
    return history.filter(item => 
      item.title.toLowerCase().includes(lowerQuery) || 
      (item.participants && item.participants.toLowerCase().includes(lowerQuery))
    );
  }, [history, searchQuery]);

  const groupedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    const groups: { [key: string]: MeetingHistoryItem[] } = {};
    
    paginatedItems.forEach(item => {
      const date = item.createdAt;
      const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(item);
    });
    
    return groups;
  }, [filteredHistory, currentPage]);

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);

  const handleDeleteClick = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setDeleteTarget({ id, title });
  };

  const handleRegenerateClick = (e: React.MouseEvent, item: MeetingHistoryItem) => {
    e.stopPropagation();
    onRegenerate(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMeeting(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      alert("Gagal menghapus riwayat.");
    } finally {
      setIsDeleting(false);
    }
  };

  let globalRowIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]/40">
      {/* Minimalist Toolbar */}
      {!hideHeader && (
        <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/60 bg-white sticky top-0 z-10">
           <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-[#431317] transition-colors" />
              <input 
                type="text"
                placeholder="Cari kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="shadcn-input h-10 pl-10 pr-10 bg-white border-slate-200 shadow-none text-xs font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
           </div>
           
           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest">
             <Filter className="w-3 h-3 text-slate-300" />
             <span>Filter</span>
           </div>
        </div>
      )}

      {/* Systematic Table View */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {Object.keys(groupedHistory).length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-none">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">No</th>
                  <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-widest w-28">Tanggal</th>
                  <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-widest">Judul Rapat</th>
                  <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Peserta</th>
                  <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-widest w-24 text-center">Status</th>
                  <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-widest w-32 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(groupedHistory).map(([groupLabel, items]) => (
                  <React.Fragment key={groupLabel}>
                    {/* Period Header Row */}
                    <tr className="bg-[#f8fafc]/80">
                      <td colSpan={6} className="px-5 py-2 text-[10px] font-black text-[#431317] uppercase tracking-[0.15em] border-y border-slate-100/50">
                        {groupLabel}
                      </td>
                    </tr>
                    
                    {items.map((item) => {
                      globalRowIndex++;
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => onSelect(item)}
                          className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-4 text-center text-slate-400 font-bold">{globalRowIndex}</td>
                          <td className="px-5 py-4 text-slate-500 font-medium">
                            {item.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 group-hover:text-[#431317] transition-colors">
                                {item.title}
                              </span>
                              {item.photoUrls && item.photoUrls.length > 0 && (
                                <span className="flex items-center gap-1 text-[9px] text-emerald-500 font-bold mt-1">
                                  <ImageIcon className="w-2.5 h-2.5" />
                                  {item.photoUrls.length} Dokumentasi
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-400 font-medium truncate max-w-[200px] hidden md:table-cell">
                            {item.participants || '-'}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {item.status === 'live' ? (
                               <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-tight">
                                 <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span> LIVE
                               </span>
                            ) : (
                              <span className="inline-flex items-center text-[9px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-tight">
                                HISTORY
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                             <div className="flex items-center justify-end gap-1 opacity-10 sm:opacity-0 group-hover:opacity-100 transition-all">
                               {item.transcriptSegments && item.transcriptSegments.length > 0 && (
                                 <button
                                   onClick={(e) => handleRegenerateClick(e, item)}
                                   className="p-1.5 text-slate-400 hover:text-[#431317] hover:bg-slate-100 rounded-lg transition-all"
                                   title="Regenerate"
                                 >
                                   <RefreshCw className="w-3.5 h-3.5" />
                                 </button>
                               )}
                               <button
                                 onClick={(e) => handleDeleteClick(e, item.id, item.title)}
                                 className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-all"
                                 title="Hapus"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                               <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
               <FileText className="w-6 h-6 text-slate-200" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              {searchQuery ? 'Hasil Tidak Ditemukan' : 'Belum Ada Arsip'}
            </h3>
            <p className="text-xs text-slate-400 font-medium max-w-[200px] leading-relaxed">
              {searchQuery ? `Pencarian "${searchQuery}" nihil.` : 'Data rapat yang telah selesai akan tercatat secara sistematis di sini.'}
            </p>
          </div>
        )}
      </div>

      {/* Modern Slim Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {currentPage} / {totalPages}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 disabled:opacity-20 hover:bg-slate-50 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 disabled:opacity-20 hover:bg-slate-50 transition-all active:scale-95"
            >
               <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <DeleteModal 
        isOpen={!!deleteTarget}
        title={deleteTarget?.title || ''}
        isDeleting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export default HistoryList;
