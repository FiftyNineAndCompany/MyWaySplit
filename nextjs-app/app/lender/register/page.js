'use client';

import Link from 'next/link';
import LenderRegistrationForm from '@/components/loans/LenderRegistrationForm';

export default function LenderRegisterPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Link href="/" className="btn btn-ghost text-xs text-slate-500 hover:text-slate-800">
          ← Back to MyWaySplit Dashboard
        </Link>
        <Link href="/lender/dashboard" className="text-xs font-semibold text-indigo-600 hover:underline">
          Already registered? Open Lender Dashboard →
        </Link>
      </div>

      <LenderRegistrationForm />
    </div>
  );
}
