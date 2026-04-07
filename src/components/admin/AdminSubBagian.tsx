import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, Check, Settings, AlertCircle } from 'lucide-react';
import { subscribeToSubBagians, addSubBagian, updateSubBagian, deleteSubBagian } from '@/services/firebase';
import type { SubBagian } from '@/types';

const AdminSubBagian: React.FC = () => {
  const [subBagians, setSubBagians] = useState<SubBagian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubBagian | null>(null);
  const [form, setForm] = useState({ code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToSubBagians(data => {
      setSubBagians(data as SubBagian[]);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateSubBagian(editing.id, form.code.trim().toUpperCase(), form.name.trim());
        setSuccess(`Sub-bagian "${form.name}" berhasil diperbarui.`);
      } else {
        await addSubBagian(form.code.trim().toUpperCase(), form.name.trim());
        setSuccess(`Sub-bagian "${form.name}" berhasil ditambahkan.`);
      }
      setForm({ code: '', name: '' });
      setEditing(null);
      setShowForm(false);
    } catch {
      setError('Gagal menyimpan sub-bagian.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sb: SubBagian) => {
    if (!window.confirm(`Hapus sub-bagian "${sb.name}"? Data yang sudah terhubung tidak akan terhapus.`)) return;
    setDeleting(sb.id);
    setError(null);
    try {
      await deleteSubBagian(sb.id);
      setSuccess(`Sub-bagian "${sb.name}" dihapus.`);
    } catch {
      setError('Gagal menghapus sub-bagian.');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (sb: SubBagian) => {
    setEditing(sb);
    setForm({ code: sb.code, name: sb.name });
    setShowForm(false);
    setError(null);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ code: '', name: '' });
    setError(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[#111827]">Manajemen Sub-Bagian</h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola unit kerja / sub-bagian yang tersedia dalam sistem.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ code: '', name: '' }); setError(null); setSuccess(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#431317] text-white rounded-xl text-xs font-bold hover:bg-[#5a1a1f] transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-medium text-emerald-700 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0" />{success}
          <button onClick={() => setSuccess(null)} className="ml-auto">✕</button>
        </div>
      )}

      {/* Form */}
      {(showForm || editing) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 animate-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-bold text-slate-900 mb-4">
            {editing ? `Edit: ${editing.name}` : 'Tambah Sub-Bagian Baru'}
          </h3>
          <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="w-full sm:w-32 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kode</label>
              <input
                required
                type="text"
                placeholder="cth: KUL"
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                maxLength={20}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap Sub-Bagian</label>
              <input
                required
                type="text"
                placeholder="Nama lengkap sub-bagian..."
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#431317]/20 focus:border-[#431317] transition-all"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={cancelForm} className="h-10 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
              <button type="submit" disabled={saving} className="h-10 px-4 bg-[#431317] text-white text-xs font-bold rounded-xl hover:bg-[#5a1a1f] transition-all disabled:opacity-60 flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editing ? 'Perbarui' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sub-Bagian ({subBagians.length})</p>
          <div className="text-[10px] text-slate-400">4 data default (KUL, RENDATIN, SDMPARMAS, HUKUMTEKNIS)</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : subBagians.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <Settings className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-sm font-bold text-slate-300">Belum ada sub-bagian</p>
            <p className="text-[10px] text-slate-200 mt-1">Data default akan muncul setelah halaman dimuat ulang</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {subBagians.map(sb => (
              <div key={sb.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 group transition-colors">
                {/* Code Badge */}
                <div className="shrink-0 px-2.5 py-1 bg-[#431317]/8 border border-[#431317]/10 rounded-lg">
                  <span className="text-[#431317] text-[10px] font-black tracking-widest">{sb.code}</span>
                </div>
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{sb.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Ditambahkan: {sb.createdAt instanceof Date 
                      ? sb.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '-'}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(sb)}
                    className="p-1.5 text-slate-400 hover:text-[#431317] hover:bg-[#431317]/5 rounded-lg transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(sb)}
                    disabled={deleting === sb.id}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
                  >
                    {deleting === sb.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 font-medium">
        ⓘ Sub-bagian ini akan muncul di dropdown "Sub-Bagian" pada form konfigurasi rapat petugas.
      </p>
    </div>
  );
};

export default AdminSubBagian;
