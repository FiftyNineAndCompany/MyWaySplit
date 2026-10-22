'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import LoanOfferCard from '@/components/loans/LoanOfferCard';
import LoanApplicationForm from '@/components/loans/LoanApplicationForm';

// Fallback seed products for demonstration
const FALLBACK_PRODUCTS = [
  {
    id: 'prod-1',
    product_name: 'Instant Personal Micro-Loan',
    min_amount: 10000,
    max_amount: 200000,
    interest_rate_annual: 11.5,
    tenure_months_min: 3,
    tenure_months_max: 24,
    processing_fee_percent: 1.5,
    description: 'Instant approval within 10 minutes. Minimal KYC, funds sent directly to your bank/UPI.',
    eligibility_criteria: 'Indian resident, age 21+, active bank account',
    lenders: {
      id: 'lend-1',
      company_name: 'QuickFin Capital',
      is_verified: true,
      description: 'RBI-regulated NBFC digital lending partner',
      contact_email: 'support@quickfincapital.com'
    }
  },
  {
    id: 'prod-2',
    product_name: 'Flexi Trip & Rent Credit Line',
    min_amount: 15000,
    max_amount: 500000,
    interest_rate_annual: 13.0,
    tenure_months_min: 6,
    tenure_months_max: 36,
    processing_fee_percent: 2.0,
    description: 'Revolving line of credit. Draw only what you need to settle group balances, pay interest only on what you withdraw.',
    eligibility_criteria: 'Salaried or self-employed individuals with ₹15,000+ monthly inflow',
    lenders: {
      id: 'lend-2',
      company_name: 'EasyLend Finance',
      is_verified: true,
      description: 'Peer-to-peer peer lender network',
      contact_email: 'apply@easylend.in'
    }
  },
  {
    id: 'prod-3',
    product_name: 'Emergency Group Debt Buster',
    min_amount: 10000,
    max_amount: 150000,
    interest_rate_annual: 9.9,
    tenure_months_min: 3,
    tenure_months_max: 12,
    processing_fee_percent: 0.99,
    description: 'Special low-interest promotional loan tailored specifically for settling MyWaySplit balances with zero foreclosure charges.',
    eligibility_criteria: 'Active MyWaySplit participant with verified phone number',
    lenders: {
      id: 'lend-3',
      company_name: 'Saitechverse Credit Line',
      is_verified: true,
      description: 'Official MyWaySplit financing partner',
      contact_email: 'credit@saitechverse.com'
    }
  }
];

function BorrowContent() {
  const searchParams = useSearchParams();
  const prefilledAmount = searchParams?.get('amount') || '25000';

  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [applyAmount, setApplyAmount] = useState(Number(prefilledAmount) || 25000);
  const [filterRate, setFilterRate] = useState('all');
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    async function fetchOffers() {
      try {
        const [prodRes, partRes] = await Promise.all([
          supabase
            .from('loan_products')
            .select(`
              *,
              lenders (
                id,
                company_name,
                is_verified,
                logo_url,
                description,
                contact_email
              )
            `)
            .eq('is_active', true),
          supabase.from('participants').select('*')
        ]);

        if (prodRes.data && prodRes.data.length > 0) {
          setProducts(prodRes.data);
        }

        if (partRes.data && partRes.data.length > 0) {
          setParticipants(partRes.data);
        } else {
          const localParts = localStorage.getItem('mywaysplit_participants');
          if (localParts) setParticipants(JSON.parse(localParts));
        }
      } catch (err) {
        console.warn('Error fetching loan offers, using fallback:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffers();
  }, []);

  function handleSelectForApply(prod, amount) {
    setSelectedProduct(prod);
    setApplyAmount(amount);
  }

  const filteredProducts = products.filter(p => {
    if (filterRate === 'low') return (p.interest_rate_annual || 14) <= 12;
    if (filterRate === 'mid') return (p.interest_rate_annual || 14) > 12 && (p.interest_rate_annual || 14) <= 15;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-4 border border-emerald-500/30">
            <span>🤝 Micro-Financing & P2P Lending Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-display tracking-tight leading-tight">
            Need Cash to Settle Group Debts?
          </h1>
          <p className="mt-4 text-slate-300 text-sm sm:text-base leading-relaxed">
            Borrow ₹10,000 to ₹5,00,000 instantly from verified NBFCs and peer lenders. Clear your MyWaySplit balances today, pay back in comfortable monthly EMIs.
          </p>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">✓ 100% Digital Application</span>
            <span className="flex items-center gap-1.5">✓ 24hr Disbursal to Bank/UPI</span>
            <span className="flex items-center gap-1.5">✓ Zero Hidden Charges</span>
          </div>
        </div>

        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Filter By Rate:</span>
          <button
            onClick={() => setFilterRate('all')}
            className={`btn text-xs py-1.5 px-3 ${filterRate === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          >
            All Rates
          </button>
          <button
            onClick={() => setFilterRate('low')}
            className={`btn text-xs py-1.5 px-3 ${filterRate === 'low' ? 'btn-primary' : 'btn-ghost'}`}
          >
            Under 12% p.a.
          </button>
          <button
            onClick={() => setFilterRate('mid')}
            className={`btn text-xs py-1.5 px-3 ${filterRate === 'mid' ? 'btn-primary' : 'btn-ghost'}`}
          >
            12% - 15% p.a.
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Are you a financial institution?</span>
          <Link href="/lender/register" className="font-bold text-indigo-600 hover:underline">
            Register as Lender →
          </Link>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <LoanOfferCard
            key={product.id}
            product={product}
            prefilledAmount={prefilledAmount}
            onSelectForApply={handleSelectForApply}
          />
        ))}
      </div>

      {/* Trust & RBI Compliance Notice */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 text-center max-w-3xl mx-auto">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center font-bold mb-2">
          🛡️
        </div>
        <h4 className="font-bold text-slate-800 text-sm">Safe, Transparent & Regulated</h4>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          MyWaySplit operates purely as a technology facilitator and financial marketplace. All credit underwriting, verification, and disbursals are performed directly by RBI-registered Non-Banking Financial Companies (NBFCs) and registered Peer-to-Peer (P2P) lending platforms.
        </p>
      </div>

      {/* Loan Application Modal */}
      {selectedProduct && (
        <LoanApplicationForm
          product={selectedProduct}
          initialAmount={applyAmount}
          participants={participants}
          onClose={() => setSelectedProduct(null)}
          onSuccess={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

export default function BorrowPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading marketplace offers...</div>}>
      <BorrowContent />
    </Suspense>
  );
}
