'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import AuthModal from '@/components/auth/AuthModal';

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <div className="bg-indigo-600 text-white p-1.5 sm:p-2 rounded-xl transform -rotate-6 shadow-md group-hover:rotate-0 transition-transform duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-lg sm:text-2xl font-bold text-indigo-600 font-display tracking-tight leading-none">
                MyWaySplit
              </span>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                SaaS
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-wider uppercase hidden xs:block">
              by Saitechverse Solutions
            </p>
          </div>
        </Link>

        {/* Navigation & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="btn btn-ghost text-xs p-2 sm:px-3 sm:py-2"
              title="Dashboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="hidden md:inline">Dashboard</span>
            </Link>

            <Link
              href="/borrow"
              className="btn btn-ghost text-xs p-2 sm:px-3 sm:py-2"
              title="Borrow Money"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden md:inline">Borrow Money</span>
            </Link>

            <Link
              href="/lender/dashboard"
              className="btn btn-ghost text-xs p-2 sm:px-3 sm:py-2 text-slate-500 hover:text-slate-800 hidden lg:inline-flex"
            >
              <span>Lender Portal</span>
            </Link>
          </nav>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* In-App Notifications */}
          <NotificationBell />

          {/* User Profile or Sign In Button */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 pl-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md border-2 border-white">
                  {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="hidden xl:block text-left">
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
              className="btn btn-primary text-xs py-1.5 px-3 sm:py-2 sm:px-4 font-semibold shadow-sm shrink-0 whitespace-nowrap"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </header>
  );
}
