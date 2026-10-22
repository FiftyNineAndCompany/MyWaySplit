import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '233e26d3-7870-419f-981b-e1de2b055308';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

export async function POST(request) {
  try {
    const {
      recipientIds,
      heading,
      content,
      senderId,
      groupId,
      type = 'manual_reminder',
    } = await request.json();

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: 'recipientIds is required and must be an array' }, { status: 400 });
    }

    let onesignalNotificationId = null;

    // Send push notification via OneSignal REST API v2 with sound enabled
    if (ONESIGNAL_REST_API_KEY) {
      try {
        const response = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_aliases: {
              external_id: recipientIds,
            },
            target_channel: 'push',
            headings: { en: heading || '💰 MyWaySplit Payment Reminder' },
            contents: { en: content || 'You have an unsettled balance on MyWaySplit.' },
            // Auto sound configuration for Web, iOS, Android
            priority: 10,
            ios_sound: 'default',
            android_sound: 'default',
            android_channel_id: 'reminders',
            web_sound: 'default',
            url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fairshare.saitechverse.com',
          }),
        });

        const data = await response.json();
        onesignalNotificationId = data.id || null;
      } catch (err) {
        console.error('[OneSignal API error]:', err);
      }
    } else {
      console.log('[OneSignal] Simulated push delivery for user IDs:', recipientIds);
      onesignalNotificationId = `mock-${Date.now()}`;
    }

    // 1. Log in Supabase notifications table (for in-app bell)
    try {
      const inAppLogs = recipientIds.map(recId => ({
        user_id: recId,
        group_id: groupId || null,
        type: type === 'manual_reminder' ? 'debt_reminder' : 'system',
        title: heading || 'Payment Reminder',
        message: content || 'Please settle your pending balance.',
        created_at: new Date().toISOString(),
      }));

      await supabase.from('notifications').insert(inAppLogs);
    } catch (inAppErr) {
      console.warn('[In-app Notification Insert Note]:', inAppErr);
    }

    // 2. Log in notification_log table for delivery tracking
    try {
      const logs = recipientIds.map(recId => ({
        recipient_participant_id: recId,
        sender_participant_id: senderId || null,
        notification_type: type,
        message: content,
        onesignal_notification_id: onesignalNotificationId,
        sent_at: new Date().toISOString(),
      }));

      await supabase.from('notification_log').insert(logs);
    } catch (dbErr) {
      console.warn('[Notification Log DB Note]:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Reminder notification processed and sent with sound',
      notificationId: onesignalNotificationId,
    });
  } catch (error) {
    console.error('Error in notifications route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
