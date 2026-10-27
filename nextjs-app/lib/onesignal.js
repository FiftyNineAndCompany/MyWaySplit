/**
 * OneSignal Web SDK v16 Helper Functions & Device Locking
 */
import { supabase } from '@/lib/supabase';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '233e26d3-7870-419f-981b-e1de2b055308';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

let isOneSignalInitStarted = false;

/**
 * Initialize OneSignal on the client side.
 */
export async function initOneSignal() {
  if (typeof window === 'undefined') return;
  if (isOneSignalInitStarted || window.__oneSignalInitialized) return;
  isOneSignalInitStarted = true;

  try {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      if (window.__oneSignalInitialized) return;

      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          serviceWorkerPath: '/OneSignalSDKWorker.js',
        });
        window.__oneSignalInitialized = true;
      } catch (initErr) {
        console.warn('[OneSignal Init Note]:', initErr?.message || initErr);
      }
    });
  } catch (err) {
    console.warn('[OneSignal Setup Error]:', err);
  }
}

/**
 * Prompt push notification permission and lock the OneSignal Subscription / Device ID
 * to the user's Supabase Auth UID.
 *
 * @param {string} userId - Supabase Auth UID
 */
export async function promptAndLockOneSignalDevice(userId) {
  if (typeof window === 'undefined' || !userId) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      // 1. Identify user in OneSignal using Supabase UID as external_id
      if (typeof OneSignal?.login === 'function') {
        await OneSignal.login(userId);
      }

      // 2. Trigger push permission prompt
      try {
        if (OneSignal.Notifications?.requestPermission) {
          await OneSignal.Notifications.requestPermission();
        } else if (OneSignal.Slidedown?.promptPush) {
          await OneSignal.Slidedown.promptPush();
        }
      } catch (promptErr) {
        console.warn('[OneSignal Prompt Error]:', promptErr);
      }

      // Helper function to sync device subscription ID to Supabase profiles
      const syncDeviceId = async (subscriptionId) => {
        if (!subscriptionId) return;
        try {
          await supabase
            .from('profiles')
            .update({
              onesignal_player_id: subscriptionId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        } catch (dbErr) {
          console.warn('[Device ID Sync DB Note]:', dbErr);
        }
      };

      // 3. Capture current subscription ID if already allowed
      const currentSubscriptionId = OneSignal.User?.PushSubscription?.id;
      if (currentSubscriptionId) {
        await syncDeviceId(currentSubscriptionId);
      }

      // 4. Attach event listener so when the user clicks "Allow", the new ID is locked immediately
      if (OneSignal.User?.PushSubscription?.addEventListener) {
        OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
          const newSubscriptionId = event?.current?.id;
          if (newSubscriptionId) {
            await syncDeviceId(newSubscriptionId);
          }
        });
      }
    } catch (err) {
      console.warn('[OneSignal Device Lock Notice]:', err?.message || err);
    }
  });
}

/**
 * Logout from OneSignal safely.
 */
export async function logoutOneSignal() {
  if (typeof window === 'undefined') return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      if (window.__oneSignalInitialized && typeof OneSignal?.logout === 'function') {
        await OneSignal.logout();
      }
    } catch (err) {
      console.warn('[OneSignal Logout Notice]:', err?.message || err);
    }
  });
}
