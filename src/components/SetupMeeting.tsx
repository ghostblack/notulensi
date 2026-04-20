
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, Type, Upload, FileText, ArrowRight, X, AlertCircle, Mic, Music, Users, Component, Tag, Plus, Search, MapPin, Clock } from 'lucide-react';
import { MeetingContext, InputMode } from '@/types';
import { getSubBagians, getCategories, getParticipants } from '@/services/firebase';

interface SetupMeetingProps {
  onNext: (data: MeetingContext) => void;
  onCancel: () => void;
}

// Chip component for participant tags
const ParticipantChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 group">
    <span className="text-[11px] max-w-[160px] truncate">{label}</span>
    <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
      <X className="w-3 h-3" />
    </button>
  </div>
);

const SetupMeeting: React.FC<SetupMeetingProps> = ({ onNext, onCancel }) => {
  const [inputMode, setInputMode] = useState<InputMode>('live');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [subBagian, setSubBagian] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState(new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace('.', ':'));
  const [endTime, setEndTime] = useState('');

  // Participants as array of "Nama - Jabatan" strings
  const [participantList, setParticipantList] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Firestore data
  const [subBagianList, setSubBagianList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [globalParticipants, setGlobalParticipants] = useState<any[]>([]);
  const [loadingSB, setLoadingSB] = useState(true);

  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Load Firestore data — pakai getDocs (baca sekali) bukan onSnapshot (real-time)
  // karena data sub-bagian/kategori/peserta tidak berubah saat user ngisi form
  useEffect(() => {
    const loadFormData = async () => {
      setLoadingSB(true);
      try {
        // Jalankan 3 fetch paralel sekaligus — lebih cepat dari satu per satu
        const [sbData, catData, partData] = await Promise.all([
          getSubBagians(),
          getCategories(),
          getParticipants(),
        ]);
        setSubBagianList(sbData);
        setCategories(catData);
        setGlobalParticipants(partData);
      } finally {
        setLoadingSB(false);
      }
    };
    loadFormData();
  }, []);

  // Recalculate fixed dropdown position based on trigger button
  const recalcDropdownPos = useCallback(() => {
    if (!triggerBtnRef.current) return;
    const r = triggerBtnRef.current.getBoundingClientRect();
    setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Close dropdown on outside click or when page scrolls/resizes
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = triggerBtnRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setShowParticipantDropdown(false);
      }
    };
    const handleScrollResize = () => setShowParticipantDropdown(false);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, []);

  // When category changes, auto-populate participants
  const handleCategoryChange = (catId: string) => {
    setSelectedCategoryId(catId);
    if (!catId) return;
    const cat = categories.find(c => c.id === catId);
    if (cat?.participants?.length) {
      const catPList = cat.participants.map((cp: any) => `${cp.name} - ${cp.jabatan}`);
      // Merge keeping existing manual entries
      const merged = Array.from(new Set([...catPList, ...participantList]));
      setParticipantList(merged);
    }
  };

  const addManualParticipant = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    if (!participantList.includes(trimmed)) {
      setParticipantList(prev => [...prev, trimmed]);
    }
    setManualInput('');
  };

  const addFromGlobal = (p: any) => {
    const label = `${p.name} - ${p.jabatan}`;
    if (!participantList.includes(label)) {
      setParticipantList(prev => [...prev, label]);
    }
    setShowParticipantDropdown(false);
    setParticipantSearch('');
  };

  const removeParticipant = (idx: number) => {
    setParticipantList(prev => prev.filter((_, i) => i !== idx));
  };

  const filteredGlobalParticipants = globalParticipants.filter(p => {
    const label = `${p.name} - ${p.jabatan}`;
    const inList = participantList.includes(label);
    const matchSearch = !participantSearch ||
      p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
      p.jabatan.toLowerCase().includes(participantSearch.toLowerCase());
    return !inList && matchSearch;
  });

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setAudioFile(e.target.files[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (participantList.length === 0) {
      setError("Mohon tambahkan minimal 1 peserta rapat.");
      return;
    }
    if (!subBagian) {
      setError("Mohon pilih sub-bagian rapat.");
      return;
    }
    
    onNext({
      title,
      date,
      subBagian,
      participants: participantList.join('\n'),
      location,
      startTime,
      endTime,
      inputMode,
      audioFile: inputMode === 'upload' ? audioFile : null,
      referenceFile: null,
    });
  };

  // Determine sub-bagian display name
  const getSubBagianDisplay = (code: string) => {
    const found = subBagianList.find(s => s.code === code);
    return found ? found.name : code;
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 h-full overflow-y-auto custom-scrollbar pr-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-1">
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#111827] tracking-tight">Konfigurasi Rapat</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">Lengkapi detail untuk memulai sesi notulensi otomatis.</p>
        </div>
        <button 
          onClick={onCancel} 
          className="p-2.5 text-slate-400 hover:text-[#431317] hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Column: Info Utama (8/12) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Informasi Utama</h3>
              </div>

              {/* Judul (Full) */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Judul Rapat</label>
                <div className="relative group">
                  <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                  <input 
                    required 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all" 
                    placeholder="Masukkan nama rapat..." 
                  />
                </div>
              </div>

              {/* Row 1: Tanggal + Tempat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tanggal</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <input 
                      type="date" 
                      required 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tempat</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <input 
                      value={location} 
                      onChange={e => setLocation(e.target.value)} 
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all" 
                      placeholder="Contoh: Ruang Rapat Lt. 2" 
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Waktu (Mulai + Selesai) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Mulai</label>
                  <div className="relative group">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={e => setStartTime(e.target.value)} 
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Selesai</label>
                  <div className="relative group">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={e => setEndTime(e.target.value)} 
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all" 
                      placeholder="Opsional"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Sub-Bagian + Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Sub-Bagian</label>
                  <div className="relative group">
                    <Component className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <select 
                      required 
                      value={subBagian} 
                      onChange={e => setSubBagian(e.target.value)} 
                      disabled={loadingSB}
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all appearance-none disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {loadingSB ? 'Memuat...' : 'Pilih...'}
                      </option>
                      {subBagianList.map(sb => (
                        <option key={sb.id} value={sb.code}>{sb.code}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Kategori</label>
                  <div className="relative group">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <select
                      value={selectedCategoryId}
                      onChange={e => handleCategoryChange(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all appearance-none"
                    >
                      <option value="">Tanpa kategori</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Peserta (Compact) */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center justify-between">
                  Daftar Peserta
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    participantList.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {participantList.length} total
                  </span>
                </label>

                {participantList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50/50 border border-slate-100 rounded-xl max-h-24 overflow-y-auto custom-scrollbar">
                    {participantList.map((p, i) => (
                      <ParticipantChip key={i} label={p} onRemove={() => removeParticipant(i)} />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <button
                      ref={triggerBtnRef}
                      type="button"
                      onClick={() => {
                        const next = !showParticipantDropdown;
                        if (next) recalcDropdownPos();
                        setShowParticipantDropdown(next);
                      }}
                      className="w-full h-10 flex items-center gap-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-500 hover:border-[#431317]/30 hover:text-[#431317] transition-all"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Daftar
                    </button>

                    {/* Dropdown fixed — tidak terpotong oleh overflow scroll container */}
                    {showParticipantDropdown && dropdownRect && (
                      <div
                        ref={dropdownRef}
                        style={{
                          position: 'fixed',
                          top: dropdownRect.top,
                          left: dropdownRect.left,
                          width: Math.max(dropdownRect.width, 220),
                          zIndex: 9999,
                        }}
                        className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-150"
                      >
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300" />
                            <input
                              type="text"
                              placeholder="Cari peserta..."
                              value={participantSearch}
                              onChange={e => setParticipantSearch(e.target.value)}
                              className="w-full h-8 pl-8 pr-3 text-xs font-medium bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#431317]/20"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto custom-scrollbar">
                          {filteredGlobalParticipants.length === 0 ? (
                            <p className="px-3 py-5 text-[10px] text-slate-400 text-center font-medium">Tidak ada peserta</p>
                          ) : (
                            filteredGlobalParticipants.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addFromGlobal(p)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors"
                              >
                                <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                  <Users className="w-3 h-3 text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{p.jabatan}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-[2] flex gap-2">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualParticipant(); } }}
                      placeholder="Nama - Jabatan"
                      className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#431317]/15 focus:border-[#431317] transition-all"
                    />
                    <button
                      type="button"
                      onClick={addManualParticipant}
                      className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-[#431317] hover:border-[#431317]/30 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Mode & Action (4/12) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <Mic className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Mode Pemrosesan</h3>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {[
                  { id: 'live', label: 'Live Mic', icon: Mic, desc: 'Rekam Sekarang' },
                  { id: 'upload', label: 'File Audio', icon: Music, desc: 'MP3, M4A, WAV, dll' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setInputMode(mode.id as InputMode)}
                    className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left ${
                      inputMode === mode.id 
                      ? 'border-[#431317] bg-[#431317] text-white shadow-none' 
                      : 'border-slate-100 bg-slate-50/50 text-slate-500 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <mode.icon className={`w-5 h-5 ${inputMode === mode.id ? 'text-white' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <span className="text-sm font-extrabold block">{mode.label}</span>
                      <span className={`text-[10px] ${inputMode === mode.id ? 'text-white/70' : 'text-slate-400'}`}>{mode.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              {inputMode === 'upload' && (
                <div className="animate-in slide-in-from-top-4 duration-300 pt-2">
                  <div 
                    className="p-4 border border-dashed border-slate-200 bg-slate-50/30 rounded-xl text-center cursor-pointer hover:bg-white hover:border-[#431317]/20 transition-all"
                    onClick={() => audioFileInputRef.current?.click()}
                  >
                    <input type="file" ref={audioFileInputRef} onChange={handleAudioFileChange} className="hidden" accept="audio/*" />
                    {audioFile ? (
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 bg-red-50 rounded-lg shrink-0">
                          <Music className="w-4 h-4 text-[#431317]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate">{audioFile.name}</span>
                          <span className="text-[10px] text-slate-400">Siap diproses</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <Upload className="w-4 h-4 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-500">Unggah Audio</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={(inputMode === 'upload' && !audioFile)}
              className="w-full bg-[#431317] hover:bg-[#5a1a1f] text-white h-16 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group shadow-none border border-[#431317]"
            >
              <div className="text-left">
                <span className="block text-sm uppercase tracking-widest">Mulai Sesi</span>
                <span className="block text-[9px] text-white/60 font-medium">Aktifkan Notulensi Otomatis</span>
              </div>
              <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* Global Errors */}
        {error && (
          <div className="mt-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-xs font-bold text-red-600 animate-in fade-in">
             <AlertCircle className="w-5 h-5 shrink-0" />
             {error}
          </div>
        )}
      </form>

      <input type="file" ref={audioFileInputRef} onChange={handleAudioFileChange} className="hidden" accept="audio/*" />
    </div>
  );
};

export default SetupMeeting;
