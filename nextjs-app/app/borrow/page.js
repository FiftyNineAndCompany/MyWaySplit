'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/components/layout/Toast';

function BorrowFormContent() {
  const searchParams = useSearchParams();
  const prefilledAmount = searchParams?.get('amount') || '';

  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(prefilledAmount ? String(Math.max(10000, Number(prefilledAmount))) : '15000');
  const [reason, setReason] = useState('Group Settlement Balance');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (profile) {
      if (!fullName && profile.full_name) setFullName(profile.full_name);
      if (!phone && profile.phone) setPhone(profile.phone);
      if (!email && profile.email) setEmail(profile.email);
    } else if (user) {
      if (!email && user.email) setEmail(user.email);
      if (!fullName) {
        const prefix = user.email?.split('@')[0] || '';
        setFullName(prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : '');
      }
    }
  }, [user, profile, fullName, phone, email]);

  async function handleSubmit(e) {
    e.preventDefault();
    const numAmount = Number(amount);

    if (numAmount < 10000) {
      return showToast('Loans are exclusively available for settlements exceeding ₹10,000.', 'error');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/loan-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          amount: numAmount,
          reason,
          userId: user?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request.');

      setSubmitted(true);
      showToast('Loan request submitted successfully!', 'success');
    } catch (err) {
      console.error('Error submitting loan request:', err);
      showToast(err.message || 'Error submitting loan request.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto my-10 p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xl text-center space-y-6 animate-in fade-in">
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 text-4xl flex items-center justify-center mx-auto shadow-inner">
          🤝
        </div>

        <div>
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            Application Received
          </span>
          <h1 className="text-2xl font-black font-display text-slate-900 mt-3">
            Loan Request Submitted
          </h1>
          <p className="text-sm font-semibold text-indigo-600 mt-1">
            Amount Requested: ₹{Number(amount).toLocaleString('en-IN')}
          </p>
        </div>

        {/* Mandatory Confirmation Notice */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium leading-relaxed">
          ⏱️ <span className="font-bold">Admin will take 72 hours to respond.</span>
          <p className="text-xs text-amber-800/80 mt-1">
            We will contact you via email at <strong>{email}</strong> or phone at <strong>{phone}</strong> to review settlement verification.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="btn btn-primary w-full py-3 text-sm font-semibold shadow-md shadow-indigo-100"
          >
            Return to Expense Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto my-6 sm:my-10 px-4">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-3">
          <span>⚡ High-Balance Financing</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-slate-900 tracking-tight">
          Request Loan
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Need help clearing large trip balances or shared flat security deposits? Request flexible financing for settlements of ₹10,000 and above.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Requested Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Settlement Amount (₹) * (Min ₹10,000)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                ₹
              </span>
              <input
                type="number"
                min={10000}
                step={500}
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="25000"
                className="input pl-8 text-base font-bold text-indigo-600"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Settlements below ₹10,000 are not eligible for loan assistance.
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Applicant Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Sairam Lodhi"
              className="input text-sm"
            />
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                className="input text-sm"
              />
            </div>
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
                className="input text-sm"
              />
            </div>
          </div>

          {/* Reason / Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Settlement Purpose / Group Details
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Goa Trip Settlement with 5 members"
              className="input text-sm"
            />
          </div>

          {/* Notice Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">📌 Important Timeline Note:</p>
            <p>Admin will review the request and respond within <strong>72 hours</strong> with terms.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-sm font-semibold shadow-md shadow-indigo-100 mt-2"
          >
            {loading ? 'Submitting Application...' : 'Submit Loan Request →'}
          </button>
        </form>
      </div>

      <div className="text-center mt-6">
        <Link href="/" className="text-xs text-slate-500 hover:text-indigo-600 transition">
          ← Back to Expense Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function BorrowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading form...</div>}>
      <BorrowFormContent />
    </Suspense>
  );
}
