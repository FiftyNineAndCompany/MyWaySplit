'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';

export default function CreditorUpiCard({
  participants = [],
  expenses = [],
  currentUser,
  currentUserName,
  profile,
  activeGroupId,
  onDataChange,
}) {
  const { showToast } = useToast();
  const [upiInput, setUpiInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Find current user participant
  const userPart = participants.find(
    p => (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser)
  );

  const initialUpi = userPart?.upi_id || profile?.upi_id || '';

  useEffect(() => {
    if (initialUpi) {
      setUpiInput(initialUpi);
    }
  }, [initialUpi]);

  if (!currentUser) return null;

  // Set of all identifier variations for the currently logged-in user
  const currentUserIdSet = new Set();
  if (currentUser) currentUserIdSet.add(currentUser);
  participants.forEach(p => {
    if (p.user_id === currentUser || p.id === currentUser) {
      if (p.id) currentUserIdSet.add(p.id);
      if (p.user_id) currentUserIdSet.add(p.user_id);
    }
  });

  // Calculate current user's net balance across active expenses
  let userPaid = 0;
  let userShare = 0;

  const activeExpenses = expenses.filter(e => !e.is_archived);

  activeExpenses.forEach(exp => {
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) return;

    // Check if user is the payer
    const isPayer = currentUserIdSet.has(exp.paid_by);
    if (isPayer) {
      userPaid += amount;
    }

    // Check if user shares the expense
    const splitList = Array.isArray(exp.split_among) && exp.split_among.length > 0
      ? exp.split_among
      : participants.map(p => p.id);

    const isInSplit = splitList.length === 0 || splitList.some(id => currentUserIdSet.has(id));

    if (isInSplit && splitList.length > 0) {
      userShare += amount / splitList.length;
    }
  });

  const netBalance = userPaid - userShare;

  // STRICT CONDITIONAL LOGIC:
  // Render ONLY if user is a CREDITOR (is owed money > 0.01).
  // If user is a debtor (owes money) or balanced (net <= 0.01), HIDE ENTIRELY!
  if (netBalance <= 0.01) {
    return null;
  }

  async function handleSaveUpi(e) {
    e.preventDefault();
    const cleanUpi = upiInput.trim();

    setSaving(true);
    try {
      // 1. Update user profile
      await supabase
        .from('profiles')
        .update({ upi_id: cleanUpi || null })
        .eq('id', currentUser);

      // 2. Update participant row for this active group
      if (activeGroupId) {
        await supabase
          .from('participants')
          .update({ upi_id: cleanUpi || null })
          .eq('group_id', activeGroupId)
          .or(`user_id.eq.${currentUser},id.eq.${currentUser}`);
      }

      showToast(
        cleanUpi
          ? '✓ UPI ID saved! Debtors can now pay you directly.'
          : 'UPI ID removed.',
        'success'
      );
      setIsEditing(false);
      if (onDataChange) await onDataChange();
    } catch (err) {
      console.error('Failed to save UPI ID:', err);
      showToast('Failed to update UPI ID. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-300/80 rounded-2xl p-4 sm:p-5 shadow-sm fade-in-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center text-xl shrink-0 font-bold">
            💰
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                You are a Creditor
              </span>
              <span className="text-xs text-emerald-900 font-bold">
                Owed ₹{netBalance.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5">
              Add your UPI ID so group members can pay you with 1 tap. (Optional)
            </p>
          </div>
        </div>

        {initialUpi && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-emerald-700 font-semibold hover:underline shrink-0"
          >
            Edit UPI
          </button>
        )}
      </div>

      {initialUpi && !isEditing ? (
        <div className="flex items-center justify-between bg-white/80 border border-emerald-200/90 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold">✓</span>
            <span className="text-xs text-slate-700 font-medium">Your UPI ID:</span>
            <span className="font-mono text-xs font-bold text-slate-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {initialUpi}
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold uppercase">
            Active for Debtors
          </span>
        </div>
      ) : (
        <form onSubmit={handleSaveUpi} className="space-y-2 mt-2">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={upiInput}
              onChange={e => setUpiInput(e.target.value)}
              placeholder="e.g. 9876543210@paytm or yourname@oksbi (Optional)"
              className="input text-xs font-mono w-full"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="submit"
                disabled={saving}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 shadow-sm w-full sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save UPI'}
              </button>
              {initialUpi && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-ghost text-xs py-2 px-3 text-slate-500"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Optional: If left blank, group members can still settle up with you in cash or external transfer.
          </p>
        </form>
      )}
    </div>
  );
}
