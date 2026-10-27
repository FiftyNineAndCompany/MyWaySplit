'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function completeAuth() {
      const code = searchParams.get('code');
      const next = searchParams.get('next') || '/';

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch (err) {
          console.warn('[Auth Callback exchange note]:', err);
        }
      }

      // Check session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.replace(next);
          return;
        }
      } catch (_) {}

      router.replace(next);
    }

    completeAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <svg className="animate-spin h-8 w-8 text-indigo-600 mb-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p className="text-sm font-semibold text-slate-600">Completing secure sign-in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-sm text-slate-500">Signing in...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
