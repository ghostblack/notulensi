
import React from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  user?: {
    uid?: string | null;
    email?: string | null;
    photoURL?: string | null;
    displayName?: string | null;
  } | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onOpenProfile }) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Left Section (Empty to maintain justify-between or use justify-end) */}
        <div className="flex-1"></div>

        {/* User Section */}
        <div className="flex items-center gap-4">
          {user && (
            <>
              <button 
                onClick={onOpenProfile}
                className="hidden sm:flex flex-col items-end gap-0.5 hover:opacity-80 transition-opacity text-right"
              >
                <span className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</span>
                <span className="text-[10px] font-bold text-[#A62731] leading-none flex items-center gap-1">
                  ADMINISTRATOR
                </span>
              </button>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={onOpenProfile}
                  className="w-9 h-9 rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center hover:ring-2 ring-[#A62731] ring-offset-2 transition-all cursor-pointer relative"
                  title="Buka Profil & Tanda Tangan"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                
                <button 
                  onClick={onLogout}
                  className="p-2.5 text-slate-400 hover:text-[#431317] rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
