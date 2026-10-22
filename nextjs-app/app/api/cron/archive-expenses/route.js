import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * 30-Day Expense Retention & Archiving API Route
 *
 * Can be triggered via:
 * 1. Nightly Vercel Cron or GitHub Action: GET/POST /api/cron/archive-expenses
 * 2. Manual trigger from Group Admin settings
 *
 * Marks all expenses older than 30 days as is_archived = true.
 */
export async function GET(request) {
  return handleArchive(request);
}

export async function POST(request) {
  return handleArchive(request);
}

async function handleArchive(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Verify secret if configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. First attempt to call the database function archive_old_expenses()
    const { data: rpcData, error: rpcError } = await supabase.rpc('archive_old_expenses');

    if (!rpcError) {
      return NextResponse.json({
        success: true,
        archivedCount: rpcData || 0,
        message: 'Archived expenses older than 30 days via PostgreSQL procedure',
        cutoffDate: thirtyDaysAgo,
      });
    }

    // 2. Fallback direct query if RPC is not enabled
    const { data: updated, error: updateError } = await supabase
      .from('expenses')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .lt('created_at', thirtyDaysAgo)
      .eq('is_archived', false)
      .select('id');

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      archivedCount: updated?.length || 0,
      message: 'Archived expenses older than 30 days via direct query',
      cutoffDate: thirtyDaysAgo,
    });
  } catch (error) {
    console.error('[Archive Expenses Cron Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to archive old expenses' },
      { status: 500 }
    );
  }
}
