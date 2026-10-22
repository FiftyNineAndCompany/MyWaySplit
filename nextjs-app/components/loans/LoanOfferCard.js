'use client';

import { useState } from 'react';

/**
 * Calculates monthly EMI using the standard formula:
 * EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
 */
function calculateEmi(principal, annualRate, tenureMonths) {
  if (!principal || !annualRate || !tenureMonths) return 0;
  const monthlyRate = annualRate / 12 / 100;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
              (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(emi);
}

export default function LoanOfferCard({ product, onSelectForApply, prefilledAmount }) {
  const [showCalculator, setShowCalculator] = useState(false);
  
  const minAmt = Number(product.min_amount) || 10000;
  const maxAmt = Number(product.max_amount) || 200000;
  const defaultAmt = Math.min(Math.max(Number(prefilledAmount) || 25000, minAmt), maxAmt);
  
  const [calcAmount, setCalcAmount] = useState(defaultAmt);
  const [calcTenure, setCalcTenure] = useState(product.tenure_months_min || 6);

  const interestRate = Number(product.interest_rate_annual) || 14.5;
  const emi = calculateEmi(calcAmount, interestRate, calcTenure);
  const totalRepay = emi * calcTenure;
  const totalInterest = Math.max(0, totalRepay - calcAmount);

  return (
    <div className="card hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col justify-between overflow-hidden">
      {/* Top Banner / Lender Info */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-lg shadow-sm">
              {product.lenders?.company_name?.slice(0, 2).toUpperCase() || 'NB'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 text-base">
                  {product.lenders?.company_name || 'Verified Lender'}
                </h3>
                {product.lenders?.is_verified && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800" title="RBI Registered / Verified NBFC">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{product.product_name}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-indigo-600 font-display">
              {interestRate}%
            </span>
            <p className="text-[11px] text-slate-400 font-medium">p.a. onwards</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 line-clamp-2 mb-4">
          {product.description || 'Quick digital loan disbursement with minimal paperwork and zero collateral.'}
        </p>

        {/* Key Features Badges */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-xl p-3 border border-slate-100/80 text-center mb-4">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Loan Range</p>
            <p className="text-xs font-bold text-slate-800">
              ₹{(minAmt / 1000).toFixed(0)}k - ₹{(maxAmt / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="border-x border-slate-200/60">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Tenure</p>
            <p className="text-xs font-bold text-slate-800">
              {product.tenure_months_min} - {product.tenure_months_max} mos
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Fee</p>
            <p className="text-xs font-bold text-slate-800">
              {product.processing_fee_percent ? `${product.processing_fee_percent}%` : 'Low Fee'}
            </p>
          </div>
        </div>

        {/* Quick EMI Preview */}
        <div className="flex items-center justify-between text-xs py-2 px-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
          <span className="text-slate-600 font-medium">Estimated EMI:</span>
          <span className="font-bold text-indigo-700">
            ₹{emi.toLocaleString('en-IN')} / mo
          </span>
        </div>

        {/* Collapsible Interactive Calculator */}
        {showCalculator && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium">Borrow Amount</span>
                <span className="font-bold text-slate-800">₹{calcAmount.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min={minAmt}
                max={maxAmt}
                step={5000}
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500 font-medium">Repayment Tenure</span>
                <span className="font-bold text-slate-800">{calcTenure} Months</span>
              </div>
              <input
                type="range"
                min={product.tenure_months_min || 3}
                max={product.tenure_months_max || 36}
                step={1}
                value={calcTenure}
                onChange={(e) => setCalcTenure(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400">Total Interest</p>
                <p className="font-semibold text-slate-700">₹{totalInterest.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Total Repayable</p>
                <p className="font-semibold text-slate-700">₹{totalRepay.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowCalculator(!showCalculator)}
          className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {showCalculator ? 'Hide Calculator' : 'Calculate EMI'}
        </button>

        <button
          type="button"
          onClick={() => onSelectForApply(product, calcAmount)}
          className="btn btn-primary py-2 px-4 text-xs font-semibold shadow-md shadow-indigo-200"
        >
          Apply Now →
        </button>
      </div>
    </div>
  );
}
