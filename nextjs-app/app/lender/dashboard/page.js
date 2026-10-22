'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/layout/Toast';

// Mock initial data if tables are clean or loading
const MOCK_APPLICATIONS = [
  {
    id: 'app-1',
    applicant_name: 'Vikram Singh',
    applicant_phone: '919876543210',
    applicant_email: 'vikram.singh@gmail.com',
    requested_amount: 35000,
    purpose: 'Debt Settlement & Shared Expenses (Manali Group Trip)',
    status: 'pending',
    created_at: '2026-10-22T10:00:00.000Z',
    loan_products: { product_name: 'Instant Personal Loan' }
  },
  {
    id: 'app-2',
    applicant_name: 'Sneha Deshmukh',
    applicant_phone: '919812345678',
    applicant_email: 'sneha.d@outlook.com',
    requested_amount: 18000,
    purpose: 'House Flat Rent Advance & Bills',
    status: 'contacted',
    created_at: '2026-10-21T15:30:00.000Z',
    loan_products: { product_name: 'Flex Credit Line' }
  }
];

export default function LenderDashboardPage() {
  const { showToast } = useToast();
  const [lenderName, setLenderName] = useState('Partner Capital');
  const [applications, setApplications] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchDashboardData = useCallback(async () => {
    try {
      const storedName = typeof window !== 'undefined' ? localStorage.getItem('mywaysplit_lender_name') : null;
      if (storedName) setLenderName(storedName);

      const [appsRes, prodsRes] = await Promise.all([
        supabase
          .from('loan_applications')
          .select(`*, loan_products(product_name)`)
          .order('created_at', { ascending: false }),
        supabase.from('loan_products').select('*').order('created_at', { ascending: false })
      ]);

      if (appsRes.data && appsRes.data.length > 0) {
        setApplications(appsRes.data);
      } else {
        setApplications(MOCK_APPLICATIONS);
      }

      if (prodsRes.data && prodsRes.data.length > 0) {
        setProducts(prodsRes.data);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      setApplications(MOCK_APPLICATIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  async function handleUpdateStatus(appId, newStatus) {
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', appId);

      if (error) console.warn('Supabase update error:', error);

      setApplications(prev =>
        prev.map(a => (a.id === appId ? { ...a, status: newStatus } : a))
      );
      showToast(`Application marked as ${newStatus}`, 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  }

  const totalRequested = applications.reduce((sum, a) => sum + (Number(a.requested_amount) || 0), 0);
  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const approvedCount = applications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;

  const filteredApps = applications.filter(a => {
    if (filterStatus === 'all') return true;
    return a.status === filterStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Lender Portal Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display mt-1">
            {lenderName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage incoming loan requests from MyWaySplit users and review risk profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/borrow" className="btn btn-ghost text-xs">
            View Live Offers
          </Link>
          <Link href="/lender/register" className="btn btn-primary text-xs">
            + Add New Lender / Branch
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-indigo-600">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Applications</p>
          <p className="text-3xl font-black text-slate-900 mt-1 font-display">{applications.length}</p>
          <p className="text-xs text-indigo-600 mt-1 font-medium">{pendingCount} awaiting initial review</p>
        </div>

        <div className="card p-5 border-l-4 border-emerald-600">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Demand Value</p>
          <p className="text-3xl font-black text-emerald-600 mt-1 font-display">
            ₹{(totalRequested / 1000).toFixed(1)}k
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Cumulative requested sum</p>
        </div>

        <div className="card p-5 border-l-4 border-amber-600">
          <p className="text-xs font-semibold text-slate-500 uppercase">Approved / Disbursed</p>
          <p className="text-3xl font-black text-slate-900 mt-1 font-display">{approvedCount}</p>
          <p className="text-xs text-amber-600 mt-1 font-medium">Active funded borrowers</p>
        </div>
      </div>

      {/* Applications Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Borrower Loan Applications</h2>
            <p className="text-xs text-slate-500">Contact applicants to collect documentation & disburse funds</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            {['all', 'pending', 'contacted', 'approved'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`btn text-xs py-1 px-2.5 capitalize ${filterStatus === status ? 'btn-primary' : 'btn-ghost'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No loan applications found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{app.applicant_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(app.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    <td className="py-3 px-4 space-y-0.5">
                      <a
                        href={`tel:${app.applicant_phone}`}
                        className="font-medium text-indigo-600 hover:underline block"
                      >
                        📞 {app.applicant_phone}
                      </a>
                      {app.applicant_email && (
                        <span className="text-slate-400 text-[11px] block">{app.applicant_email}</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-extrabold text-slate-900 font-display text-sm">
                        ₹{Number(app.requested_amount).toLocaleString('en-IN')}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <span className="text-slate-600 line-clamp-1">{app.purpose || 'Group Expense Debt'}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        app.status === 'contacted' ? 'bg-sky-100 text-sky-800' :
                        app.status === 'disbursed' ? 'bg-purple-100 text-purple-800' :
                        app.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {app.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      {app.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(app.id, 'contacted')}
                          className="btn btn-ghost text-[11px] py-1 px-2 text-sky-700 hover:bg-sky-50"
                        >
                          Mark Contacted
                        </button>
                      )}
                      {app.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdateStatus(app.id, 'approved')}
                          className="btn btn-ghost text-[11px] py-1 px-2 text-emerald-700 hover:bg-emerald-50"
                        >
                          Approve
                        </button>
                      )}
                      <a
                        href={`https://wa.me/${app.applicant_phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(app.applicant_name)},%20we%20received%20your%20loan%20application%20on%20MyWaySplit.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost text-[11px] py-1 px-2 text-emerald-600 hover:bg-emerald-50"
                        title="Chat on WhatsApp"
                      >
                        💬 WhatsApp
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
