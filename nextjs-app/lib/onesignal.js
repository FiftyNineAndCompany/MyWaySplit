/**
 * OneSignal Helper Functions
 * Handles initialization, user login, and server-side push notification triggers.
 *
 * Uses OneSignal Web SDK v16 (client-side) and REST API v2 (server-side).
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '233e26d3-7870-419f-981b-e1de2b055308';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

let isOneSignalInitStarted = false;

/**
 * Initialize OneSignal on the client side.
 * Call this once in layout/provider after the SDK loads.
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
          notifyButton: { enable: false }, // avoid duplicate floating bells
          serviceWorkerPath: '/OneSignalSDKWorker.js',
        });
        window.__oneSignalInitialized = true;
      } catch (initErr) {
        console.warn('[OneSignal Init Info]:', initErr.message || initErr);
      }
    });
  } catch (err) {
    console.warn('[OneSignal Setup Error]:', err);
  }
}

/**
 * Login a user to OneSignal (maps device to userId).
 * @param {string} userId - Participant ID
 */
export async function loginOneSignal(userId) {
  if (typeof window === 'undefined' || !userId) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      if (window.__oneSignalInitialized && typeof OneSignal?.login === 'function' && OneSignal.User) {
        await OneSignal.login(userId);
        if (OneSignal.Slidedown?.promptPush) {
          await OneSignal.Slidedown.promptPush();
        }
      }
    } catch (err) {
      console.warn('[OneSignal Login Notice]:', err.message || err);
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
      if (window.__oneSignalInitialized && typeof OneSignal?.logout === 'function' && OneSignal.User) {
        await OneSignal.logout();
      }
    } catch (err) {
      console.warn('[OneSignal Logout Notice]:', err.message || err);
    }
  });
}

/**
 * Send a push notification via OneSignal REST API v2.
 * This should be called from an API route (server-side) for security.
 *
 * @param {Object} params
 * @param {string[]} params.externalUserIds - Target user IDs (participant IDs)
 * @param {string} params.heading - Notification title
 * @param {string} params.content - Notification body
 * @returns {Promise<Object>} OneSignal API response
 */
export async function sendPushNotification({ externalUserIds, heading, content }) {
  if (!ONESIGNAL_REST_API_KEY) {
    console.warn('[OneSignal] REST API key not configured. Skipping push.');
    return null;
  }

  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: externalUserIds,
      },
      target_channel: 'push',
      headings: { en: heading },
      contents: { en: content },
      url: typeof window !== 'undefined' ? window.location.origin : 'https://fairshare.saitechverse.com',
    }),
  });

  return response.json();
}
