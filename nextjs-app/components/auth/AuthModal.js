'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';

export default function AuthModal({ isOpen, onClose, defaultMode = 'signin' }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState(defaultMode); // 'signin' | 'signup'
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear messages when switching mode or opening
  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, [mode, isOpen]);

  // Lock background scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        
        // 1. Create account
        const res = await signUp(email.trim(), password, fullName.trim(), upiId.trim(), phone.trim());

        // 2. Next step: Immediately attempt sign-in with the same credentials
        try {
          await signIn(email.trim(), password);
          showToast('Account created and signed in successfully!', 'success');
          onClose();
          return;
        } catch (signInErr) {
          const errMsg = signInErr?.message || '';
          if (errMsg.toLowerCase().includes('email not confirmed')) {
            // Email confirmation is required by Supabase project
            setMode('signin');
            setSuccessMessage('Account created! Please check your email to confirm your account, then sign in with your credentials.');
            showToast('Account created! Please confirm your email, then sign in.', 'success');
            return;
          }
          // If auto sign-in succeeded through session
          if (res?.session) {
            showToast('Account created successfully! Welcome to MyWaySplit.', 'success');
            onClose();
            return;
          }
          // Otherwise switch to sign-in tab
          setMode('signin');
          setSuccessMessage('Account created! Please sign in with your email and password below.');
        }
      } else {
        // Sign In Mode: Verify credentials
        try {
          await signIn(email.trim(), password);
          showToast('Signed in successfully!', 'success');
          onClose();
        } catch (signInErr) {
          console.error('Sign-in error:', signInErr);
          const rawMsg = signInErr?.message || '';
          if (rawMsg.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Incorrect email or password. Please check your credentials and try again.');
          } else if (rawMsg.toLowerCase().includes('email not confirmed')) {
            throw new Error('Your email has not been confirmed yet. Please verify your email inbox or disable email confirmation in Supabase.');
          } else {
            throw new Error(rawMsg || 'Login failed. Please verify your email and password.');
          }
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      const friendlyMsg = err.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(friendlyMsg);
      showToast(friendlyMsg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overscroll-contain animate-in fade-in duration-150 w-full max-w-full">
      {/* Click outside backdrop to close */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Card - Strictly fitted to mobile screen width with side margins */}
      <div className="relative w-[calc(100vw-1.5rem)] sm:w-full max-w-sm sm:max-w-md mx-auto my-auto bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[88vh] max-h-[88dvh] overflow-y-auto z-10">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition z-20"
          title="Close"
        >
          ✕
        </button>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 mb-4 sm:mb-5 pb-1 pr-8">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 pb-2.5 text-center text-xs sm:text-sm font-bold transition-all border-b-2 ${
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
            className={`flex-1 pb-2.5 text-center text-xs sm:text-sm font-bold transition-all border-b-2 ${
              mode === 'signup'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Create Account
          </button>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black font-display text-slate-900 tracking-tight">
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-snug">
            {mode === 'signup'
              ? 'Join to create and share expense sheets.'
              : 'Sign in to access your shared sheets & settlements.'}
          </p>
        </div>

        {/* Inline Error Message */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
            <span className="text-sm shrink-0">⚠️</span>
            <p className="leading-relaxed font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Inline Success/Info Message */}
        {successMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
            <span className="text-sm shrink-0">✅</span>
            <p className="leading-relaxed font-medium">{successMessage}</p>
          </div>
        )}

        {/* PRIMARY AUTH: Google Login */}
        <div className="mt-4">
          <button
            type="button"
            onClick={async () => {
              try {
                await signInWithGoogle('/');
              } catch (err) {
                setErrorMessage(err.message || 'Google sign-in failed.');
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2.5 transition active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100" />
          </div>
          <span className="relative bg-white px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Or with email
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 mt-2">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="input py-2 px-3 text-base sm:text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input py-2 px-3 text-base sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input py-2 px-3 text-base sm:text-sm"
            />
          </div>

          {mode === 'signup' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
                  UPI ID (Optional)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="name@okhdfc"
                  className="input py-2 px-3 text-base sm:text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
                  Mobile (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="input py-2 px-3 text-base sm:text-xs"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-2.5 sm:py-3 text-sm font-semibold shadow-md shadow-indigo-100 mt-2"
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
          {mode === 'signup' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-indigo-600 font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-indigo-600 font-bold hover:underline"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
