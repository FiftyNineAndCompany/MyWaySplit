'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';

export default function AuthModal({ isOpen, onClose, defaultMode = 'signin' }) {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState(defaultMode); // 'signin' | 'signup'
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUp(email.trim(), password, fullName.trim(), upiId.trim(), phone.trim());
        showToast('Account created successfully! Welcome to MyWaySplit.', 'success');
      } else {
        await signIn(email.trim(), password);
        showToast('Signed in successfully!', 'success');
      }
      onClose();
    } catch (err) {
      console.error('Auth error:', err);
      showToast(err.message || 'Authentication failed. Please check your credentials.', 'error');
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

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 mt-4 sm:mt-5">
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
