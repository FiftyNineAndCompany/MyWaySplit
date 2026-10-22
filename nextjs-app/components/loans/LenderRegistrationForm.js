'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';

export default function LenderRegistrationForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    companyName: '',
    contactEmail: '',
    contactPhone: '',
    registrationNumber: '',
    description: '',
    websiteUrl: '',
    productName: 'Instant Cash Advance',
    interestRate: '13.5',
    minAmount: '10000',
    maxAmount: '300000',
    tenureMin: '3',
    tenureMax: '24',
    processingFee: '2.0',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Insert lender record
      const { data: lenderData, error: lenderErr } = await supabase
        .from('lenders')
        .insert([{
          company_name: form.companyName.trim(),
          contact_email: form.contactEmail.trim().toLowerCase(),
          contact_phone: form.contactPhone.trim(),
          registration_number: form.registrationNumber.trim() || 'REG-PENDING',
          description: form.description.trim() || 'Licensed personal finance partner',
          website_url: form.websiteUrl.trim() || null,
          password_hash: 'portal_registered_hash',
          is_verified: true, // auto-verify for demonstration
          is_active: true,
        }])
        .select()
        .single();

      if (lenderErr) throw lenderErr;

      // 2. Insert primary loan product
      if (lenderData?.id) {
        const { error: prodErr } = await supabase
          .from('loan_products')
          .insert([{
            lender_id: lenderData.id,
            product_name: form.productName.trim(),
            min_amount: Number(form.minAmount),
            max_amount: Number(form.maxAmount),
            interest_rate_annual: Number(form.interestRate),
            tenure_months_min: Number(form.tenureMin),
            tenure_months_max: Number(form.tenureMax),
            processing_fee_percent: Number(form.processingFee),
            description: `Quick disbursement loan from ${form.companyName}`,
            is_active: true,
          }]);

        if (prodErr) console.warn('Could not insert initial product:', prodErr);
      }

      showToast('Registration successful! Redirecting to lender dashboard...', 'success');
      
      // Store current lender id in localStorage for session convenience
      if (typeof window !== 'undefined' && lenderData?.id) {
        localStorage.setItem('mywaysplit_lender_id', lenderData.id);
        localStorage.setItem('mywaysplit_lender_name', lenderData.company_name);
      }

      setTimeout(() => {
        router.push('/lender/dashboard');
      }, 1200);

    } catch (err) {
      console.error('Lender registration error:', err);
      showToast(err.message || 'Registration failed. Please check inputs and try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 font-display">Lender Onboarding</h2>
        <p className="text-sm text-slate-500 mt-1">
          Join MyWaySplit marketplace to offer instant micro-loans and debt financing to borrowers.
        </p>
      </div>

      {/* Organization Details */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">1. Entity Details</h3>
        
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Company / NBFC / Firm Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Acme Capital Partners"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="input"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registration / CIN / NBFC No.</label>
            <input
              type="text"
              placeholder="e.g. NBFC-123456"
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Website</label>
            <input
              type="url"
              placeholder="https://yourfirm.com"
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email *</label>
            <input
              type="email"
              required
              placeholder="partners@yourfirm.com"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone *</label>
            <input
              type="tel"
              required
              placeholder="9876543210"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Company Bio / Description</label>
          <textarea
            rows={2}
            placeholder="Describe your funding speed, eligibility, and core customer value."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input"
          />
        </div>
      </div>

      {/* Primary Loan Product */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">2. Primary Loan Offer</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Express Debt Consolidation"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Interest Rate (% p.a.) *</label>
            <input
              type="number"
              step="0.1"
              required
              placeholder="13.5"
              value={form.interestRate}
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Min Loan (₹) *</label>
            <input
              type="number"
              step="1000"
              required
              placeholder="10000"
              value={form.minAmount}
              onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Max Loan (₹) *</label>
            <input
              type="number"
              step="5000"
              required
              placeholder="300000"
              value={form.maxAmount}
              onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tenure (Months) *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min (e.g. 3)"
                value={form.tenureMin}
                onChange={(e) => setForm({ ...form, tenureMin: e.target.value })}
                className="input text-center"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="number"
                placeholder="Max (e.g. 24)"
                value={form.tenureMax}
                onChange={(e) => setForm({ ...form, tenureMax: e.target.value })}
                className="input text-center"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Processing Fee (%)</label>
            <input
              type="number"
              step="0.1"
              placeholder="2.0"
              value={form.processingFee}
              onChange={(e) => setForm({ ...form, processingFee: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full sm:w-auto px-8 py-3 text-sm font-semibold shadow-lg shadow-indigo-200"
        >
          {loading ? 'Creating Lender Profile...' : 'Complete Registration & Launch Offer'}
        </button>
      </div>
    </form>
  );
}
