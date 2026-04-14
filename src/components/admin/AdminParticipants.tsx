import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Loader2, X, Check, Users, Tag, Search, AlertCircle } from 'lucide-react';
import { 
  subscribeToParticipants, addParticipant, updateParticipant, deleteParticipant,
  subscribeToCategories, addCategory, updateCategory, deleteCategory
} from '@/services/firebase';
import type { Participant, MeetingCategory } from '@/types';

const AdminParticipants: React.FC = () => {
  const [tab, setTab] = useState<'participants' | 'categories'>('participants');

  // ── Participants State ──
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [pForm, setPForm] = useState({ name: '', jabatan: '' });
  const [editingP, setEditingP] = useState<Participant | null>(null);
  const [showPForm, setShowPForm] = useState(false);
  const [pSearch, setPSearch] = useState('');
  const [pSaving, setPSaving] = useState(false);
  const [deletingP, setDeletingP] = useState<string | null>(null);

  // ── Categories State ──
  const [categories, setCategories] = useState<MeetingCategory[]>([]);
  const [cLoading, setCLoading] = useState(true);
  const [cForm, setCForm] = useState({ name: '', description: '' });
  const [editingC, setEditingC] = useState<MeetingCategory | null>(null);
  const [showCForm, setShowCForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cSaving, setCSaving] = useState(false);
  const [deletingC, setDeletingC] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeToParticipants(data => { setParticipants(data as Participant[]); setPLoading(false); });
    const u2 = subscribeToCategories(data => { setCategories(data as MeetingCategory[]); setCLoading(false); });
    return () => { u1(); u2(); };
  }, []);

  // ── Participant CRUD ──
  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pForm.name.trim() || !pForm.jabatan.trim()) return;
    setPSaving(true);
    setError(null);
    try {
      if (editingP) {
        await updateParticipant(editingP.id, pForm.name.trim(), pForm.jabatan.trim());
      } else {
        await addParticipant(pForm.name.trim(), pForm.jabatan.trim());
      }
      setPForm({ name: '', jabatan: '' });
      setEditingP(null);
      setShowPForm(false);
    } catch { setError('Gagal menyimpan peserta.'); }
    finally { setPSaving(false); }
  };

  const handleDeleteParticipant = async (p: Participant) => {
    if (!window.confirm(`Hapus peserta "${p.name}"?`)) return;
    setDeletingP(p.id);
    try { await deleteParticipant(p.id); } catch { setError('Gagal menghapus.'); }
    finally { setDeletingP(null); }
  };

  // ── Category CRUD ──
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cForm.name.trim()) return;
    setCSaving(true);
    setError(null);
    try {
      if (editingC) {
        await updateCategory(editingC.id, cForm.name.trim(), cForm.description.trim(), editingC.participants || []);
      } else {
        await addCategory(cForm.name.trim(), cForm.description.trim(), []);
      }
      setCForm({ name: '', description: '' });
      setEditingC(null);
      setShowCForm(false);
    } catch { setError('Gagal menyimpan kategori.'); }
    finally { setCSaving(false); }
  };

  const handleDeleteCategory = async (c: MeetingCategory) => {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    setDeletingC(c.id);
    try { await deleteCategory(c.id); } catch { setError('Gagal menghapus.'); }
    finally { setDeletingC(null); }
  };

  // ── Category Participant Assignment ──
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  const isInCategory = (pId: string) => {
    return selectedCategory?.participants?.some(cp => cp.participantId === pId) || false;
  };

  const toggleParticipantInCategory = async (p: Participant) => {
    if (!selectedCategory) return;
    let newParticipants;
    if (isInCategory(p.id)) {
      newParticipants = selectedCategory.participants.filter(cp => cp.participantId !== p.id);
    } else {
      newParticipants = [
        ...(selectedCategory.participants || []),
        { participantId: p.id, name: p.name, jabatan: p.jabatan }
      ];
    }
    await updateCategory(selectedCategory.id, selectedCategory.name, selectedCategory.description || '', newParticipants);
  };

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(pSearch.toLowerCase()) ||
    p.jabatan.toLowerCase().includes(pSearch.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-[#111827]">Peserta & Kategori Rapat</h2>
        <p className="text-xs text-slate-500 mt-0.5">Kelola daftar peserta global dan kategori rapat beserta peserta defaultnya.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {[
          { id: 'participants', label: 'Daftar Peserta', icon: Users },
          { id: 'categories', label: 'Kategori Rapat', icon: Tag },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id
                ? 'bg-white text-[#431317] shadow-none border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PARTICIPANTS TAB ── */}
      {tab === 'participants' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input
                type="text"
                placeholder="Cari peserta..."
                value={pSearch}
                onChange={e => setPSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
              />
            </div>
            <button
              onClick={() => { setShowPForm(true); setEditingP(null); setPForm({ name: '', jabatan: '' }); setError(null); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#431317] text-white rounded-xl text-xs font-bold hover:bg-[#5a1a1f] transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah
            </button>
          </div>

          {/* Form */}
          {(showPForm || editingP) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleSaveParticipant} className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Lengkap</label>
                  <input
                    required
                    type="text"
                    placeholder="Nama peserta..."
                    value={pForm.name}
                    onChange={e => setPForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Jabatan</label>
                  <input
                    required
                    type="text"
                    placeholder="Jabatan/posisi..."
                    value={pForm.jabatan}
                    onChange={e => setPForm(p => ({ ...p, jabatan: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowPForm(false); setEditingP(null); }}
                    className="h-10 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="submit"
                    disabled={pSaving}
                    className="h-10 px-4 bg-[#431317] text-white text-xs font-bold rounded-xl hover:bg-[#5a1a1f] transition-all disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {pSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {editingP ? 'Simpan' : 'Tambah'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total: {filteredParticipants.length} peserta</p>
            </div>
            {pLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
            ) : filteredParticipants.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Users className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm font-bold text-slate-300">Belum ada peserta</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredParticipants.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 group transition-colors">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-slate-500 text-xs font-black">{p.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.jabatan}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingP(p); setPForm({ name: p.name, jabatan: p.jabatan }); setShowPForm(false); }}
                        className="p-2 sm:p-1.5 text-slate-400 hover:text-[#431317] hover:bg-[#431317]/5 rounded-lg transition-all active:scale-95"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteParticipant(p)}
                        disabled={deletingP === p.id}
                        className="p-2 sm:p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40 active:scale-95"
                      >
                        {deletingP === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowCForm(true); setEditingC(null); setCForm({ name: '', description: '' }); setError(null); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#431317] text-white rounded-xl text-xs font-bold hover:bg-[#5a1a1f] transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Kategori
            </button>
          </div>

          {(showCForm || editingC) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleSaveCategory} className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Kategori</label>
                  <input
                    required
                    type="text"
                    placeholder="cth: Rapat Pleno..."
                    value={cForm.name}
                    onChange={e => setCForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Deskripsi (opsional)</label>
                  <input
                    type="text"
                    placeholder="Keterangan kategori..."
                    value={cForm.description}
                    onChange={e => setCForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowCForm(false); setEditingC(null); }} className="h-10 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button type="submit" disabled={cSaving} className="h-10 px-4 bg-[#431317] text-white text-xs font-bold rounded-xl hover:bg-[#5a1a1f] transition-all disabled:opacity-60 flex items-center gap-1.5">
                    {cSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {editingC ? 'Simpan' : 'Buat'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category List */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kategori ({categories.length})</p>
              </div>
              {cLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
              ) : categories.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Tag className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-xs font-bold text-slate-300">Belum ada kategori</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {categories.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCategoryId(selectedCategoryId === c.id ? null : c.id)}
                      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors group ${
                        selectedCategoryId === c.id ? 'bg-[#431317]/5 border-l-2 border-[#431317]' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedCategoryId === c.id ? 'bg-[#431317]' : 'bg-slate-200'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${selectedCategoryId === c.id ? 'text-[#431317]' : 'text-slate-900'}`}>{c.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {c.participants?.length || 0} peserta default
                          {c.description && ` • ${c.description}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingC(c); setCForm({ name: c.name, description: c.description || '' }); setShowCForm(false); }}
                          className="p-2 sm:p-1.5 text-slate-400 hover:text-[#431317] hover:bg-[#431317]/5 rounded-lg transition-all active:scale-95"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteCategory(c); }}
                          disabled={deletingC === c.id}
                          className="p-2 sm:p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40 active:scale-95"
                        >
                          {deletingC === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Participant Assignment */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {selectedCategory ? `Peserta untuk: ${selectedCategory.name}` : 'Pilih kategori untuk assign peserta'}
                </p>
              </div>
              {!selectedCategory ? (
                <div className="flex flex-col items-center py-10 text-center px-4">
                  <Tag className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-xs font-bold text-slate-300">Klik kategori di sebelah kiri</p>
                  <p className="text-[10px] text-slate-200 mt-1">untuk mengatur peserta defaultnya</p>
                </div>
              ) : participants.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center px-4">
                  <Users className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-xs font-bold text-slate-300">Daftar peserta masih kosong</p>
                  <p className="text-[10px] text-slate-200 mt-1">Tambah peserta di tab "Daftar Peserta"</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto custom-scrollbar">
                  {participants.map(p => {
                    const checked = isInCategory(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleParticipantInCategory(p)}
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                          checked ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                        }`}>
                          {checked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{p.jabatan}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminParticipants;
