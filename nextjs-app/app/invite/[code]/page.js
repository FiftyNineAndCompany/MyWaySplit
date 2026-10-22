'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';
import AuthModal from '@/components/auth/AuthModal';

function InviteContent({ params }) {
  const unwrappedParams = use(params);
  const inviteCode = unwrappedParams.code;

  const router = useRouter();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    async function fetchGroup() {
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .eq('invite_code', inviteCode)
          .single();

        if (error || !data) {
          showToast('Invalid or expired invite link.', 'error');
        } else {
          setGroup(data);
        }
      } catch (err) {
        console.warn('Error fetching invite:', err);
      } finally {
        setLoading(false);
      }
    }

    if (inviteCode) fetchGroup();
  }, [inviteCode, showToast]);

  async function handleJoinGroup() {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setJoining(true);
    try {
      // 1. Add user to group_members
      const { error: memberError } = await supabase
        .from('group_members')
        .upsert([{
          group_id: group.id,
          user_id: user.id,
          role: 'member',
          status: 'active',
        }]);

      if (memberError) throw memberError;

      // 2. Notify the group creator
      if (group.created_by) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: group.created_by,
            group_id: group.id,
            type: 'member_joined',
            title: `New Member in ${group.name}`,
            message: `${profile?.full_name || 'A new user'} accepted your invite and joined ${group.name}.`,
          }]);
      }

      showToast(`Joined "${group.name}" successfully!`, 'success');
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
      <div className="py-20 text-center text-slate-400 text-sm">
        Verifying invite link...
      </div>
    );
  }

  if (!group) {
    return (
      <div className="card max-w-md mx-auto p-8 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800">Invite Not Found</h2>
        <p className="text-xs text-slate-500">
          This invite code does not exist or may have been deleted by the group administrator.
        </p>
        <Link href="/" className="btn btn-primary text-xs inline-block">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4 animate-in fade-in duration-300">
      <div className="card p-8 text-center space-y-6 shadow-2xl border border-slate-100">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
          👥
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
            Group Invitation
          </span>
          <h1 className="text-2xl font-black font-display text-slate-900 mt-3">
            Join &quot;{group.name}&quot;
          </h1>
          {group.description && (
            <p className="text-xs text-slate-500 mt-2 italic">
              &quot;{group.description}&quot;
            </p>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs text-slate-600 space-y-2 text-left">
          <p className="font-semibold text-slate-800">What you can do in this group:</p>
          <ul className="space-y-1 list-disc list-inside text-slate-500">
            <li>Record shared expenses with selective inclusions</li>
            <li>Settle debts instantly via direct mobile UPI</li>
            <li>Send & receive real-time push reminders</li>
          </ul>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={joining}
            onClick={handleJoinGroup}
            className="btn btn-primary w-full py-3 text-sm font-semibold shadow-lg shadow-indigo-100"
          >
            {joining ? 'Joining Sheet...' : user ? 'Accept Invite & Open Sheet →' : 'Sign In to Accept Invite →'}
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

export default function InvitePage({ params }) {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400 text-sm">Verifying invite link...</div>}>
      <InviteContent params={params} />
    </Suspense>
  );
}
