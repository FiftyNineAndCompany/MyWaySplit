'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';

export default function ParticipantManager({
  participants = [],
  activeGroup,
  currentUser,
  currentUserName = 'You',
  onDataChange,
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const activeGroupId = activeGroup?.id;

  // Synthesize current logged-in user into participants if not already present
  const baseParticipants = [...participants];
  const hasUserInList = baseParticipants.some(
    p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser)
  );

  if (!hasUserInList && currentUser) {
    baseParticipants.unshift({
      id: currentUser,
      user_id: currentUser,
      name: currentUserName || 'You',
    });
  }

  // Strictly deduplicate participants by user_id, id, and normalized name
  const uniqueParticipants = baseParticipants.filter((p, index, self) => {
    return index === self.findIndex(t => (
      (t.user_id && p.user_id && t.user_id === p.user_id) ||
      (t.id && p.id && t.id === p.id) ||
      (t.name && p.name && t.name.trim().toLowerCase() === p.name.trim().toLowerCase())
    ));
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return showToast('Name is required.', 'error');
    if (!activeGroupId) return showToast('Please select or create an expense group first.', 'error');

    // Prevent duplicate member names
    if (!editId && uniqueParticipants.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      return showToast(`"${name.trim()}" is already a member of this sheet.`, 'error');
    }

    setLoading(true);
    try {
      if (editId) {
        // Update existing participant
        await supabase
          .from('participants')
          .update({
            name: name.trim(),
            upi_id: upiId.trim() || null,
            phone: phone.trim() || null,
          })
          .eq('id', editId);

        showToast('Participant updated!', 'success');
      } else {
        // Add participant to active group sheet
        const newId = crypto.randomUUID();
        const { error: insErr } = await supabase
          .from('participants')
          .insert([{
            id: newId,
            group_id: activeGroupId,
            name: name.trim(),
            upi_id: upiId.trim() || null,
            phone: phone.trim() || null,
          }]);

        if (insErr) throw insErr;
        showToast(`Added ${name.trim()} to group!`, 'success');
      }

      resetForm();
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Participant save error:', err);
      showToast(err.message || 'Failed to save participant.', 'error');
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
    if (!confirm('Remove this member from the sheet?')) return;
    try {
      await supabase.from('participants').delete().eq('id', id);
      await supabase.from('group_members').delete().eq('group_id', activeGroupId).eq('user_id', id);

      showToast('Member removed.', 'success');
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete member.', 'error');
    }
  }

  return (
    <div className="card p-6 fade-in-up">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-xl font-bold font-display text-slate-800">
          {editId ? 'Edit Sheet Member' : '1. Sheet Members'}
        </h2>
        <span className="badge badge-primary">{uniqueParticipants.length}</span>
      </div>

      {/* Participant chips */}
      <div className="bg-slate-50 rounded-xl p-3 min-h-[56px] border border-slate-100 mb-5">
        {uniqueParticipants.length === 0 ? (
          <p className="text-slate-400 italic text-sm">No members added yet. Share your invite link or add members below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {uniqueParticipants.map(p => {
              const isYou = p.id === currentUser || p.user_id === currentUser;
              return (
                <div
                  key={p.id}
                  className={`border shadow-sm rounded-xl pl-3 pr-2 py-1.5 flex items-center gap-2 text-sm fade-in transition ${
                    isYou
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="leading-tight flex items-center gap-1">
                      {p.name}
                      {isYou && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 bg-indigo-600 text-white rounded">
                          You
                        </span>
                      )}
                    </span>
                    {(p.upi_id || p.phone) && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        {[p.upi_id, p.phone].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>

                  {!isYou && (
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5 ml-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        title="Edit details"
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        title="Remove from sheet"
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Member Name (e.g., Sarah)"
          className="input"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="UPI ID (Optional, e.g. sarah@okhdfc)"
            className="input text-xs"
          />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone (Optional, for reminders)"
            className="input text-xs"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className={`btn flex-1 ${loading ? 'btn-ghost opacity-60' : 'btn-primary'}`}
          >
            {loading ? 'Saving...' : editId ? 'Update Member' : '+ Add Member to Sheet'}
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
