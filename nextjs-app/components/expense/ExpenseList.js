'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';
import { EXPENSE_CATEGORIES, filterRecentExpenses } from '@/lib/splitEngine';

export default function ExpenseList({
  expenses = [],
  participants = [],
  currentUser,
  onDataChange,
}) {
  const { showToast } = useToast();
  const [filter30Days, setFilter30Days] = useState(true);
  const [referenceTime, setReferenceTime] = useState(null);

  useEffect(() => {
    setReferenceTime(Date.now());
  }, []);

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      showToast('Expense deleted.', 'success');
      onDataChange();
    } catch {
      // Local fallback
      const stored = localStorage.getItem('mywaysplit_expenses');
      if (stored) {
        const list = JSON.parse(stored).filter(e => e.id !== id);
        localStorage.setItem('mywaysplit_expenses', JSON.stringify(list));
      }
      showToast('Expense removed.', 'success');
      onDataChange();
    }
  }

  function handleEdit(exp) {
    if (typeof window !== 'undefined' && window.__mws_editExpense) {
      window.__mws_editExpense(exp);
    }
  }

  // Apply 30-day filter
  const displayedExpenses = filter30Days ? filterRecentExpenses(expenses, 30, referenceTime) : expenses;
  const totalAmount = displayedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="card p-6">
      {/* Header & 30-Day Retention Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-800">
            Transaction History
          </h2>
          <p className="text-xs text-slate-400">
            {filter30Days
              ? 'Showing expenses from the last 30 days'
              : `Showing all ${expenses.length} recorded transactions`}
          </p>
        </div>

        {/* 30-Day Retention Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter30Days(true)}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter30Days
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => setFilter30Days(false)}
            className={`px-3 py-1 rounded-lg transition-all ${
              !filter30Days
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {/* Expense Items */}
      {displayedExpenses.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs italic">
          {filter30Days
            ? 'No expenses recorded in the last 30 days. Add a new expense above!'
            : 'No transaction history found.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
          {displayedExpenses.map(exp => {
            const payer = participants.find(p => p.id === exp.paid_by || p.user_id === exp.paid_by);
            const isUserPayer = exp.paid_by === currentUser || (payer && (payer.user_id === currentUser || payer.id === currentUser));
            const payerName = payer ? (isUserPayer ? `${payer.name} (You)` : payer.name) : (isUserPayer ? 'You' : 'Participant');
            const catInfo = EXPENSE_CATEGORIES.find(c => c.id === exp.category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

            // Determine split count
            const splitCount = Array.isArray(exp.split_among) && exp.split_among.length > 0
              ? exp.split_among.length
              : participants.length;

            const dateStr = exp.created_at
              ? new Date(exp.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: new Date(exp.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                })
              : 'Recently';

            return (
              <li
                key={exp.id}
                className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 fade-in group hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shadow-inner shrink-0">
                    {catInfo.emoji}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{exp.description}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catInfo.color}`}>
                        {catInfo.label.split('&')[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>Paid by <strong className="text-slate-600 font-medium">{payerName}</strong></span>
                      <span>•</span>
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium">
                        {splitCount === participants.length
                          ? 'Split among everyone'
                          : `Split between ${splitCount} of ${participants.length}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="font-black text-slate-900 text-base font-display">
                    ₹{Number(exp.amount).toFixed(2)}
                  </span>

                  <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleEdit(exp)}
                      className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id)}
                      className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Summary Footer */}
      {displayedExpenses.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">
            Total {filter30Days ? '(Last 30 Days)' : '(All Time)'}:
          </span>
          <span className="text-xl font-black font-display text-slate-900">
            ₹{totalAmount.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
