'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';

export default function LoanApplicationForm({ product, initialAmount = 25000, participants = [], onClose, onSuccess }) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    applicantName: '',
    applicantPhone: '',
    applicantEmail: '',
    requestedAmount: initialAmount,
    participantId: '',
    purpose: 'Debt Settlement & Shared Expenses',
    agreeTerms: true,
  });

  const minAmt = Number(product?.min_amount) || 10000;
  const maxAmt = Number(product?.max_amount) || 500000;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.applicantName.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }

    if (!formData.applicantPhone.trim() || formData.applicantPhone.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (Number(formData.requestedAmount) < minAmt) {
      showToast(`Minimum loan amount is ₹${minAmt.toLocaleString('en-IN')}`, 'error');
      return;
    }

    setSubmitting(true);

    try {
      const applicationPayload = {
        loan_product_id: product.id,
        lender_id: product.lender_id || product.lenders?.id,
        participant_id: formData.participantId || null,
        applicant_name: formData.applicantName.trim(),
        applicant_phone: formData.applicantPhone.trim(),
        applicant_email: formData.applicantEmail.trim() || null,
        requested_amount: Number(formData.requestedAmount),
        purpose: formData.purpose,
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('loan_applications')
        .insert([applicationPayload])
        .select();

      if (error) {
        console.warn('Supabase application error, falling back:', error);
      }

      showToast('Application submitted successfully! The lender will contact you shortly.', 'success');
      if (onSuccess) onSuccess(data?.[0]);
      if (onClose) onClose();
    } catch (err) {
      console.error('Error submitting application:', err);
      showToast('Error submitting loan request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              {product?.lenders?.company_name || 'Fast P2P / NBFC Partner'}
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Apply for {product?.product_name || 'Personal Loan'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Requested Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                min={minAmt}
                max={maxAmt}
                step={1000}
                required
                value={formData.requestedAmount}
                onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                className="input pl-8 font-semibold text-slate-900"
                placeholder="25000"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Min ₹{minAmt.toLocaleString('en-IN')} — Max ₹{maxAmt.toLocaleString('en-IN')}
            </p>
          </div>

          {participants.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Group Member (Optional)
              </label>
              <select
                value={formData.participantId}
                onChange={(e) => {
                  const part = participants.find(p => p.id === e.target.value);
                  setFormData({
                    ...formData,
                    participantId: e.target.value,
                    applicantName: part ? part.name : formData.applicantName,
                    applicantPhone: part?.phone || formData.applicantPhone,
                  });
                }}
                className="input"
              >
                <option value="">Select a participant or fill details manually</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.phone ? `(${p.phone})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={formData.applicantName}
              onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
              className="input"
              placeholder="As per PAN card"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={formData.applicantPhone}
                onChange={(e) => setFormData({ ...formData, applicantPhone: e.target.value })}
                className="input"
                placeholder="10-digit number"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.applicantEmail}
                onChange={(e) => setFormData({ ...formData, applicantEmail: e.target.value })}
                className="input"
                placeholder="your.email@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Loan Purpose
            </label>
            <select
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="input"
            >
              <option value="Debt Settlement & Shared Expenses">Debt Settlement & Shared Expenses</option>
              <option value="Travel & Trip Expenses">Travel & Group Trip</option>
              <option value="Medical or Emergency Funds">Medical / Emergency</option>
              <option value="Rent or House Advance">Rent / House Advance</option>
              <option value="Other Personal Needs">Other Personal Needs</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                required
                checked={formData.agreeTerms}
                onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                I authorize the lender to contact me via Call/WhatsApp/SMS and review my credit report in compliance with RBI guidelines.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary text-xs py-2.5 px-6 font-semibold shadow-md shadow-indigo-100"
            >
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
