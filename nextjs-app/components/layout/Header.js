'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import AuthModal from '@/components/auth/AuthModal';

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown menu if user clicks outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  function handleOpenHistory() {
    setMenuOpen(false);
    if (typeof window !== 'undefined' && window.__mws_openHistoryDrawer) {
      window.__mws_openHistoryDrawer();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
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

        {/* Top-Right Header Actions & Single Consolidated Hamburger Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* In-App Notifications */}
          <NotificationBell />

          {/* User Profile Avatar (if logged in) */}
          {user ? (
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-md border-2 border-white">
                {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden lg:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {profile?.full_name || user.email.split('@')[0]}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary text-xs py-1.5 px-3 font-semibold shadow-sm shrink-0 whitespace-nowrap"
            >
              Sign In
            </button>
          )}

          {/* THE SINGLE CONSOLIDATED TOP-RIGHT HAMBURGER MENU */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 rounded-xl transition flex items-center justify-center border shadow-sm ${
                menuOpen
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              aria-label="Toggle Navigation and History Menu"
              title="Main Menu"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>

            {/* Consolidated Dropdown Menu Panel */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* 1. Transaction History (Consolidated inside single top-right menu) */}
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📜</span>
                    <span>Transaction History</span>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full">
                    View
                  </span>
                </button>

                <div className="h-px bg-slate-100 my-1" />

                {/* 2. Navigation Links */}
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <span className="text-base">📊</span>
                  <span>Dashboard</span>
                </Link>

                <Link
                  href="/borrow"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <span className="text-base">🤝</span>
                  <span>Request Loan (&gt; ₹10k)</span>
                </Link>

                <div className="h-px bg-slate-100 my-1" />

                {/* 3. Account / Authentication */}
                {user ? (
                  <div className="px-4 py-2">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      Signed in as
                    </p>
                    <p className="text-xs font-bold text-slate-800 truncate mb-2">
                      {profile?.full_name || user.email}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="w-full btn btn-primary text-xs py-2 font-semibold shadow-sm"
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </header>
  );
}
