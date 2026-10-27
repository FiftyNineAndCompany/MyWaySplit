'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';
import { promptAndLockOneSignalDevice } from '@/lib/onesignal';
import MandatoryLogin from '@/components/auth/MandatoryLogin';

function InviteContent() {
  const router = useRouter();
  const params = useParams();
  const inviteCode = params?.code;

  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);

  // "Choose Name" step state
  const [displayName, setDisplayName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');

  // 1. Fetch group details by invite code
  useEffect(() => {
    async function fetchGroup() {
      if (!inviteCode) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let foundGroup = null;

        // Try RPC function first
        try {
          const { data: rpcData, error: rpcErr } = await supabase
            .rpc('get_group_by_invite', { invite_code_param: inviteCode });

          if (!rpcErr && rpcData && rpcData.length > 0) {
            foundGroup = rpcData[0];
          }
        } catch (_) {}

        // Fallback to table query
        if (!foundGroup) {
          const { data: tableData } = await supabase
            .from('groups')
            .select('*')
            .eq('invite_code', inviteCode)
            .maybeSingle();

          if (tableData) {
            foundGroup = tableData;
          }
        }

        setGroup(foundGroup);
      } catch (err) {
        console.warn('Error fetching invite:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGroup();
  }, [inviteCode]);

  // 2. Pre-fill name and UPI when profile or user is available
  useEffect(() => {
    if (profile) {
      if (!displayName && profile.full_name) setDisplayName(profile.full_name);
      if (!upiId && profile.upi_id) setUpiId(profile.upi_id);
      if (!phone && profile.phone) setPhone(profile.phone);
    } else if (user && !displayName) {
      const emailPrefix = user.email?.split('@')[0] || '';
      setDisplayName(emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : '');
    }
  }, [user, profile, displayName, upiId, phone]);

  // 3. Check membership & run OneSignal device locking when logged in
  useEffect(() => {
    if (!user?.id || !group?.id) return;

    // Immediately trigger push permission & lock OneSignal device ID
    promptAndLockOneSignalDevice(user.id);

    async function checkMembership() {
      try {
        if (group.created_by === user.id) {
          setIsMember(true);
          return;
        }

        const { data: memberRow } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', group.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberRow) {
          setIsMember(true);
        }
      } catch (_) {}
    }

    checkMembership();
  }, [user?.id, group?.id, group?.created_by]);

  // 4. Handle Joining Group ("Choose Name" Form Submission)
  async function handleJoinSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) {
      return showToast('Please enter your name.', 'error');
    }

    setJoining(true);
    try {
      // Strategy A: Secure RPC function
      let joinSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase
          .rpc('join_group_by_invite', {
            invite_code_param: inviteCode,
            display_name_param: displayName.trim(),
            upi_id_param: upiId.trim() || null,
            phone_param: phone.trim() || null,
          });

        if (!rpcErr && rpcRes) {
          joinSuccess = true;
        }
      } catch (_) {}

      // Strategy B: Fallback direct inserts
      if (!joinSuccess) {
        await supabase
          .from('group_members')
          .upsert([{
            group_id: group.id,
            user_id: user.id,
            role: 'member',
            status: 'active',
          }], { onConflict: 'group_id,user_id' });

        await supabase
          .from('participants')
          .upsert([{
            id: user.id,
            user_id: user.id,
            group_id: group.id,
            name: displayName.trim(),
            upi_id: upiId.trim() || null,
            phone: phone.trim() || null,
          }], { onConflict: 'id' });
      }

      // Save as active group in localStorage and redirect
      localStorage.setItem('mywaysplit_active_group_id', group.id);
      showToast(`Welcome to "${group.name}"!`, 'success');
      router.push('/');
    } catch (err) {
      console.error('Error joining group:', err);
      showToast(err.message || 'Failed to join group.', 'error');
    } finally {
      setJoining(false);
    }
  }

  // Handle already-a-member redirect
  function handleGoToGroup() {
    localStorage.setItem('mywaysplit_active_group_id', group.id);
    showToast(`Opening "${group.name}"...`, 'info');
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <svg className="animate-spin h-8 w-8 text-indigo-600 mb-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm font-semibold text-slate-600">Loading invite details...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 text-3xl flex items-center justify-center mx-auto">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-slate-800">Invite Not Found</h2>
        <p className="text-xs text-slate-500">
          This invite link does not exist or has expired. Please ask the group creator for a new link.
        </p>
        <Link href="/" className="btn btn-primary text-xs py-2 px-5 inline-block">
          Go to Home
        </Link>
      </div>
    );
  }

  // STEP 1: Mandatory Login if user is not authenticated
  if (!user) {
    return (
      <MandatoryLogin
        inviteGroup={group}
        redirectPath={`/invite/${inviteCode}`}
      />
    );
  }

  // STEP 2: Already a member
  if (isMember) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 text-3xl flex items-center justify-center mx-auto">
          ✅
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Already a Member
          </span>
          <h2 className="text-2xl font-black font-display text-slate-900 mt-3">
            {group.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            You are already part of this expense sheet.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoToGroup}
          className="btn btn-primary w-full py-3 text-sm font-semibold shadow-md shadow-indigo-100"
        >
          Open Expense Sheet →
        </button>
      </div>
    );
  }

  // STEP 3: "Choose Name" Screen
  return (
    <div className="min-h-[75vh] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 animate-in fade-in duration-300">
        
        {/* Group Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200 mb-3">
            👥
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
            Group Invitation
          </span>
          <h1 className="text-2xl font-extrabold font-display text-slate-900 mt-2">
            Join {group.name}
          </h1>
          {group.creator_name && (
            <p className="text-xs text-slate-500 mt-1">
              Invited by <span className="font-semibold text-slate-700">{group.creator_name}</span>
            </p>
          )}
        </div>

        {/* Form: Choose Display Name & UPI */}
        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Name in this Group *
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Sairam"
              className="input py-2.5 px-3 text-sm font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This name will appear on expenses and settlements.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your UPI ID (Optional — for receiving settlements)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="name@okhdfcbank"
              className="input py-2.5 px-3 text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Enables 1-tap UPI payments directly to your bank account.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="9876543210"
              className="input py-2.5 px-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={joining}
            className="btn btn-primary w-full py-3 text-sm font-semibold shadow-md shadow-indigo-100 mt-3"
          >
            {joining ? 'Joining Group...' : `Join ${group.name} →`}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Push notifications enabled for instant payment reminders and debt updates.
        </p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading invite...</p>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
