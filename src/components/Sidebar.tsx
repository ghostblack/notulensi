
import React from 'react';
import { LayoutDashboard, Mic, History, ClipboardList } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'start', label: 'Mulai Rapat', icon: Mic },
    { id: 'list', label: 'Daftar Notulen', icon: ClipboardList },
  ];

  return (
    <aside className="hidden sm:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 py-8 px-4 shrink-0">
      <div className="flex items-center gap-3 px-2 mb-10">
        <img 
          src="https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309" 
          alt="Logo KPU" 
          className="w-9 h-9 object-contain"
        />
        <div className="flex flex-col">
          <h1 className="font-bold text-slate-900 text-lg leading-tight">E - Notulensi</h1>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">KPU Kab. Gunungkidul</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-[#431317] text-white border border-[#431317]' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
