'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import GroupManager from '@/components/groups/GroupManager';
import ParticipantManager from '@/components/expense/ParticipantManager';
import ExpenseForm from '@/components/expense/ExpenseForm';
import ExpenseList from '@/components/expense/ExpenseList';
import SettlementPlan from '@/components/expense/SettlementPlan';
import OneSignalProvider from '@/components/notifications/OneSignalProvider';
import AuthModal from '@/components/auth/AuthModal';
import { calculateSettlements } from '@/lib/splitEngine';

export default function Home() {
  const { user, profile } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Load Groups for Authenticated User
  const loadGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setActiveGroup(null);
      setParticipants([]);
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setGroups(data);
        const storedActiveId = localStorage.getItem('mywaysplit_active_group_id');
        const found = data.find(g => g.id === storedActiveId) || data[0];
        setActiveGroup(found);
      } else {
        setGroups([]);
        setActiveGroup(null);
      }
    } catch (err) {
      console.warn('Groups fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 2. Load Group Data (Members & Expenses)
  const loadGroupData = useCallback(async () => {
    if (!activeGroup?.id || !user) return;

    try {
      // Fetch members of active group from Supabase
      const { data: memberRows } = await supabase
        .from('group_members')
        .select(`
          user_id,
          role,
          profiles (id, full_name, upi_id, phone, avatar_url)
        `)
        .eq('group_id', activeGroup.id);

      if (memberRows && memberRows.length > 0) {
        const formatted = memberRows.map(m => ({
          id: m.profiles?.id || m.user_id,
          name: m.profiles?.full_name || 'Member',
          upi_id: m.profiles?.upi_id || '',
          phone: m.profiles?.phone || '',
          role: m.role,
        }));
        setParticipants(formatted);
      } else {
        setParticipants([]);
      }

      // Fetch expenses for active group
      const { data: expenseRows } = await supabase
        .from('expenses')
        .select('*')
        .eq('group_id', activeGroup.id)
        .order('created_at', { ascending: false });

      setExpenses(expenseRows || []);
    } catch (err) {
      console.warn('Group data load error:', err);
    }
  }, [activeGroup?.id, user]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  function handleSelectGroup(grp) {
    setActiveGroup(grp);
    if (grp?.id) {
      localStorage.setItem('mywaysplit_active_group_id', grp.id);
    }
  }

  // Calculate settlements using the selective inclusion/exclusion engine
  const settlements = calculateSettlements(participants, expenses);
  const highDebts = settlements.filter(s => s.amount >= 10000);
  const highestDebt = highDebts.length > 0 ? Math.max(...highDebts.map(s => s.amount)) : 0;

  const currentUserId = user?.id || null;
  const isAdmin = activeGroup?.created_by === user?.id;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      <OneSignalProvider currentUser={currentUserId} />

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-4 backdrop-blur-md">
            <span>✨ Multi-Tenant Group Expense Sheets</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight leading-tight">
            Split group bills selectively. Settle via UPI with one tap.
          </h1>
          <p className="mt-3 text-indigo-100/90 text-sm sm:text-base leading-relaxed">
            Automatic debt minimization algorithms, custom member inclusions/exclusions, 30-day retention feeds, and micro-loan financing.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {user ? (
              <a
                href="#split-section"
                className="btn bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs sm:text-sm px-5 py-2.5 shadow-lg"
              >
                Open Expense Sheet ↓
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="btn bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs sm:text-sm px-6 py-2.5 shadow-lg"
              >
                Sign In / Get Started →
              </button>
            )}

            <Link
              href="/borrow"
              className="btn bg-indigo-600/80 text-white hover:bg-indigo-600 border border-indigo-400/40 text-xs sm:text-sm px-5 py-2.5"
            >
              Explore P2P Micro-Loans →
            </Link>
          </div>
        </div>

        {/* Ambient background blur */}
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* When user is not signed in: Unauthenticated Callout */}
      {!user ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🔐
          </div>
          <div>
            <h2 className="text-2xl font-black font-display text-slate-900">
              Sign In to Access Your Sheets
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              Create and manage isolated multi-tenant expense groups, invite friends, and settle balances instantly via UPI.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary px-8 py-3 text-sm font-semibold shadow-lg shadow-indigo-100"
            >
              Sign In to MyWaySplit
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Multi-Tenant Group Switcher & Share Banner */}
          <GroupManager
            groups={groups}
            activeGroup={activeGroup}
            onSelectGroup={handleSelectGroup}
            onRefreshGroups={loadGroups}
            isAdmin={isAdmin}
          />

          {/* High-Debt Micro-Lending Prompt (Triggered if any debt >= ₹10,000) */}
          {highDebts.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/60 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center text-2xl flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      High Debt Detected
                    </span>
                    <span className="text-xs text-amber-900 font-semibold">
                      Pending balance of ₹{highestDebt.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1">
                    Split your ₹{highestDebt.toLocaleString('en-IN')} balance into flexible monthly low-interest EMIs with verified lenders.
                  </p>
                </div>
              </div>
              <Link
                href={`/borrow?amount=${highestDebt}`}
                className="btn bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-5 shadow-md shadow-amber-200 whitespace-nowrap"
              >
                Settle via EMI Loan →
              </Link>
            </div>
          )}

          {/* If user has no active group yet */}
          {!activeGroup ? (
            <div className="card p-12 text-center text-slate-500 space-y-4">
              <div className="text-4xl">📁</div>
              <h3 className="text-lg font-bold text-slate-800">No Expense Sheet Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create a new group using the &quot;+ New Group&quot; button above to start logging expenses with your roommates or travel group.
              </p>
            </div>
          ) : (
            /* Main Splitter Grid */
            <div id="split-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column (Inputs) */}
              <div className="lg:col-span-5 space-y-6">
                <ParticipantManager
                  participants={participants}
                  currentUser={currentUserId}
                  onDataChange={loadGroupData}
                  onIdentifyUser={() => {}}
                />

                <ExpenseForm
                  participants={participants}
                  activeGroupId={activeGroup?.id}
                  onDataChange={loadGroupData}
                />
              </div>

              {/* Right Column (Settlement Plan & History) */}
              <div className="lg:col-span-7 space-y-6">
                <SettlementPlan
                  participants={participants}
                  expenses={expenses}
                  currentUser={currentUserId}
                />

                <ExpenseList
                  expenses={expenses}
                  participants={participants}
                  currentUser={currentUserId}
                  onDataChange={loadGroupData}
                />
              </div>
            </div>
          )}
        </>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
