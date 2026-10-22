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
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [loading, setLoading] = useState(false);

  // Add Member Modal State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Create Group
  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return showToast('Group name is required.', 'error');
    setLoading(true);

    try {
      // Generate 8-char random invite code
      const inviteCode = Math.random().toString(36).substring(2, 10);

      // Insert group
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

      // Add creator as Admin member
      if (user?.id && groupData?.id) {
        await supabase
          .from('group_members')
          .insert([{
            group_id: groupData.id,
            user_id: user.id,
            role: 'admin',
            status: 'active',
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
    showToast('Invite link copied to clipboard!', 'success');
  }

  // 3. Add Member Directly & Dispatch In-App + Web Push Notification
  async function handleAddMemberDirect(e) {
    e.preventDefault();
    if (!memberEmail.trim() || !activeGroup) return;
    setLoading(true);

    try {
      // Find or create profile for invited user
      let targetUserId = null;
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', memberEmail.trim().toLowerCase())
        .single();

      if (existingProfile) {
        targetUserId = existingProfile.id;
      } else {
        // Create pending profile
        const { data: newProf } = await supabase
          .from('profiles')
          .insert([{
            id: crypto.randomUUID(),
            email: memberEmail.trim().toLowerCase(),
            full_name: memberName.trim() || memberEmail.split('@')[0],
          }])
          .select()
          .single();
        targetUserId = newProf?.id;
      }

      if (targetUserId) {
        // Add to group_members
        await supabase
          .from('group_members')
          .upsert([{
            group_id: activeGroup.id,
            user_id: targetUserId,
            role: 'member',
            status: 'active',
          }]);

        // Insert In-App Notification
        await supabase
          .from('notifications')
          .insert([{
            user_id: targetUserId,
            group_id: activeGroup.id,
            type: 'group_invite',
            title: `Added to ${activeGroup.name}`,
            message: `${profile?.full_name || 'Admin'} added you to the expense group "${activeGroup.name}".`,
          }]);

        // Trigger Real-time Push Notification via OneSignal API
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientIds: [targetUserId],
              heading: `👥 Added to ${activeGroup.name}`,
              content: `${profile?.full_name || 'A friend'} added you to "${activeGroup.name}". View shared expenses now.`,
              senderId: user?.id,
              type: 'system',
            }),
          });
        } catch (pushErr) {
          console.warn('Push notification dispatch note:', pushErr);
        }

        showToast(`Added ${memberName || memberEmail} to group!`, 'success');
        setMemberEmail('');
        setMemberName('');
        setIsAddingMember(false);
        onRefreshGroups();
      }
    } catch (err) {
      console.error('Error adding member:', err);
      showToast(err.message || 'Could not add member.', 'error');
    } finally {
      setLoading(false);
    }
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
              <p className="text-xs text-slate-400 font-medium">Active Group</p>
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
              <p className="font-bold text-slate-800 text-sm">Default Group</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeGroup?.invite_code && (
            <button
              type="button"
              onClick={copyInviteLink}
              className="btn btn-ghost text-xs py-1.5 px-3 border border-slate-200"
              title="Copy public invite link"
            >
              🔗 Share Link
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAddingMember(true)}
              className="btn btn-ghost text-xs py-1.5 px-3 border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              + Add Member
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="btn btn-primary text-xs py-1.5 px-3 font-semibold"
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
              Groups act as isolated multi-tenant expense sheets for trips, apartments, or events.
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

      {/* Modal: Add Member Direct */}
      {isAddingMember && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain animate-in fade-in duration-150">
          <div className="fixed inset-0" onClick={() => setIsAddingMember(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm sm:max-w-md my-auto bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[88vh] max-h-[88dvh] overflow-y-auto z-10">
            <h3 className="text-xl font-bold font-display text-slate-900">Add Member to {activeGroup?.name}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              They will receive an in-app invite and web push notification.
            </p>

            <form onSubmit={handleAddMemberDirect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Member Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Singh"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="vikram@example.com"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingMember(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary text-xs py-2 px-5 font-semibold"
                >
                  {loading ? 'Adding...' : 'Add & Send Notification'}
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
