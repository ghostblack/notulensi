import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Calendar, 
  Users, 
  ExternalLink, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Download, 
  Trash2,
  Clock,
  ChevronRight,
  Bookmark,
  ImageIcon,
  ClipboardList
} from 'lucide-react';
import { MeetingHistoryItem } from '@/types';
import DrivePreviewModal from './DrivePreviewModal';

interface MinutesGalleryProps {
  items: MeetingHistoryItem[];
  onSelect: (item: MeetingHistoryItem) => void;
  onDelete: (id: string, title: string) => void;
}

const MinutesGallery: React.FC<MinutesGalleryProps> = ({ items, onSelect, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [previewItem, setPreviewItem] = useState<MeetingHistoryItem | null>(null);

  const filteredItems = useMemo(() => {
    const allItems = items;
    if (!searchQuery.trim()) return allItems;
    const lower = searchQuery.toLowerCase();
    return allItems.filter(item => 
      item.title.toLowerCase().includes(lower) || 
      (item.participants && item.participants.toLowerCase().includes(lower))
    );
  }, [items, searchQuery]);

  // Format relative time (e.g., "2 days ago")
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Hari ini';
    if (diffInDays === 1) return 'Kemarin';
    if (diffInDays < 7) return `${diffInDays} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]/50">
      {/* Search & Filter Header */}
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-10 bg-[#f8fafc]/80 backdrop-blur-md">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#431317] transition-colors" />
          <input 
            type="text"
            placeholder="Cari notulensi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/5 focus:border-[#431317] transition-all shadow-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-none">
             <Filter className="w-3.5 h-3.5" />
             <span>TERBARU</span>
           </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                className="group bg-white rounded-[2rem] p-6 border border-slate-200 hover:border-[#431317]/20 transition-all duration-300 flex flex-col shadow-none relative overflow-hidden"
              >
                {/* Top Section: Icon & Date */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#431317]/5 flex items-center justify-center text-[#431317] group-hover:bg-[#431317] group-hover:text-white transition-all duration-300">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPU Notulensi</h4>
                        <p className="text-[11px] font-medium text-slate-500">{getRelativeTime(item.createdAt)}</p>
                    </div>
                  </div>
                  <button className="p-2 text-slate-300 hover:text-slate-600 rounded-full transition-colors">
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>

                {/* Title & Info */}
                <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight group-hover:text-[#431317] transition-colors line-clamp-2 min-h-[3.5rem]">
                  {item.title}
                </h3>

                {/* Metadata Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {item.status === 'completed' ? (
                    <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      FINAL
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-[9px] font-bold text-blue-600 uppercase tracking-wider animate-pulse">
                      LIVE
                    </span>
                  )}
                  {item.photoUrls && item.photoUrls.length > 0 && (
                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <ImageIcon className="w-2.5 h-2.5" />
                      {item.photoUrls.length} MEDIA
                    </span>
                  )}
                </div>

                {/* Details list */}
                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-slate-500">
                    <Calendar className="w-4 h-4 shrink-0 text-slate-300" />
                    <span className="text-xs font-medium">{item.date}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <Users className="w-4 h-4 shrink-0 text-slate-300" />
                    <span className="text-xs font-medium truncate">{item.participants || 'Rapat Internal'}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-auto flex gap-3 pt-4 border-t border-slate-50">
                   {item.status === 'completed' ? (
                     <button 
                      onClick={() => setPreviewItem(item)}
                      className="flex-1 bg-[#431317] text-white py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider hover:bg-[#5a1a1f] transition-all active:scale-[0.98] shadow-none"
                     >
                       Preview
                     </button>
                   ) : (
                     <button 
                      onClick={() => onSelect(item)}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-[0.98] shadow-none"
                     >
                       Lanjutkan
                     </button>
                   )}
                   <button 
                    onClick={() => onSelect(item)}
                    className="aspect-square bg-slate-50 border border-slate-200 text-slate-400 p-3 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-[0.98]"
                    title="Buka Detail"
                   >
                     <ChevronRight className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in">
             <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 border border-slate-100">
                <ClipboardList className="w-8 h-8 text-slate-200" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 mb-2">Belum Ada Notulensi</h3>
             <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
               Semua notulensi yang telah difinalisasi akan tersimpan di galeri ini secara otomatis.
             </p>
          </div>
        )}
      </div>

      {previewItem && (
        <DrivePreviewModal 
          item={previewItem} 
          onClose={() => setPreviewItem(null)} 
        />
      )}
    </div>
  );
};

export default MinutesGallery;
