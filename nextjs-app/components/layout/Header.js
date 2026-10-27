'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import AuthModal from '@/components/auth/AuthModal';

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="bg-indigo-600 text-white p-1.5 sm:p-2 rounded-xl transform -rotate-6 shadow-md group-hover:rotate-0 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-2xl font-bold text-indigo-600 font-display tracking-tight leading-none">
                MyWaySplit
              </span>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                SaaS
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-wider uppercase hidden sm:block">
              by Saitechverse Solutions
            </p>
          </div>
        </Link>

        {/* Desktop Navigation (visible on md screens and up) */}
        <div className="hidden md:flex items-center gap-3">
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="btn btn-ghost text-xs px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </Link>

            <Link
              href="/borrow"
              className="btn btn-ghost text-xs px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Borrow Money</span>
            </Link>
          </nav>

          <div className="h-5 w-px bg-slate-200" />

          {/* In-App Notifications */}
          <NotificationBell />

          {/* User Profile or Sign In Button */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 pl-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md border-2 border-white">
                  {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">
                    {profile?.full_name || user.email.split('@')[0]}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="btn btn-ghost p-1.5 text-slate-400 hover:text-rose-600"
                title="Sign Out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary text-xs py-2 px-4 font-semibold shadow-sm shrink-0 whitespace-nowrap"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Actions (< md screens) */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {user ? (
            <>
              <NotificationBell />
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary text-xs py-1.5 px-3 font-semibold shadow-sm shrink-0 whitespace-nowrap"
            >
              Sign In
            </button>
          )}

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition shrink-0"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu (Clean, animated slide down) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/98 backdrop-blur-xl px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          <Link
            href="/borrow"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Request Loan (&gt; ₹10k)
          </Link>

          {user && (
            <div className="pt-2 border-t border-slate-100">
              <div className="px-3 py-1.5 text-xs text-slate-500">
                Signed in as <span className="font-semibold text-slate-800">{profile?.full_name || user.email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </header>
  );
}
