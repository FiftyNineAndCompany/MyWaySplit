'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';

export default function MandatoryLogin({ inviteGroup = null, redirectPath = '/' }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  // Primary: Google Login
  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setErrorMsg('');
    try {
      await signInWithGoogle(redirectPath);
    } catch (err) {
      console.error('Google auth error:', err);
      setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
      showToast('Google sign-in failed.', 'error');
      setGoogleLoading(false);
    }
  }

  // Fallback: Email / Password
  async function handleEmailAuth(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        const res = await signUp(email.trim(), password, fullName.trim(), upiId.trim(), phone.trim());

        // Attempt immediate login with same credentials
        try {
          await signIn(email.trim(), password);
          showToast('Account created and signed in!', 'success');
        } catch (_) {
          if (res?.session) {
            showToast('Account created successfully!', 'success');
          } else {
            setMode('signin');
            showToast('Account created! Please sign in with your password.', 'success');
          }
        }
      } else {
        await signIn(email.trim(), password);
        showToast('Signed in successfully!', 'success');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 animate-in fade-in duration-300">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 mb-3 transform -rotate-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 tracking-tight">
            MyWaySplit
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Group Expense Splitting & 1-Tap UPI Settlements
          </p>
        </div>

        {/* Invite Preview (If user arrived via a viral share link) */}
        {inviteGroup && (
          <div className="mb-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-xs font-bold text-indigo-900">
                You were invited to join:
              </p>
              <p className="text-sm font-extrabold text-indigo-700">
                {inviteGroup.name}
              </p>
              {inviteGroup.creator_name && (
                <p className="text-[11px] text-indigo-500">
                  Created by {inviteGroup.creator_name}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error message banner */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-snug">
            {errorMsg}
          </div>
        )}

        {/* PRIMARY AUTH: Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm shadow-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        >
          {googleLoading ? (
            <svg className="animate-spin h-5 w-5 text-slate-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Or with email & password
          </span>
        </div>

        {/* Tabs: Sign In / Create Account */}
        <div className="flex border-b border-slate-100 mb-5">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 pb-2.5 text-center text-xs sm:text-sm font-bold border-b-2 transition-all ${
              mode === 'signin'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 pb-2.5 text-center text-xs sm:text-sm font-bold border-b-2 transition-all ${
              mode === 'signup'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="input py-2.5 px-3 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input py-2.5 px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input py-2.5 px-3 text-sm"
            />
          </div>

          {mode === 'signup' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  UPI ID (Optional)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="name@okhdfc"
                  className="input py-2 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="input py-2 px-3 text-xs"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn btn-primary w-full py-3 text-sm font-semibold shadow-md shadow-indigo-100 mt-2"
          >
            {loading ? 'Processing...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-5">
          By signing in, you agree to secure group expense tracking and push settlement reminders.
        </p>
      </div>
    </div>
  );
}
