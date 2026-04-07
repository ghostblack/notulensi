
import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Type, Upload, FileText, ArrowRight, X, CheckCircle2, AlertCircle, Loader2, Mic, Music, Sparkles, Users, Component, Tag, Plus, Search } from 'lucide-react';
import { MeetingContext, InputMode } from '@/types';
import { analyzeDocumentStyle } from '@/services/geminiService';
import { subscribeToSubBagians, subscribeToCategories, subscribeToParticipants } from '@/services/firebase';

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

  // Participants as array of "Nama - Jabatan" strings
  const [participantList, setParticipantList] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [documentationPhotos, setDocumentationPhotos] = useState<File[]>([]);
  
  const [refFile, setRefFile] = useState<File | null>(null);
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);
  const [styleStatus, setStyleStatus] = useState<'none' | 'analyzing' | 'success' | 'error'>('none');
  const [styleGuide, setStyleGuide] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Firestore data
  const [subBagianList, setSubBagianList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [globalParticipants, setGlobalParticipants] = useState<any[]>([]);
  const [loadingSB, setLoadingSB] = useState(true);

  const refFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load Firestore data
  useEffect(() => {
    const u1 = subscribeToSubBagians(data => { setSubBagianList(data as any); setLoadingSB(false); });
    const u2 = subscribeToCategories(data => setCategories(data as any));
    const u3 = subscribeToParticipants(data => setGlobalParticipants(data as any));
    return () => { u1(); u2(); u3(); };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowParticipantDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRefFile(e.target.files[0]);
      setStyleStatus('none');
      setStyleGuide(null);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setAudioFile(e.target.files[0]);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setDocumentationPhotos(prev => [...prev, ...filesArray]);
    }
  };

  const removePhoto = (index: number) => {
    setDocumentationPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyzeStyle = async () => {
    if (!refFile) return;
    setIsAnalyzingRef(true);
    setStyleStatus('analyzing');
    setError(null);
    try {
      const res = await analyzeDocumentStyle(refFile);
      setStyleGuide(res);
      setStyleStatus('success');
    } catch {
      setError("Gagal menganalisis gaya dokumen.");
      setStyleStatus('error');
    } finally {
      setIsAnalyzingRef(false);
    }
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
      inputMode,
      referenceFile: refFile,
      styleGuide: styleGuide || undefined,
      audioFile: inputMode === 'upload' ? audioFile : null,
      documentationPhotos: documentationPhotos.length > 0 ? documentationPhotos : undefined
    });
  };

  // Determine sub-bagian display name
  const getSubBagianDisplay = (code: string) => {
    const found = subBagianList.find(s => s.code === code);
    return found ? found.name : code;
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 h-full overflow-y-auto custom-scrollbar pr-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="space-y-1">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Main Content Column (Left - 7/12) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Box 1: Info Utama */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <FileText className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Informasi Utama</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Judul Rapat</label>
                  <div className="relative group">
                    <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <input 
                      required 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all" 
                      placeholder="Masukkan nama rapat..." 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tanggal Rapat</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <input 
                      type="date" 
                      required 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sub-Bagian — from Firestore */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Sub-Bagian</label>
                  <div className="relative group">
                    <Component className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <select 
                      required 
                      value={subBagian} 
                      onChange={e => setSubBagian(e.target.value)} 
                      disabled={loadingSB}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all appearance-none disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {loadingSB ? 'Memuat...' : 'Pilih Sub-Bagian...'}
                      </option>
                      {subBagianList.map(sb => (
                        <option key={sb.id} value={sb.code}>{sb.code} — {sb.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Kategori Rapat — optional category selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                    Kategori Rapat <span className="text-slate-300 font-normal normal-case">(opsional)</span>
                  </label>
                  <div className="relative group">
                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#431317] transition-colors" />
                    <select
                      value={selectedCategoryId}
                      onChange={e => handleCategoryChange(e.target.value)}
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all appearance-none"
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
                  {selectedCategoryId && (
                    <p className="text-[10px] text-emerald-600 font-medium ml-1">
                      ✓ Peserta dari kategori otomatis ditambahkan
                    </p>
                  )}
                </div>
              </div>

              {/* Participants Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-2">
                  Daftar Peserta
                  <span className="text-slate-300 font-normal normal-case">(Nama - Jabatan)</span>
                  <span className={`ml-auto text-[9px] px-2 py-0.5 rounded font-bold ${
                    participantList.length > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                  }`}>
                    {participantList.length} peserta
                  </span>
                </label>

                {/* Participant Chips */}
                {participantList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50/50 border border-slate-100 rounded-xl min-h-[52px]">
                    {participantList.map((p, i) => (
                      <ParticipantChip key={i} label={p} onRemove={() => removeParticipant(i)} />
                    ))}
                  </div>
                )}

                {/* Add from global / manual */}
                <div className="flex gap-2">
                  {/* Global dropdown */}
                  <div className="relative flex-1" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowParticipantDropdown(p => !p)}
                      className="w-full h-10 flex items-center gap-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-500 hover:border-[#431317]/30 hover:text-[#431317] transition-all"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Pilih dari Daftar
                    </button>
                    {showParticipantDropdown && (
                      <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-150">
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300" />
                            <input
                              type="text"
                              placeholder="Cari peserta..."
                              value={participantSearch}
                              onChange={e => setParticipantSearch(e.target.value)}
                              className="w-full h-8 pl-8 pr-3 text-xs font-medium bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-[#431317]/30"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredGlobalParticipants.length === 0 ? (
                            <p className="px-3 py-4 text-xs text-slate-400 text-center font-medium">
                              {globalParticipants.length === 0 ? 'Belum ada peserta di database' : 'Semua peserta sudah ditambahkan'}
                            </p>
                          ) : (
                            filteredGlobalParticipants.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addFromGlobal(p)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                              >
                                <div className="w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-black text-slate-500">{p.name.charAt(0)}</span>
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

                  {/* Manual input */}
                  <div className="flex-1 flex gap-1.5">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualParticipant(); } }}
                      placeholder="Manual: Nama - Jabatan"
                      className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                    />
                    <button
                      type="button"
                      onClick={addManualParticipant}
                      className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-[#431317] hover:border-[#431317]/30 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 2: Gaya Referensi */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <Sparkles className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Gaya Referensi</h3>
                </div>
                {styleStatus === 'success' && (
                   <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase">Sudah Dipelajari</span>
                )}
              </div>

              {!refFile ? (
                <button 
                  type="button" 
                  onClick={() => refFileInputRef.current?.click()} 
                  className="w-full py-6 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-[#431317] hover:border-[#431317]/30 flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <Upload className="w-6 h-6 text-slate-300 group-hover:text-[#431317] transition-colors" />
                  <span>Klik untuk Unggah Template (.PDF/.DOCX)</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <FileText className="w-5 h-5 text-[#431317]" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-slate-900 truncate">{refFile.name}</span>
                      <span className="text-[9px] text-slate-500">Template Terpilih</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setRefFile(null); setStyleStatus('none'); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
                  {styleStatus === 'none' && (
                    <button 
                      type="button" 
                      onClick={handleAnalyzeStyle} 
                      className="h-11 px-4 bg-[#431317] text-white rounded-xl text-xs font-bold hover:bg-[#5a1a1f] transition-all flex items-center gap-2"
                    >
                      Mempelajari
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Side Column (Right - 5/12) */}
          <div className="lg:col-span-5 space-y-5 flex flex-col">
            {/* Box 3: Mode Pemrosesan */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <Mic className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Mode Pemrosesan</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'live', label: 'Live Mic', icon: Mic, desc: 'Rekam Langsung' },
                  { id: 'upload', label: 'File Audio', icon: Music, desc: 'Gunakan MP3/WAV' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setInputMode(mode.id as InputMode)}
                    className={`group flex flex-col items-start p-4 rounded-xl border transition-all duration-300 text-left ${
                      inputMode === mode.id 
                      ? 'border-[#431317] bg-[#431317] text-white shadow-none' 
                      : 'border-slate-100 bg-slate-50/50 text-slate-500 hover:border-slate-200 hover:bg-white'
                    }`}
                  >
                    <mode.icon className={`w-5 h-5 mb-3 ${inputMode === mode.id ? 'text-white' : 'text-slate-400'}`} />
                    <span className="text-xs font-extrabold block mb-1">{mode.label}</span>
                    <span className={`text-[9px] ${inputMode === mode.id ? 'text-white/70' : 'text-slate-400'}`}>{mode.desc}</span>
                  </button>
                ))}
              </div>

              {inputMode === 'upload' && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                  <div 
                    className="p-4 border border-dashed border-slate-200 bg-slate-50/30 rounded-xl text-center cursor-pointer hover:bg-white hover:border-[#431317]/20 transition-all"
                    onClick={() => audioFileInputRef.current?.click()}
                  >
                    <input type="file" ref={audioFileInputRef} onChange={handleAudioFileChange} className="hidden" accept="audio/*" />
                    {audioFile ? (
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2 bg-red-50 rounded-lg">
                          <Music className="w-4 h-4 text-[#431317]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold text-slate-900 truncate">{audioFile.name}</span>
                          <span className="text-[9px] text-slate-400">File audio siap diproses</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-1">
                        <Upload className="w-4 h-4 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-500">Unggah Berkas Audio</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Box 4: Dokumentasi */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 flex-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <Upload className="w-4 h-4 text-slate-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Dokumentasi</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {documentationPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-slate-100 group">
                    <img src={URL.createObjectURL(photo)} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute inset-0 bg-red-600/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {documentationPhotos.length < 10 && (
                  <button 
                    type="button" 
                    onClick={() => photoInputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-slate-200 bg-slate-50/10 flex flex-col items-center justify-center gap-1 hover:bg-slate-50 hover:border-[#431317]/30 transition-all font-bold text-slate-400"
                  >
                    <Upload className="w-4 h-4 text-slate-300" />
                    <span className="text-[8px] uppercase tracking-tighter">Unggah</span>
                  </button>
                )}
              </div>
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={(inputMode === 'upload' && !audioFile) || styleStatus === 'analyzing'} 
              className="w-full bg-[#431317] hover:bg-[#5a1a1f] text-white h-16 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group shadow-none border border-[#431317]"
            >
              <div className="text-left">
                <span className="block text-sm uppercase tracking-widest">Mulai Sekarang</span>
                <span className="block text-[9px] text-white/60 font-medium">Sistem Notulensi akan segera aktif</span>
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

      <input type="file" ref={refFileInputRef} onChange={handleRefFileChange} className="hidden" accept=".pdf,.docx" />
      <input type="file" ref={photoInputRef} onChange={handlePhotoChange} className="hidden" accept="image/*" multiple />
    </div>
  );
};

export default SetupMeeting;
