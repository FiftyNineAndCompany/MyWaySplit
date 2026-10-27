'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';

export default function GroupManager({
  groups,
  activeGroup,
  onSelectGroup,
  onRefreshGroups,
  isAdmin,
}) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Create New Group
  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return showToast('Group name is required.', 'error');
    setLoading(true);

    try {
      const inviteCode = Math.random().toString(36).substring(2, 10);

      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .insert([{
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          invite_code: inviteCode,
          created_by: user?.id || null,
        }])
        .select()
        .single();

      if (groupErr) throw groupErr;

      // Add creator as Admin in group_members
      if (user?.id && groupData?.id) {
        await supabase
          .from('group_members')
          .insert([{
            group_id: groupData.id,
            user_id: user.id,
            role: 'admin',
            status: 'active',
          }]);

        // Add creator as participant in participants table
        await supabase
          .from('participants')
          .insert([{
            user_id: user.id,
            group_id: groupData.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
          }]);
      }

      showToast(`Group "${groupData.name}" created!`, 'success');
      setNewGroupName('');
      setNewGroupDesc('');
      setIsCreating(false);
      await onRefreshGroups();
      onSelectGroup(groupData);
    } catch (err) {
      console.error('Error creating group:', err);
      showToast(err.message || 'Failed to create group.', 'error');
    } finally {
      setLoading(false);
    }
  }

  // 2. Copy Shareable Invite Link
  function copyInviteLink() {
    if (!activeGroup?.invite_code) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/invite/${activeGroup.invite_code}`;
    navigator.clipboard.writeText(inviteUrl);
    showToast('🔗 Invite link copied to clipboard!', 'success');
  }

  // 3. Share via WhatsApp
  function shareViaWhatsApp() {
    if (!activeGroup?.invite_code) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/invite/${activeGroup.invite_code}`;
    const text = encodeURIComponent(`Hey! Join our expense sheet "${activeGroup.name}" on MyWaySplit to track shared expenses and settle balances via UPI:\n${inviteUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
      {/* Top Header & Group Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg shadow-sm">
            👥
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {isAdmin ? 'Admin' : 'Member'}
              </span>
              <p className="text-xs text-slate-400 font-medium">Active Sheet</p>
            </div>
            {groups.length > 0 ? (
              <select
                value={activeGroup?.id || ''}
                onChange={e => {
                  const grp = groups.find(g => g.id === e.target.value);
                  if (grp) onSelectGroup(grp);
                }}
                className="font-bold text-slate-900 text-base bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            ) : (
              <p className="font-bold text-slate-800 text-sm">No Group Selected</p>
            )}
          </div>
        </div>

        {/* Action Buttons: Viral Invite & New Group */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {activeGroup?.invite_code && (
            <>
              <button
                type="button"
                onClick={shareViaWhatsApp}
                className="btn text-xs py-1.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                title="Share invite on WhatsApp"
              >
                💬 WhatsApp
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="btn btn-ghost text-xs py-1.5 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50"
                title="Copy public invite link"
              >
                🔗 Share Link
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="btn btn-primary text-xs py-1.5 px-3 font-semibold shadow-sm"
          >
            + New Group
          </button>
        </div>
      </div>

      {/* Modal: Create New Group */}
      {isCreating && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsCreating(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm sm:max-w-md my-auto bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[88vh] max-h-[88dvh] overflow-y-auto z-10">
            <h3 className="text-xl font-bold font-display text-slate-900">Create New Expense Group</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Groups act as isolated multi-tenant expense sheets for trips, flats, or events.
            </p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Group Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manali Trip 2026 or Flat 402 Rent"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Notes, dates, or purpose"
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary text-xs py-2 px-5 font-semibold"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
