import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request, { params }) {
  try {
    const { code } = await params;
    if (!code) {
      return NextResponse.json({ success: false, error: 'Invite code required' }, { status: 400 });
    }

    // 1. Try secure RPC function first
    try {
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc('get_group_by_invite', { invite_code_param: code });

      if (!rpcErr && rpcData && rpcData.length > 0) {
        return NextResponse.json({ success: true, group: rpcData[0] });
      }
    } catch (_) {}

    // 2. Fallback to direct query
    const { data: group, error } = await supabase
      .from('groups')
      .select('id, name, description, invite_code, currency, created_by, created_at')
      .eq('invite_code', code)
      .maybeSingle();

    if (error || !group) {
      return NextResponse.json({ success: false, error: 'Invite not found or expired' }, { status: 404 });
    }

    return NextResponse.json({ success: true, group });
  } catch (err) {
    console.error('API invite lookup error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
