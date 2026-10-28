/**
 * Notification Sound & Phone Haptic / Push Utility
 * Delivers realistic default smartphone notification sounds,
 * phone vibration feedback, and native system push notifications.
 */

let audioContext = null;
let isAudioUnlocked = false;

/**
 * Get or initialize Web Audio context (singleton)
 */
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

/**
 * Unlock AudioContext on first user interaction (touch/click/keypress)
 * Necessary to comply with mobile browser autoplay policies.
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          isAudioUnlocked = true;
        });
      } else if (ctx) {
        isAudioUnlocked = true;
      }
    } catch (_) {}

    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

/**
 * Synthesizes a high-fidelity, crisp default phone notification chime.
 * Simulates standard mobile OS 2-tone bell chime (587Hz D5 -> 880Hz A5)
 * with natural decay and bell overtone harmonics.
 */
export function playPhoneNotificationSound() {
  if (typeof window === 'undefined') return;

  // 1. Phone Vibration (Haptic feedback on mobile devices)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (_) {}
  }

  // 2. Web Audio API Chime Synthesis
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master gain node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.connect(ctx.destination);

    // Tone 1: 587.33 Hz (Note D5) — gentle opening bell
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.8, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2: 880.00 Hz (Note A5) — bright primary chime ringing out
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.10);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0, now + 0.10);
    gain2.gain.linearRampToValueAtTime(1.0, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(now + 0.10);
    osc2.stop(now + 0.60);

    // Overtone harmonic: 1760.00 Hz (A6 shimmer for natural bell ring)
    const oscOvertone = ctx.createOscillator();
    const gainOvertone = ctx.createGain();
    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(1760.00, now + 0.10);

    gainOvertone.gain.setValueAtTime(0, now);
    gainOvertone.gain.setValueAtTime(0, now + 0.10);
    gainOvertone.gain.linearRampToValueAtTime(0.2, now + 0.12);
    gainOvertone.gain.exponentialRampToValueAtTime(0.0001, now + 0.40);

    oscOvertone.connect(gainOvertone);
    gainOvertone.connect(masterGain);

    oscOvertone.start(now + 0.10);
    oscOvertone.stop(now + 0.45);
  } catch (err) {
    console.warn('[Sound Play Warning]:', err);
  }
}

/**
 * Triggers native system OS notification on debtor's phone / desktop.
 * Uses ServiceWorker notification when registered (which triggers Android default sound),
 * or standard Notification API fallback.
 *
 * @param {string} title
 * @param {string} body
 */
export async function triggerDeviceNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'mywaysplit-reminder',
            renotify: true,
            silent: false, // Plays default system notification sound!
            vibrate: [200, 100, 200],
            data: {
              url: window.location.origin,
            },
          });
          return;
        }
      }

      // Fallback: standard Window Notification
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'mywaysplit-reminder',
        renotify: true,
        silent: false,
      });
    } catch (err) {
      console.warn('[System Notification Dispatch Note]:', err);
    }
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch (err) {
    console.warn('[Notification Permission Request Note]:', err);
    return 'default';
  }
}
