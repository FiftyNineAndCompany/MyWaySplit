'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('Next.js Client Boundary Error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 text-center space-y-5 shadow-2xl border border-slate-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
          ⚠️
        </div>
        <div>
          <h2 className="text-xl font-bold font-display text-slate-800">
            Something went wrong
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {error?.message || 'An unexpected error occurred while loading this view.'}
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn-primary text-xs py-2 px-5"
          >
            Try Again ↻
          </button>
          <Link
            href="/"
            className="btn btn-ghost text-xs py-2 px-4 border border-slate-200"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
