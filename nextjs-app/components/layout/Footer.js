'use client';

import { useState, useEffect } from 'react';

export default function Footer() {
  const [year, setYear] = useState('2026');

  useEffect(() => {
    setYear(new Date().getFullYear().toString());
  }, []);

  return (
    <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-xs text-slate-400 font-medium">
          © {year} MyWaySplit by{' '}
          <a
            href="https://saitechverse.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:text-indigo-600 transition"
          >
            Saitechverse Solutions
          </a>
        </p>
        <p className="text-[10px] text-slate-300 font-medium">
          Auto-deleting 14-day history • Cloud connected • Secure
        </p>
      </div>
    </footer>
  );
}
