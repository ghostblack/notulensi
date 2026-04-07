
import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'LANJUTKAN', 
  cancelText = 'BATAL',
  variant = 'warning'
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 flex flex-col items-center text-center">
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 border ${isDanger ? 'bg-red-50 border-red-100 text-red-500' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
            <AlertCircle className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{title}</h3>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            {message}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-4 px-6 rounded-2xl text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all active:scale-95 border border-slate-100 uppercase tracking-widest"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-4 px-6 rounded-2xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg uppercase tracking-widest ${isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-200 border border-red-600' : 'bg-[#431317] hover:bg-[#5a1a1f] shadow-maroon/20 border border-[#431317]'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
