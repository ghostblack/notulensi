
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  isDeleting?: boolean;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, title, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-none border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border border-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Riwayat?</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-800">"{title}"</span>? Data ini akan hilang permanen dari sistem.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-3.5 px-6 rounded-xl text-sm font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all active:scale-95 border border-slate-100"
            >
              BATAL
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-3.5 px-6 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-none transition-all active:scale-95 disabled:opacity-50 border border-red-600"
            >
              {isDeleting ? 'MENGHAPUS...' : 'YA, HAPUS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
