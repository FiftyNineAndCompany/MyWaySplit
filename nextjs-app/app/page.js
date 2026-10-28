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
import NotificationPermissionBanner from '@/components/notifications/NotificationPermissionBanner';
import MandatoryLogin from '@/components/auth/MandatoryLogin';
import { calculateSettlements } from '@/lib/splitEngine';

export default function Home() {
  const { user, profile, loading: authLoading } = useAuth();

  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Load Groups for Authenticated User (Strictly isolated by user ownership & active membership)
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
      // 1. Fetch group IDs where user is explicitly an active member
      const { data: gmRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const memberGroupIds = (gmRows || []).map(r => r.group_id).filter(Boolean);

      // 2. Fetch groups strictly created by this user OR where user is an active member
      let query = supabase.from('groups').select('*');
      if (memberGroupIds.length > 0) {
        query = query.or(`created_by.eq.${user.id},id.in.(${memberGroupIds.join(',')})`);
      } else {
        query = query.eq('created_by', user.id);
      }

      const { data: userGroups, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('Groups fetch note:', error);
      }

      if (userGroups && userGroups.length > 0) {
        setGroups(userGroups);
        const storedActiveId = typeof window !== 'undefined'
          ? localStorage.getItem('mywaysplit_active_group_id')
          : null;
        // Ensure stored active ID actually belongs to this user's authorized groups
        const found = userGroups.find(g => g.id === storedActiveId) || userGroups[0];
        setActiveGroup(found);
        if (typeof window !== 'undefined') {
          localStorage.setItem('mywaysplit_active_group_id', found.id);
        }
      } else {
        // FRESH LOGIN: User has no groups yet!
        // Automatically create a fresh, empty expense sheet for this user (Zero older expenses of others!)
        const currentUserName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'My';
        const defaultName = `${currentUserName}'s Expenses`;
        const inviteCode = Math.random().toString(36).substring(2, 10);

        const { data: newGroup, error: createErr } = await supabase
          .from('groups')
          .insert([{
            name: defaultName,
            invite_code: inviteCode,
            created_by: user.id,
          }])
          .select()
          .single();

        if (newGroup && !createErr) {
          const creatorName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'You';

          // Record creator in group_members as admin
          await supabase.from('group_members').insert([{
            group_id: newGroup.id,
            user_id: user.id,
            role: 'admin',
            status: 'active',
          }]);

          // Create creator participant row immediately
          const { data: partData } = await supabase.from('participants').insert([{
            group_id: newGroup.id,
            user_id: user.id,
            name: creatorName,
            upi_id: profile?.upi_id || null,
            phone: profile?.phone || null,
          }]).select().maybeSingle();

          const initialPart = {
            id: partData?.id || user.id,
            user_id: user.id,
            name: creatorName,
            upi_id: profile?.upi_id || '',
            phone: profile?.phone || '',
          };

          setParticipants([initialPart]);
          setGroups([newGroup]);
          setActiveGroup(newGroup);
          if (typeof window !== 'undefined') {
            localStorage.setItem('mywaysplit_active_group_id', newGroup.id);
          }
        } else {
          setGroups([]);
          setActiveGroup(null);
        }
      }
    } catch (err) {
      console.warn('Groups fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  // 2. Load Group Data (Members & Expenses strictly scoped to active group)
  const loadGroupData = useCallback(async () => {
    if (!activeGroup?.id || !user) {
      setParticipants([]);
      setExpenses([]);
      return;
    }

    try {
      // 1. Fetch participants strictly for active group
      const { data: partRows, error: pErr } = await supabase
        .from('participants')
        .select('*')
        .eq('group_id', activeGroup.id);

      let list = [];
      const currentUserName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'You';

      if (!pErr && partRows && partRows.length > 0) {
        // Strict deduplication: keep only ONE participant record per user_id or id
        const seenUserIds = new Set();
        const seenIds = new Set();
        const duplicateIdsToDelete = [];

        for (const p of partRows) {
          const isCurrentUser = (p.user_id && p.user_id === user.id) || p.id === user.id;

          if (isCurrentUser) {
            if (seenUserIds.has(user.id)) {
              duplicateIdsToDelete.push(p.id);
              continue;
            }
            seenUserIds.add(user.id);
          } else if (p.user_id) {
            if (seenUserIds.has(p.user_id)) {
              duplicateIdsToDelete.push(p.id);
              continue;
            }
            seenUserIds.add(p.user_id);
          }

          if (seenIds.has(p.id)) {
            duplicateIdsToDelete.push(p.id);
            continue;
          }
          seenIds.add(p.id);

          list.push({
            id: p.id,
            user_id: p.user_id || p.id,
            name: p.name,
            upi_id: p.upi_id || '',
            phone: p.phone || '',
          });
        }

        // Clean up duplicate participant rows from DB in background
        if (duplicateIdsToDelete.length > 0) {
          supabase.from('participants').delete().in('id', duplicateIdsToDelete).catch(() => {});
        }
      }

      // 2. Ensure current user is in participants list exactly once
      const hasCurrentUser = list.some(p => (p.user_id && p.user_id === user.id) || p.id === user.id);

      if (!hasCurrentUser) {
        const { data: newPartRow } = await supabase
          .from('participants')
          .insert([{
            group_id: activeGroup.id,
            user_id: user.id,
            name: currentUserName,
            upi_id: profile?.upi_id || null,
            phone: profile?.phone || null,
          }])
          .select()
          .maybeSingle();

        list.unshift({
          id: newPartRow?.id || user.id,
          user_id: user.id,
          name: newPartRow?.name || currentUserName,
          upi_id: newPartRow?.upi_id || profile?.upi_id || '',
          phone: newPartRow?.phone || profile?.phone || '',
        });
      }

      setParticipants(list);

      // 3. Fetch expenses strictly for active group (Zero older expenses for fresh sheet!)
      const { data: expenseRows, error: expErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('group_id', activeGroup.id)
        .order('created_at', { ascending: false });

      if (expErr) {
        console.warn('Expenses fetch note:', expErr);
      }
      setExpenses(expenseRows || []);
    } catch (err) {
      console.warn('Group data load error:', err);
    }
  }, [activeGroup?.id, activeGroup?.created_by, user, profile]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  function handleSelectGroup(grp) {
    setActiveGroup(grp);
    if (grp?.id && typeof window !== 'undefined') {
      localStorage.setItem('mywaysplit_active_group_id', grp.id);
    }
  }

  // Calculate settlements using greedy debt minimization algorithm
  const settlements = calculateSettlements(participants, expenses);
  const highDebts = settlements.filter(s => s.amount >= 10000);
  const highestDebt = highDebts.length > 0 ? Math.max(...highDebts.map(s => s.amount)) : 0;

  const currentUserId = user?.id || null;
  const isAdmin = activeGroup?.created_by === user?.id;

  // 1. Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
        <svg className="animate-spin h-8 w-8 text-indigo-600 mb-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm font-semibold text-slate-600">Connecting to MyWaySplit...</p>
      </div>
    );
  }

  // 2. MANDATORY ONBOARDING: If user is not logged in, show mandatory login screen
  if (!user) {
    return (
      <div className="w-full max-w-full overflow-x-hidden">
        <MandatoryLogin redirectPath="/" />
      </div>
    );
  }

  // 3. AUTHENTICATED USER DASHBOARD
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* Device Locking & Push Listener */}
      <OneSignalProvider currentUser={currentUserId} />

      {/* Prominent Phone Notification & Sound Activation Banner */}
      <NotificationPermissionBanner />

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-3 backdrop-blur-md">
            <span>✨ Multi-Tenant Expense Sheets</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight leading-tight">
            {activeGroup ? activeGroup.name : 'Shared Group Expenses'}
          </h1>
          <p className="mt-2 text-indigo-100/90 text-xs sm:text-sm leading-relaxed">
            Automatic debt minimization, selective splits, and instant 1-tap UPI settlements.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5 items-center">
            <a
              href="#split-section"
              className="btn bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs py-2 px-4 shadow-md"
            >
              + Log Expense ↓
            </a>
            {activeGroup?.invite_code && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const inviteUrl = `${origin}/invite/${activeGroup.invite_code}`;
                    const text = encodeURIComponent(`Hey! Join our expense sheet "${activeGroup.name}" on MyWaySplit to track shared expenses and settle balances via UPI:\n${inviteUrl}`);
                    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                  }}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 shadow-md flex items-center gap-1.5"
                  title="Share invite link on WhatsApp"
                >
                  💬 Share WhatsApp
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const inviteUrl = `${origin}/invite/${activeGroup.invite_code}`;
                    const shareData = {
                      title: `Join "${activeGroup.name}" on MyWaySplit`,
                      text: `Hey! Join our expense sheet "${activeGroup.name}" on MyWaySplit to track shared expenses and settle balances via UPI:\n${inviteUrl}`,
                      url: inviteUrl,
                    };
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      try {
                        await navigator.share(shareData);
                        return;
                      } catch (err) {
                        if (err.name === 'AbortError') return;
                      }
                    }
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(inviteUrl);
                      alert('🔗 Invite link copied to clipboard!');
                    }
                  }}
                  className="btn bg-indigo-700/90 hover:bg-indigo-700 text-white border border-indigo-400/40 font-bold text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md"
                  title="Share via Telegram, Instagram, SMS, Email, etc."
                >
                  📤 Share (Others)
                </button>
              </>
            )}
            <Link
              href="/borrow"
              className="btn bg-indigo-900/60 text-indigo-200 hover:text-white hover:bg-indigo-900/80 border border-indigo-400/30 text-xs py-2 px-3"
            >
              Request Loan (&gt; ₹10k) →
            </Link>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Group Switcher & Share Link Bar */}
      <GroupManager
        groups={groups}
        activeGroup={activeGroup}
        onSelectGroup={handleSelectGroup}
        onRefreshGroups={loadGroups}
        isAdmin={isAdmin}
      />

      {/* High-Debt Assistance Prompt (Triggered if any debt >= ₹10,000) */}
      {highDebts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  High Settlement
                </span>
                <span className="text-xs text-amber-900 font-bold">
                  Pending debt of ₹{highestDebt.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                Eligible for settlement loan financing assistance (72h turnaround).
              </p>
            </div>
          </div>
          <Link
            href={`/borrow?amount=${highestDebt}`}
            className="btn bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 shadow-sm shrink-0 whitespace-nowrap"
          >
            Request Loan Support →
          </Link>
        </div>
      )}

      {/* When user has no active group yet */}
      {!activeGroup ? (
        <div className="card p-10 text-center text-slate-500 space-y-4">
          <div className="text-4xl">📁</div>
          <h3 className="text-lg font-bold text-slate-800">No Expense Sheet Selected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create a new group using the &quot;+ New Group&quot; button above, or join your friends&apos; sheet using an invite link.
          </p>
        </div>
      ) : (
        /* Main Expense Splitting Grid */
        <div id="split-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Sheet Members & Expense Form */}
          <div className="lg:col-span-5 space-y-6">
            <ParticipantManager
              participants={participants}
              activeGroup={activeGroup}
              currentUser={currentUserId}
              currentUserName={profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'}
              onDataChange={loadGroupData}
            />

            <ExpenseForm
              participants={participants}
              activeGroup={activeGroup}
              activeGroupId={activeGroup?.id}
              currentUser={currentUserId}
              currentUserName={profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'}
              onDataChange={loadGroupData}
            />
          </div>

          {/* Right Column: Final Settlements & History */}
          <div className="lg:col-span-7 space-y-6">
            <SettlementPlan
              participants={participants}
              expenses={expenses}
              currentUser={currentUserId}
              activeGroupId={activeGroup?.id}
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
    </div>
  );
}
