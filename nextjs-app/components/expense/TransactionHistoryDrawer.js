'use client';

import { useEffect } from 'react';
import ExpenseList from '@/components/expense/ExpenseList';

export default function TransactionHistoryDrawer({
  isOpen,
  onClose,
  expenses = [],
  participants = [],
  currentUser,
  onDataChange,
}) {
  // Close on ESC key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-slate-800 leading-tight">
                Transaction History
              </h2>
              <p className="text-[11px] text-slate-400">
                All recorded expenses and recent activity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="badge badge-primary text-xs px-2 py-0.5">
              {expenses.length} {expenses.length === 1 ? 'item' : 'items'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
              title="Close (Esc)"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer Body: ExpenseList Component */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <ExpenseList
            expenses={expenses}
            participants={participants}
            currentUser={currentUser}
            onDataChange={onDataChange}
          />
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary text-xs py-1.5 px-4 font-semibold"
          >
            Close Menu
          </button>
        </div>
      </div>
    </div>
  );
}
