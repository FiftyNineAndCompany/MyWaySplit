'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';
import { EXPENSE_CATEGORIES } from '@/lib/splitEngine';

export default function ExpenseForm({
  participants = [],
  activeGroup,
  activeGroupId,
  currentUser,
  currentUserName = 'You',
  onDataChange,
}) {
  const { showToast } = useToast();
  const currentGroupId = activeGroup?.id || activeGroupId;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Inclusions/Exclusions: Array of participant IDs who share this expense
  const [includedMemberIds, setIncludedMemberIds] = useState([]);

  // Synthesize current logged-in user into participants list if not already present
  const baseParticipants = [...participants];
  const hasCurrentUserInList = baseParticipants.some(
    p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser)
  );

  if (!hasCurrentUserInList && currentUser) {
    baseParticipants.unshift({
      id: currentUser,
      user_id: currentUser,
      name: currentUserName || 'You',
      isCurrentUser: true,
    });
  }

  // Strictly deduplicate participants by user_id, id, and normalized name so no person appears twice
  const uniqueParticipants = baseParticipants.filter((p, index, self) => {
    return index === self.findIndex(t => (
      (t.user_id && p.user_id && t.user_id === p.user_id) ||
      (t.id && p.id && t.id === p.id) ||
      (t.name && p.name && t.name.trim().toLowerCase() === p.name.trim().toLowerCase())
    ));
  });

  // Find current user's participant entry for immediate default selection
  const currentUserPart = uniqueParticipants.find(
    p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser) || p.isCurrentUser
  );
  const initialDefaultPayerId = currentUserPart ? currentUserPart.id : (uniqueParticipants[0]?.id || currentUser || '');

  // Default payerId directly on initial mount to logged-in member
  const [payerId, setPayerId] = useState(initialDefaultPayerId);

  // Auto-default payer to current user or first participant, and sync included members
  useEffect(() => {
    if (uniqueParticipants.length > 0) {
      const userPart = uniqueParticipants.find(
        p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser) || p.isCurrentUser
      );

      // If no payer selected or current payerId is no longer in list, default to current user
      if (!payerId || !uniqueParticipants.some(p => p.id === payerId)) {
        if (userPart) {
          setPayerId(userPart.id);
        } else if (uniqueParticipants[0]) {
          setPayerId(uniqueParticipants[0].id);
        }
      }

      if (includedMemberIds.length === 0) {
        setIncludedMemberIds(uniqueParticipants.map(p => p.id));
      }
    }
  }, [uniqueParticipants, currentUser, payerId, includedMemberIds.length]);

  function toggleMemberInclusion(id) {
    if (includedMemberIds.includes(id)) {
      if (includedMemberIds.length === 1) {
        showToast('At least one member must share the expense.', 'error');
        return;
      }
      setIncludedMemberIds(includedMemberIds.filter(mId => mId !== id));
    } else {
      setIncludedMemberIds([...includedMemberIds, id]);
    }
  }

  function selectAllMembers() {
    setIncludedMemberIds(uniqueParticipants.map(p => p.id));
  }

  function handleShareInvite() {
    if (!activeGroup?.invite_code) {
      showToast('No invite code found for this group.', 'error');
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/invite/${activeGroup.invite_code}`;
    navigator.clipboard.writeText(inviteUrl);
    showToast('🔗 Invite link copied to clipboard!', 'success');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentGroupId) {
      return showToast('Please select or create an expense group first.', 'error');
    }

    const parsedAmount = parseFloat(amount);

    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      return showToast('Please enter a valid description and positive amount.', 'error');
    }

    if (!payerId) {
      return showToast('Please select who paid for this expense.', 'error');
    }

    if (includedMemberIds.length === 0) {
      return showToast('Select at least one member to share this expense.', 'error');
    }

    setLoading(true);
    try {
      // Resolve payerId to ensure it matches a real participant row in Supabase
      let finalPayerId = payerId;
      const matchingPart = participants.find(p => p.id === payerId);

      if (!matchingPart || matchingPart.id === currentUser) {
        // Query database for existing participant record
        const { data: dbPart } = await supabase
          .from('participants')
          .select('id')
          .eq('group_id', currentGroupId)
          .eq('user_id', currentUser)
          .maybeSingle();

        if (dbPart?.id) {
          finalPayerId = dbPart.id;
        } else {
          // Create the participant row for current user in this group
          const { data: newPart, error: createPartErr } = await supabase
            .from('participants')
            .insert([{
              group_id: currentGroupId,
              user_id: currentUser,
              name: currentUserName || 'You',
            }])
            .select()
            .maybeSingle();

          if (!createPartErr && newPart?.id) {
            finalPayerId = newPart.id;
          }
        }
      }

      // Resolve split_among array with valid participant IDs
      const resolvedSplitAmong = includedMemberIds.map(id => {
        if (id === currentUser) return finalPayerId;
        return id;
      });

      const expensePayload = {
        description: description.trim(),
        amount: parsedAmount,
        paid_by: finalPayerId,
        category,
        split_among: resolvedSplitAmong.length > 0 ? resolvedSplitAmong : [finalPayerId],
        group_id: currentGroupId,
        is_archived: false,
      };

      if (editId) {
        const { error } = await supabase
          .from('expenses')
          .update(expensePayload)
          .eq('id', editId);
        if (error) throw error;
        showToast('Expense updated successfully!', 'success');
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expensePayload]);
        if (error) throw error;
        showToast('Expense recorded!', 'success');
      }

      resetForm();
      if (onDataChange) await onDataChange();
    } catch (err) {
      console.error('Supabase expense save error:', err);
      showToast(err.message || 'Failed to record expense. Please check group permissions.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditId(null);
    setDescription('');
    setAmount('');
    setCategory('food');
    // Re-default payer to current user
    const userPart = uniqueParticipants.find(
      p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser) || p.isCurrentUser
    );
    setPayerId(userPart ? userPart.id : (uniqueParticipants[0]?.id || currentUser || ''));
    setIncludedMemberIds(uniqueParticipants.map(p => p.id));
  }

  // Window bridge for edit trigger from ExpenseList
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__mws_editExpense = (exp) => {
        setEditId(exp.id);
        setDescription(exp.description);
        setAmount(String(exp.amount));
        setPayerId(exp.paid_by);
        setCategory(exp.category || 'other');
        setIncludedMemberIds(
          Array.isArray(exp.split_among) && exp.split_among.length > 0
            ? exp.split_among
            : participants.map(p => p.id)
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
  }, [participants]);

  const perPersonPreview = (Number(amount) > 0 && includedMemberIds.length > 0)
    ? (Number(amount) / includedMemberIds.length).toFixed(2)
    : '0.00';

  // Compute selected payer for display and verification
  const selectedPayer = uniqueParticipants.find(p => p.id === payerId) ||
    uniqueParticipants.find(p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser) || p.isCurrentUser) ||
    uniqueParticipants[0];
  const selectedPayerName = selectedPayer ? selectedPayer.name : (currentUserName || 'You');

  return (
    <div className="card p-6 fade-in-up">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-xl font-bold font-display text-slate-800">
          {editId ? 'Edit Expense' : '2. Record Expense'}
        </h2>
        {editId && (
          <span className="badge badge-warning text-[10px]">Editing</span>
        )}
      </div>

      {/* Viral Invite Banner: Allow generating and copying shareable link directly on Add Expenses */}
      {activeGroup?.invite_code && (
        <div className="mb-4 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🔗</span>
            <div>
              <p className="text-xs font-bold text-indigo-900">Invite Friends to this Sheet</p>
              <p className="text-[10px] text-indigo-600">They can join with 1 tap to split bills & settle</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleShareInvite}
            className="btn btn-primary text-xs py-1.5 px-3 font-semibold shadow-sm shrink-0 whitespace-nowrap"
          >
            Copy Link
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What was it for? (e.g. Italian Dinner, Fuel, Airbnb)"
            className="input"
          />
        </div>

        {/* Amount & Payer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount (₹) *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold pointer-events-none">
                ₹
              </span>
              <input
                type="number"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                className="input pl-8 font-semibold text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Paid By *</label>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                Default: {currentUserName || 'You'}
              </span>
            </div>
            <select
              required
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              className="input select font-medium text-slate-800"
            >
              {uniqueParticipants.length === 0 ? (
                <option value={currentUser || ''}>
                  {currentUserName || 'You'} (You - Default)
                </option>
              ) : (
                uniqueParticipants.map(p => {
                  const isYou = (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser) || p.isCurrentUser;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} {isYou ? '(You - Default)' : ''}
                    </option>
                  );
                })
              )}
            </select>

            {/* Clear Paid By confirmation banner under the Paid By section */}
            <div className="mt-1.5 flex items-center justify-between px-2.5 py-1.5 bg-emerald-50/80 border border-emerald-200/70 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-medium truncate">
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="truncate">
                  Paid by: <strong className="font-bold text-emerald-950">{selectedPayerName}</strong>
                  {selectedPayer && ((selectedPayer.user_id && selectedPayer.user_id === currentUser) || (selectedPayer.id && selectedPayer.id === currentUser) || selectedPayer.isCurrentUser) ? ' (You)' : ''}
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider shrink-0 ml-1">
                Payer
              </span>
            </div>
          </div>
        </div>

        {/* Category Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map(cat => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`text-xs py-2 px-2.5 rounded-xl border flex items-center gap-1.5 justify-center transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span className="truncate">{cat.label.split('&')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Splitting: Selective Inclusions / Exclusions */}
        {uniqueParticipants.length > 0 && (
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Split Among Members</p>
                <p className="text-[10px] text-slate-500">
                  {includedMemberIds.length === uniqueParticipants.length
                    ? 'Split equally among all members'
                    : `Split among ${includedMemberIds.length} of ${uniqueParticipants.length} members`}
                </p>
              </div>

              {includedMemberIds.length !== uniqueParticipants.length && (
                <button
                  type="button"
                  onClick={selectAllMembers}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  Select All
                </button>
              )}
            </div>

            {/* Member Checkbox Chips */}
            <div className="flex flex-wrap gap-2">
              {uniqueParticipants.map(p => {
                const isIncluded = includedMemberIds.includes(p.id);
                const isYou = p.user_id === currentUser || p.id === currentUser;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleMemberInclusion(p.id)}
                    className={`text-xs py-1.5 px-3 rounded-lg border flex items-center gap-1.5 transition-all ${
                      isIncluded
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400 line-through opacity-70'
                    }`}
                  >
                    <span>{isIncluded ? '✓' : '✕'}</span>
                    <span>{p.name}{isYou ? ' (You)' : ''}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Per-Person Preview */}
            {Number(amount) > 0 && (
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                <span>Calculated share per included member:</span>
                <span className="font-bold text-slate-900 font-display">
                  ₹{perPersonPreview} each
                </span>
              </div>
            )}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className={`btn flex-1 py-3 text-sm font-semibold shadow-md ${
              loading ? 'btn-ghost opacity-60' : 'btn-primary'
            }`}
          >
            {loading ? 'Saving...' : editId ? 'Update Expense' : 'Record Expense'}
          </button>

          {editId && (
            <button type="button" onClick={resetForm} className="btn btn-ghost text-xs">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
