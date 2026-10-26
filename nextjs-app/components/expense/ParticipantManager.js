'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';

export default function ParticipantManager({
  participants,
  activeGroup,
  currentUser,
  onDataChange,
  onIdentityChange,
  onIdentifyUser,
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const activeGroupId = activeGroup?.id || 'default';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return showToast('Name is required.', 'error');

    setLoading(true);
    try {
      const storedKey = `mywaysplit_custom_participants_${activeGroupId}`;
      const existing = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(storedKey) || '[]') : [];

      if (editId) {
        // Update existing participant
        const updated = existing.map(p =>
          p.id === editId
            ? { ...p, name: name.trim(), upi_id: upiId.trim() || '', phone: phone.trim() || '' }
            : p
        );
        localStorage.setItem(storedKey, JSON.stringify(updated));

        try {
          await supabase
            .from('participants')
            .update({ name: name.trim(), upi_id: upiId.trim() || null, phone: phone.trim() || null })
            .eq('id', editId);
        } catch (_) {}

        showToast('Participant updated!', 'success');
      } else {
        // Add new participant to active group sheet with a standard UUID
        const newParticipant = {
          id: crypto.randomUUID(),
          name: name.trim(),
          upi_id: upiId.trim() || '',
          phone: phone.trim() || '',
          role: 'member',
          group_id: activeGroupId,
        };

        const updated = [...existing, newParticipant];
        localStorage.setItem(storedKey, JSON.stringify(updated));

        try {
          const payloadWithGroup = {
            id: newParticipant.id,
            name: newParticipant.name,
            upi_id: newParticipant.upi_id || null,
            phone: newParticipant.phone || null,
            group_id: activeGroupId !== 'default' ? activeGroupId : null,
          };
          const { error: insErr } = await supabase
            .from('participants')
            .insert([payloadWithGroup]);

          if (insErr && insErr.code === 'PGRST204') {
            // Column group_id not present yet in schema cache, fallback without it
            await supabase.from('participants').insert([{
              id: newParticipant.id,
              name: newParticipant.name,
              upi_id: newParticipant.upi_id || null,
              phone: newParticipant.phone || null,
            }]);
          }
        } catch (dbEx) {
          console.warn('Participant DB insert note:', dbEx);
        }

        showToast(`Added ${name.trim()} to sheet!`, 'success');
      }

      resetForm();
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Participant save error:', err);
      showToast('Failed to save participant.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p) {
    setEditId(p.id);
    setName(p.name || '');
    setUpiId(p.upi_id || '');
    setPhone(p.phone || '');
  }

  function resetForm() {
    setEditId(null);
    setName('');
    setUpiId('');
    setPhone('');
  }

  async function handleDelete(id) {
    if (!confirm('Remove this participant from the sheet?')) return;
    try {
      const storedKey = `mywaysplit_custom_participants_${activeGroupId}`;
      const existing = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(storedKey) || '[]') : [];
      const updated = existing.filter(p => p.id !== id);
      localStorage.setItem(storedKey, JSON.stringify(updated));

      try {
        await supabase.from('group_members').delete().eq('group_id', activeGroupId).eq('user_id', id);
      } catch (_) {}

      try {
        await supabase.from('participants').delete().eq('id', id);
      } catch (_) {}

      showToast('Participant removed.', 'success');
      if (currentUser === id && onIdentityChange) onIdentityChange(null);
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete participant.', 'error');
    }
  }

  return (
    <div className="card p-6 fade-in-up">
      <h2 className="text-xl font-bold mb-4 font-display text-slate-800">
        {editId ? 'Edit Participant' : '1. Participants'}
      </h2>

      {/* Participant chips */}
      <div className="bg-slate-50 rounded-xl p-4 min-h-[56px] border border-slate-100 mb-5">
        {participants.length === 0 ? (
          <p className="text-slate-400 italic text-sm">No participants added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {participants.map(p => (
              <div
                key={p.id}
                className="bg-white border border-indigo-100 shadow-sm rounded-lg pl-3 pr-1 py-1.5 flex items-center gap-2 text-sm fade-in group"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-700 leading-tight">
                    {p.name}
                    {p.id === currentUser && (
                      <span className="text-indigo-500 ml-1">(You)</span>
                    )}
                  </span>
                  {(p.upi_id || p.phone) && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      {[p.upi_id, p.phone].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0 border-l border-slate-100 pl-1 ml-1 opacity-20 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(p)}
                    title="Edit"
                    className="text-indigo-400 hover:text-indigo-600 p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    title="Delete"
                    className="text-rose-400 hover:text-rose-600 p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Identify Yourself Selector */}
      {participants.length > 0 && (
        <div className="mb-5 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">👤</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Who are you?</p>
              <p className="text-[10px] text-slate-500">Highlights your personal balance & debts</p>
            </div>
          </div>
          <select
            value={currentUser || ''}
            onChange={(e) => {
              const val = e.target.value || null;
              if (onIdentityChange) onIdentityChange(val);
              if (onIdentifyUser) onIdentifyUser(val);
            }}
            className="input select text-xs py-1.5 px-3 w-auto min-w-[140px] bg-white font-medium text-slate-800"
          >
            <option value="">(None selected)</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Add/Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name (e.g., Rahul)"
          className="input"
        />
        <div className="flex gap-3">
          <input
            type="text"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="UPI ID (Optional)"
            className="input"
          />
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone No. (Optional)"
            className="input"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className={`btn flex-1 ${loading ? 'btn-ghost opacity-60' : 'btn-primary'}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full" viewBox="0 0 24 24" />
                Wait...
              </>
            ) : editId ? 'Update' : 'Add Participant'}
          </button>
          {editId && (
            <button type="button" onClick={resetForm} className="btn btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
