
import React from 'react';
import { LayoutDashboard, Mic, History, ClipboardList } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'start', label: 'Mulai', icon: Mic },
    { id: 'list', label: 'Daftar', icon: ClipboardList },
  ];

  return (
    <nav className="sm:hidden fixed bottom-6 left-4 right-4 z-50">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-none flex items-center justify-around py-2.5 px-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 transition-all duration-200 px-3 py-1 rounded-xl ${
                isActive ? 'text-[#431317]' : 'text-slate-400'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-[#431317]/5' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#431317]' : 'text-slate-500'}`} />
              </div>
              <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
