import React from 'react';
import { X, ExternalLink, Download, FileText, CloudOff } from 'lucide-react';
import { MeetingHistoryItem } from '@/types';

interface DrivePreviewModalProps {
  item: MeetingHistoryItem;
  onClose: () => void;
}

const DrivePreviewModal: React.FC<DrivePreviewModalProps> = ({ item, onClose }) => {
  const fileId = item.driveFileId;
  const webViewLink = item.driveWebViewLink;
  
  // Google Drive preview URL
  const previewUrl = fileId 
    ? `https://drive.google.com/file/d/${fileId}/preview` 
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full h-full max-w-6xl rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-[#431317]/5 flex items-center justify-center text-[#431317]">
               <FileText className="w-5 h-5" />
             </div>
             <div className="flex flex-col">
               <h3 className="text-sm font-black text-slate-900 leading-tight truncate max-w-[200px] sm:max-w-[400px]">
                 {item.title}
               </h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.date}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             {webViewLink && (
               <a 
                 href={webViewLink} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 text-[11px] font-black rounded-xl border border-slate-200 hover:bg-slate-100 transition-all uppercase tracking-wider"
               >
                 Open Drive
                 <ExternalLink className="w-3.5 h-3.5" />
               </a>
             )}
             <button 
               onClick={onClose}
               className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
             >
               <X className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* Modal Content / Preview Area */}
        <div className="flex-1 bg-slate-100 relative overflow-y-auto custom-scrollbar">
          {previewUrl ? (
            <iframe 
              src={previewUrl} 
              className="w-full h-full border-none"
              allow="autoplay"
              title={`Preview ${item.title}`}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white">
               <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-6 border border-red-100 text-red-400">
                 <CloudOff className="w-10 h-10" />
               </div>
               <h3 className="text-lg font-bold text-slate-900 mb-2">Pratinjau Tidak Tersedia</h3>
               <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-8">
                 Dokumen ini belum disinkronkan ke Google Drive atau ID file tidak ditemukan.
               </p>
               <button 
                onClick={onClose}
                className="px-8 py-3 bg-[#431317] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-none"
               >
                 KEMBALI KE GALERI
               </button>
            </div>
          )}
        </div>
        
        {/* Footer info (Mobile only action) */}
        <div className="sm:hidden px-6 py-4 bg-white border-t border-slate-100 flex justify-center">
            {webViewLink && (
               <a 
                 href={webViewLink} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-2 text-[11px] font-black text-[#431317] uppercase tracking-widest"
               >
                 Buka di Google Drive
                 <ExternalLink className="w-3.5 h-3.5" />
               </a>
             )}
        </div>
      </div>
    </div>
  );
};

export default DrivePreviewModal;
