import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ADMIN_EMAIL = 'sairamlodhi98@gmail.com';

export async function POST(request) {
  try {
    const {
      fullName,
      phone,
      email,
      amount,
      reason,
      userId = null,
    } = await request.json();

    const parsedAmount = Number(amount);

    if (!fullName || !phone || !email || isNaN(parsedAmount)) {
      return NextResponse.json({ error: 'Please provide all required fields.' }, { status: 400 });
    }

    if (parsedAmount < 10000) {
      return NextResponse.json({ error: 'Loan requests are only available for settlement amounts of ₹10,000 and above.' }, { status: 400 });
    }

    // 1. Insert lead into Supabase loan_leads table
    let leadId = null;
    try {
      const { data, error } = await supabase
        .from('loan_leads')
        .insert([{
          user_id: userId || null,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          amount: parsedAmount,
          reason: reason?.trim() || null,
          status: 'pending',
        }])
        .select()
        .single();

      if (error) {
        console.warn('[Loan Lead Insert Warning]:', error);
      } else if (data) {
        leadId = data.id;
      }
    } catch (dbErr) {
      console.warn('[Loan Lead DB Exception]:', dbErr);
    }

    // 2. Trigger Admin Alert to sairamlodhi98@gmail.com
    console.log(`[ADMIN ALERT] New Loan Request Received!
Recipient: ${ADMIN_EMAIL}
Lead ID: ${leadId || 'pending'}
Applicant: ${fullName}
Phone: ${phone}
Email: ${email}
Amount: ₹${parsedAmount.toLocaleString('en-IN')}
Reason: ${reason || 'Debt Settlement'}
Timestamp: ${new Date().toISOString()}`);

    // Log notification in database for admin
    try {
      await supabase.from('notification_log').insert([{
        notification_type: 'loan_lead_alert',
        message: `New Loan Lead: ${fullName} requested ₹${parsedAmount} (Phone: ${phone}, Email: ${email})`,
        sent_at: new Date().toISOString(),
      }]);
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: 'Loan application registered successfully.',
      leadId,
      notice: 'Admin will take 72 hours to respond.',
    });
  } catch (error) {
    console.error('Error in loan-request route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
