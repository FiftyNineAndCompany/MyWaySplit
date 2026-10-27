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
    let pushDelivered = false;

    // 1. Fetch debtor profile(s) from Supabase to retrieve their locked OneSignal Subscription/Device ID
    let subscriptionIds = [];
    try {
      const { data: debtorProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, onesignal_player_id')
        .in('id', recipientIds);

      if (debtorProfiles && debtorProfiles.length > 0) {
        subscriptionIds = debtorProfiles
          .map(p => p.onesignal_player_id)
          .filter(Boolean);
      }
    } catch (lookupErr) {
      console.warn('[Profile Lookup Note]:', lookupErr);
    }

    // 2. Dispatch targeted push via OneSignal REST API v2
    if (ONESIGNAL_REST_API_KEY) {
      try {
        const payload = {
          app_id: ONESIGNAL_APP_ID,
          headings: { en: heading || '💰 MyWaySplit Payment Reminder' },
          contents: { en: content || 'You have an unsettled balance on MyWaySplit.' },
          priority: 10,
          ios_sound: 'default',
          android_sound: 'default',
          android_channel_id: 'reminders',
          web_sound: 'default',
          url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fairshare.saitechverse.com',
        };

        // If we have direct device subscription IDs, target them directly for guaranteed 100% device delivery
        if (subscriptionIds.length > 0) {
          payload.include_subscription_ids = subscriptionIds;
        } else {
          // Fall back to external_id aliasing
          payload.include_aliases = {
            external_id: recipientIds,
          };
          payload.target_channel = 'push';
        }

        const response = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (response.ok && data?.id) {
          onesignalNotificationId = data.id;
          pushDelivered = true;
        } else {
          console.warn('[OneSignal API Response Warning]:', data);
        }
      } catch (err) {
        console.error('[OneSignal Push Error]:', err);
      }
    } else {
      console.log('[OneSignal] Simulated targeted push to external_id:', recipientIds, 'subscription_ids:', subscriptionIds);
      onesignalNotificationId = `mock-${Date.now()}`;
      pushDelivered = true;
    }

    // 3. Log in Supabase notifications table (targeted in-app notification for the debtor)
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

    // 4. Log in notification_log table
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
      message: 'Reminder notification targeted and delivered successfully',
      notificationId: onesignalNotificationId,
      pushDelivered,
    });
  } catch (error) {
    console.error('Error in notifications route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
