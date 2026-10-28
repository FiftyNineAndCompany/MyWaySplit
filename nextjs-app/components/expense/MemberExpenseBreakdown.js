'use client';

import { useState } from 'react';
import { EXPENSE_CATEGORIES } from '@/lib/splitEngine';

export default function MemberExpenseBreakdown({
  participants = [],
  expenses = [],
  currentUser,
}) {
  const [expandedMemberId, setExpandedMemberId] = useState(null);

  // Strictly deduplicate participants
  const uniqueParticipants = participants.filter((p, index, self) => {
    return index === self.findIndex(t => (
      (t.user_id && p.user_id && t.user_id === p.user_id) ||
      (t.id && p.id && t.id === p.id) ||
      (t.name && p.name && t.name.trim().toLowerCase() === p.name.trim().toLowerCase())
    ));
  });

  const activeExpenses = expenses.filter(e => !e.is_archived);
  const totalGroupSpend = activeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Compute stats for each participant
  const memberStats = uniqueParticipants.map(p => {
    const isYou = (p.user_id && p.user_id === currentUser) || (p.id && p.id === currentUser);

    // 1. All expenses paid by this participant
    const paidExpenses = activeExpenses.filter(e => {
      return e.paid_by === p.id || (p.user_id && e.paid_by === p.user_id);
    });

    const totalPaid = paidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // 2. Total share owed across all expenses
    let totalShare = 0;
    activeExpenses.forEach(exp => {
      const amount = Number(exp.amount) || 0;
      const splitList = Array.isArray(exp.split_among) && exp.split_among.length > 0
        ? exp.split_among
        : uniqueParticipants.map(part => part.id);

      const isInSplit = splitList.some(id => id === p.id || (p.user_id && id === p.user_id));
      if (isInSplit && splitList.length > 0) {
        totalShare += amount / splitList.length;
      }
    });

    const netBalance = totalPaid - totalShare;

    return {
      participant: p,
      isYou,
      paidExpenses,
      totalPaid,
      totalShare,
      netBalance,
    };
  });

  // Sort: current user first, then creditors descending, then debtors
  memberStats.sort((a, b) => {
    if (a.isYou) return -1;
    if (b.isYou) return 1;
    return b.netBalance - a.netBalance;
  });

  function toggleExpand(id) {
    setExpandedMemberId(prev => (prev === id ? null : id));
  }

  if (uniqueParticipants.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold font-display text-slate-800 mb-2">
          Member-Wise Expense Breakdown
        </h2>
        <p className="text-xs text-slate-400">
          No members found in this group yet. Invite members to see their spending breakdown.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-display text-slate-800">
              Member-Wise Breakdown
            </h2>
            <span className="badge badge-primary text-xs">
              {uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidated summary of what each individual has paid, owes, and net position
          </p>
        </div>

        {/* Total Sheet Spend Pill */}
        <div className="bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
          <span className="text-xs text-indigo-700 font-medium">Total Spend:</span>
          <span className="text-sm font-bold text-indigo-900 font-display">
            ₹{totalGroupSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Member Cards */}
      <div className="space-y-3">
        {memberStats.map(({ participant: p, isYou, paidExpenses, totalPaid, totalShare, netBalance }) => {
          const isExpanded = expandedMemberId === p.id;
          const isCreditor = netBalance > 0.01;
          const isDebtor = netBalance < -0.01;
          const isSettled = !isCreditor && !isDebtor;

          return (
            <div
              key={p.id}
              className={`border rounded-2xl transition-all duration-200 ${
                isYou
                  ? 'border-indigo-200 bg-indigo-50/20 shadow-sm'
                  : 'border-slate-200/80 bg-white hover:border-slate-300'
              }`}
            >
              {/* Member Main Row */}
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                {/* Member Info */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner shrink-0 ${
                      isYou
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">
                        {p.name}
                      </span>
                      {isYou && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 bg-indigo-600 text-white rounded">
                          You
                        </span>
                      )}
                      {p.upi_id && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-mono hidden sm:inline">
                          UPI: {p.upi_id}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>Paid: <strong className="text-slate-700 font-semibold">₹{totalPaid.toFixed(2)}</strong></span>
                      <span>•</span>
                      <span>Share: <strong className="text-slate-700 font-semibold">₹{totalShare.toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Net Balance & Accordion Toggle */}
                <div className="flex items-center justify-between w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      {isCreditor ? 'Gets Back' : isDebtor ? 'Owes' : 'Net'}
                    </span>
                    <span
                      className={`font-display font-extrabold text-sm sm:text-base ${
                        isCreditor
                          ? 'text-emerald-600'
                          : isDebtor
                          ? 'text-rose-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {isCreditor && '+'}
                      {isDebtor && '-'}
                      ₹{Math.abs(netBalance).toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition flex items-center gap-1 text-xs font-medium"
                    title={isExpanded ? 'Hide breakdown' : 'View breakdown'}
                  >
                    <span className="hidden sm:inline text-[11px] text-slate-500">
                      {paidExpenses.length} {paidExpenses.length === 1 ? 'item' : 'items'}
                    </span>
                    <svg
                      className={`w-4 h-4 transform transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Collapsible Itemized List of Expenses Paid by this Member */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4 rounded-b-2xl">
                  <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Expenses Paid by {p.name} ({paidExpenses.length})</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Total: ₹{totalPaid.toFixed(2)}
                    </span>
                  </h4>

                  {paidExpenses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      {p.name} has not paid for any recorded expenses in this sheet yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {paidExpenses.map(exp => {
                        const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
                        const dateStr = exp.created_at
                          ? new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : 'Recent';

                        const splitCount = Array.isArray(exp.split_among) && exp.split_among.length > 0
                          ? exp.split_among.length
                          : uniqueParticipants.length;

                        return (
                          <li
                            key={exp.id}
                            className="bg-white p-2.5 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">{cat.emoji}</span>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">
                                  {exp.description}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {dateStr} • Split between {splitCount} members
                                </p>
                              </div>
                            </div>

                            <span className="font-bold text-slate-900 font-display shrink-0 ml-2">
                              ₹{Number(exp.amount).toFixed(2)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
