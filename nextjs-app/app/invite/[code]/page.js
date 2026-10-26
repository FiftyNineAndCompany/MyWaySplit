'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';
import AuthModal from '@/components/auth/AuthModal';

function InviteContent() {
  const router = useRouter();
  const params = useParams();
  const inviteCode = params?.code;

  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [group, setGroup] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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

        // Strategy A: Secure Postgres RPC function (bypasses RLS with SECURITY DEFINER)
        try {
          const { data: rpcData, error: rpcErr } = await supabase
            .rpc('get_group_by_invite', { invite_code_param: inviteCode });

          if (!rpcErr && rpcData && rpcData.length > 0) {
            foundGroup = rpcData[0];
          }
        } catch (_) {}

        // Strategy B: Next.js API route fallback
        if (!foundGroup) {
          try {
            const apiRes = await fetch(`/api/invite/${inviteCode}`);
            if (apiRes.ok) {
              const json = await apiRes.json();
              if (json?.success && json?.group) {
                foundGroup = json.group;
              }
            }
          } catch (_) {}
        }

        // Strategy C: Direct table select fallback
        if (!foundGroup) {
          try {
            const { data: tableData } = await supabase
              .from('groups')
              .select('*')
              .eq('invite_code', inviteCode)
              .maybeSingle();

            if (tableData) {
              foundGroup = tableData;
            }
          } catch (_) {}
        }

        if (foundGroup) {
          setGroup(foundGroup);

          // Fetch group creator name if available
          if (foundGroup.created_by) {
            try {
              const { data: creatorProfile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', foundGroup.created_by)
                .maybeSingle();

              if (creatorProfile?.full_name) {
                setCreatorName(creatorProfile.full_name);
              }
            } catch (_) {}
          }
        } else {
          setGroup(null);
        }
      } catch (err) {
        console.warn('Error fetching invite:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGroup();
  }, [inviteCode]);

  // 2. Check if the currently authenticated user is already a member
  useEffect(() => {
    async function checkMembership() {
      if (!user?.id || !group?.id) {
        setIsAlreadyMember(false);
        return;
      }

      try {
        if (group.created_by === user.id) {
          setIsAlreadyMember(true);
          return;
        }

        const { data: memberRow } = await supabase
          .from('group_members')
          .select('id, role')
          .eq('group_id', group.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberRow) {
          setIsAlreadyMember(true);
        }
      } catch (_) {}
    }

    checkMembership();
  }, [user?.id, group?.id, group?.created_by]);

  // 3. Handle Joining the Group
  async function handleJoinGroup() {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    if (isAlreadyMember) {
      localStorage.setItem('mywaysplit_active_group_id', group.id);
      showToast(`Opening "${group.name}"...`, 'info');
      router.push('/');
      return;
    }

    setJoining(true);
    try {
      let joinSuccess = false;

      // Strategy A: Secure Postgres RPC
      try {
        const { data: rpcRes, error: rpcErr } = await supabase
          .rpc('join_group_by_invite', { invite_code_param: inviteCode });

        if (!rpcErr && rpcRes) {
          joinSuccess = true;
        }
      } catch (_) {}

      // Strategy B: Direct upsert into group_members
      if (!joinSuccess) {
        const { error: memberError } = await supabase
          .from('group_members')
          .upsert([{
            group_id: group.id,
            user_id: user.id,
            role: 'member',
            status: 'active',
          }], { onConflict: 'group_id,user_id' });

        if (memberError) {
          console.warn('Direct upsert note:', memberError);
        }
      }

      // Also ensure the user is registered in sheet participants table
      try {
        await supabase
          .from('participants')
          .upsert([{
            id: user.id,
            name: profile?.full_name || user.email?.split('@')[0] || 'Member',
            upi_id: profile?.upi_id || null,
            phone: profile?.phone || null,
            group_id: group.id,
          }], { onConflict: 'id' });
      } catch (_) {}

      // Notify the group creator
      if (group.created_by && group.created_by !== user.id) {
        try {
          await supabase
            .from('notifications')
            .insert([{
              user_id: group.created_by,
              group_id: group.id,
              type: 'member_joined',
              title: `New Member in ${group.name}`,
              message: `${profile?.full_name || user.email?.split('@')[0] || 'A new member'} joined "${group.name}".`,
            }]);
        } catch (_) {}
      }

      showToast(`Welcome! You joined "${group.name}" successfully!`, 'success');
      localStorage.setItem('mywaysplit_active_group_id', group.id);
      router.push('/');
    } catch (err) {
      console.error('Error joining group:', err);
      showToast(err.message || 'Failed to join group.', 'error');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4 animate-in fade-in">
        <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 font-medium text-sm">Verifying invite link...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 animate-in fade-in duration-300">
        <div className="card p-8 sm:p-10 text-center space-y-5 shadow-xl border border-slate-200">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
            ⚠️
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-slate-800">Invite Not Found</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This invite code (<code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-mono font-bold">{inviteCode}</code>) is invalid or expired.
            </p>
          </div>
          <div className="pt-2 space-y-2">
            <Link href="/" className="btn btn-primary w-full py-2.5 text-xs font-semibold">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in duration-300">
      <div className="card p-6 sm:p-8 text-center space-y-6 shadow-2xl border border-slate-100">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
          👥
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100/60">
            Group Invitation
          </span>
          <h1 className="text-2xl font-black font-display text-slate-900 mt-3">
            Join &quot;{group.name}&quot;
          </h1>
          {creatorName ? (
            <p className="text-xs text-slate-500 mt-1">
              Invited by <span className="font-semibold text-slate-700">{creatorName}</span>
            </p>
          ) : null}
          {group.description && (
            <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              &quot;{group.description}&quot;
            </p>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-600 space-y-2 text-left">
          <p className="font-semibold text-slate-800">What you can do in this group:</p>
          <ul className="space-y-1.5 list-disc list-inside text-slate-500 text-[11px] leading-relaxed">
            <li>Split expenses with selective member inclusions</li>
            <li>Settle balances with one tap via UPI QR & intent</li>
            <li>Send and receive payment reminders</li>
          </ul>
        </div>

        {isAlreadyMember && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
            <span>✓</span> You are already a member of this expense sheet!
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            disabled={joining}
            onClick={handleJoinGroup}
            className="btn btn-primary w-full py-3 text-sm font-semibold shadow-lg shadow-indigo-100"
          >
            {joining ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Joining Sheet...
              </span>
            ) : isAlreadyMember ? (
              'Open Expense Sheet →'
            ) : user ? (
              'Accept Invite & Open Sheet →'
            ) : (
              'Sign In to Accept Invite →'
            )}
          </button>
        </div>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          defaultMode="signin"
        />
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 font-medium text-sm">Loading invitation...</p>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
