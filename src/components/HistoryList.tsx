
import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronRight, Clock, Trash2, RefreshCw, FileText, Search, XCircle, ChevronLeft, Filter, ImageIcon, Eye, ExternalLink, ArrowUpDown } from 'lucide-react';
import { MeetingHistoryItem } from '@/types';
import { deleteMeeting } from '@/services/firebase';
import DeleteModal from './DeleteModal';
import DrivePreviewModal from './DrivePreviewModal';

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
  const [previewItem, setPreviewItem] = useState<MeetingHistoryItem | null>(null);
  const [filterSort, setFilterSort] = useState<'newest' | 'oldest'>('newest');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'live'>('all');
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterSort, filterStatus]);

  const filteredHistory = useMemo(() => {
    let result = history;

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.title && item.title.toLowerCase().includes(lowerQuery)) || 
        (item.participants && item.participants.toLowerCase().includes(lowerQuery)) ||
        (item.subBagian && item.subBagian.toLowerCase().includes(lowerQuery))
      );
    }
    
    if (filterStatus !== 'all') {
      result = result.filter(item => item.status === filterStatus);
    }

    result = [...result].sort((a, b) => {
      const dateA = a.createdAt.getTime();
      const dateB = b.createdAt.getTime();
      return filterSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [history, searchQuery, filterStatus, filterSort]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
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
           
           <div className="flex items-center gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:flex-none sm:w-32">
                <select
                  value={filterSort}
                  onChange={(e) => setFilterSort(e.target.value as any)}
                  className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#431317]/10 focus:border-[#431317] transition-all appearance-none cursor-pointer"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>
             <div className="relative flex-1 sm:flex-none sm:w-40">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#431317]/10 focus:border-[#431317] transition-all appearance-none cursor-pointer"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="completed">Final (Selesai)</option>
                  <option value="live">Sedang Berlangsung</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
             </div>
           </div>
        </div>
      )}

      {/* Flat Table View */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {paginatedHistory.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-none">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider w-16 text-center">No</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider w-28">Tanggal</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Judul Rapat</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Peserta</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider w-24 text-center">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider w-32 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedHistory.map((item, index) => {
                  const globalRowIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => onSelect(item)}
                      className="group hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
                    >
                      <td className="px-6 py-5 text-center text-slate-400 font-bold">{globalRowIndex}</td>
                      <td className="px-6 py-5 text-slate-500 font-medium whitespace-nowrap">
                        {item.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 group-hover:text-[#431317] transition-colors truncate">
                            {item.title}
                          </span>
                          {item.photoUrls && item.photoUrls.length > 0 && (
                            <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold mt-1">
                              <ImageIcon className="w-2.5 h-2.5" />
                              {item.photoUrls.length} Dokumentasi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-slate-400 font-medium truncate max-w-[200px] hidden md:table-cell">
                        {item.participants || '-'}
                      </td>
                      <td className="px-6 py-5 text-center">
                        {item.status === 'live' ? (
                           <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-widest border border-amber-100 rounded">
                             <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                             LIVE
                           </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold uppercase tracking-widest border border-slate-100 rounded">
                            HISTORY
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                         <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                           {item.status === 'completed' && (
                             <>
                               <button
                                 onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                                 className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all"
                                 title="Lihat PDF"
                               >
                                 <Eye className="w-4 h-4" />
                               </button>
                               {item.driveWebViewLink && (
                                 <a
                                   href={item.driveWebViewLink}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   onClick={(e) => e.stopPropagation()}
                                   className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 rounded-xl transition-all"
                                   title="Buka di Google Drive"
                                 >
                                   <ExternalLink className="w-4 h-4" />
                                 </a>
                               )}
                             </>
                           )}
                           {item.transcriptSegments && item.transcriptSegments.length > 0 && item.status !== 'completed' && (
                             <button
                               onClick={(e) => handleRegenerateClick(e, item)}
                               className="p-2 text-slate-400 hover:text-[#431317] hover:bg-white border border-transparent hover:border-slate-100 rounded-xl transition-all"
                               title="Regenerate"
                             >
                               <RefreshCw className="w-4 h-4" />
                             </button>
                           )}
                           <button
                             onClick={(e) => handleDeleteClick(e, item.id, item.title)}
                             className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all"
                             title="Hapus"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                           <div className="p-2 text-slate-300">
                             <ChevronRight className="w-4 h-4" />
                           </div>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-3">
              {paginatedHistory.map((item, index) => {
                const globalRowIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                return (
                  <div 
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-300 transition-colors cursor-pointer relative"
                  >
                    <div className="flex justify-between items-start gap-3">
                       <div className="flex flex-col min-w-0">
                         <span className="text-[10px] text-slate-400 font-bold mb-1">
                           #{globalRowIndex} • {item.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                         </span>
                         <span className="font-bold text-slate-900 leading-tight">
                           {item.title}
                         </span>
                         {item.photoUrls && item.photoUrls.length > 0 && (
                            <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold mt-1.5">
                              <ImageIcon className="w-2.5 h-2.5" />
                              {item.photoUrls.length} Dokumentasi
                            </span>
                         )}
                       </div>
                       <div className="shrink-0 mt-1">
                         {item.status === 'live' ? (
                           <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-bold uppercase tracking-widest border border-amber-100 rounded">
                             <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                             LIVE
                           </span>
                         ) : (
                           <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-bold uppercase tracking-widest border border-slate-100 rounded">
                             FINAL
                           </span>
                         )}
                       </div>
                    </div>
                    
                    {item.participants && (
                       <div className="text-[11px] text-slate-500 line-clamp-1 border-t border-slate-50 pt-2 mt-1">
                         <span className="font-semibold text-slate-400 mr-1">Peserta:</span> {item.participants}
                       </div>
                    )}
                    
                    <div className="mt-1 pt-3 border-t border-slate-50 flex items-center justify-end gap-1.5">
                       {item.status === 'completed' && (
                         <>
                           <button
                             onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                             className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all"
                             title="Lihat PDF"
                           >
                             <Eye className="w-4 h-4" />
                           </button>
                           {item.driveWebViewLink && (
                             <a
                               href={item.driveWebViewLink}
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 rounded-xl transition-all"
                               title="Buka di Google Drive"
                             >
                               <ExternalLink className="w-4 h-4" />
                             </a>
                           )}
                         </>
                       )}
                       {item.transcriptSegments && item.transcriptSegments.length > 0 && item.status !== 'completed' && (
                         <button
                           onClick={(e) => handleRegenerateClick(e, item)}
                           className="p-2 text-slate-400 hover:text-[#431317] hover:bg-slate-50 rounded-xl transition-all"
                           title="Regenerate"
                         >
                           <RefreshCw className="w-4 h-4" />
                         </button>
                       )}
                       <button
                         onClick={(e) => handleDeleteClick(e, item.id, item.title)}
                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                         title="Hapus"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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

      {previewItem && (
        <DrivePreviewModal 
          item={previewItem} 
          onClose={() => setPreviewItem(null)} 
        />
      )}
    </div>
  );
};

const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export default HistoryList;
