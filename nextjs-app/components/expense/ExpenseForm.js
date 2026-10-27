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
  onDataChange,
}) {
  const { showToast } = useToast();
  const currentGroupId = activeGroup?.id || activeGroupId;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [category, setCategory] = useState('food');
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Inclusions/Exclusions: Array of participant IDs who share this expense
  const [includedMemberIds, setIncludedMemberIds] = useState([]);

  // Auto-default payer to current user or first participant, and sync included members
  useEffect(() => {
    if (participants.length > 0) {
      if (!payerId || !participants.some(p => p.id === payerId)) {
        const userPart = participants.find(p => p.user_id === currentUser || p.id === currentUser);
        if (userPart) {
          setPayerId(userPart.id);
        } else if (participants[0]) {
          setPayerId(participants[0].id);
        }
      }

      if (includedMemberIds.length === 0) {
        setIncludedMemberIds(participants.map(p => p.id));
      }
    }
  }, [participants, currentUser, payerId, includedMemberIds.length]);

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
    setIncludedMemberIds(participants.map(p => p.id));
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
      const expensePayload = {
        description: description.trim(),
        amount: parsedAmount,
        paid_by: payerId,
        category,
        split_among: includedMemberIds,
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
    const userPart = participants.find(p => p.user_id === currentUser || p.id === currentUser);
    setPayerId(userPart ? userPart.id : (participants[0]?.id || ''));
    setIncludedMemberIds(participants.map(p => p.id));
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Paid By *</label>
            <select
              required
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              className="input select font-medium text-slate-800"
            >
              <option value="">Who paid?</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
        {participants.length > 0 && (
          <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Split Among Members</p>
                <p className="text-[10px] text-slate-500">
                  {includedMemberIds.length === participants.length
                    ? 'Split equally among all members'
                    : `Split among ${includedMemberIds.length} of ${participants.length} members`}
                </p>
              </div>

              {includedMemberIds.length !== participants.length && (
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
              {participants.map(p => {
                const isIncluded = includedMemberIds.includes(p.id);
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
                    <span>{p.name}</span>
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
