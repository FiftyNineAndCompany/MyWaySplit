'use client';

import { useState, useEffect } from 'react';
import {
  playPhoneNotificationSound,
  triggerDeviceNotification,
  requestNotificationPermission,
  initAudioUnlock,
} from '@/lib/notificationSound';
import { useToast } from '@/components/layout/Toast';

/**
 * Prominent banner to ensure users grant device notification permissions
 * and unlock audio autoplay on their mobile phones/desktops.
 */
export default function NotificationPermissionBanner() {
  const { showToast } = useToast();
  const [permission, setPermission] = useState('granted'); // default to hide SSR flash
  const [mounted, setMounted] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setMounted(true);
    initAudioUnlock();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  if (!mounted) return null;

  async function handleEnable() {
    initAudioUnlock();
    const res = await requestNotificationPermission();
    setPermission(res);

    if (res === 'granted') {
      playPhoneNotificationSound();
      triggerDeviceNotification('🔔 Sound & Alerts Active', 'Your phone will now ring with sound when someone sends a reminder!');
      showToast('✅ Phone notifications & sound alerts enabled!', 'success');
    } else if (res === 'denied') {
      showToast('⚠️ Notifications blocked in browser settings. Please allow in site permissions.', 'error');
    }
  }

  function handleTestSound() {
    setTesting(true);
    initAudioUnlock();
    playPhoneNotificationSound();
    triggerDeviceNotification('🔔 Sound Test', 'Default phone notification sound is working!');
    showToast('🔊 Playing phone notification sound...', 'info');
    setTimeout(() => setTesting(false), 800);
  }

  // If permission is already granted, show a compact status chip with test sound
  if (permission === 'granted') {
    return (
      <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-4 py-2.5 shadow-sm text-xs text-emerald-900 animate-in fade-in">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">Phone Notifications & Sound Alerts Active</span>
        </div>
        <button
          type="button"
          onClick={handleTestSound}
          disabled={testing}
          className="btn text-[11px] py-1 px-3 bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-300 font-bold shadow-xs flex items-center gap-1"
        >
          <span>{testing ? '🔔 Ringing...' : '🔊 Test Sound'}</span>
        </button>
      </div>
    );
  }

  // If permission is not granted, show prominent action prompt
  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-amber-300 flex items-center justify-center text-xl shrink-0 shadow-inner">
          🔔
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">
              Required for Sound
            </span>
            <h4 className="text-sm font-bold text-white">Enable Phone Sound & Push Alerts</h4>
          </div>
          <p className="text-xs text-indigo-200 mt-0.5 max-w-xl">
            Allow browser notifications so your phone rings with the default chime when someone clicks the reminder bell.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
        <button
          type="button"
          onClick={handleTestSound}
          className="btn btn-ghost text-xs py-2 px-3 text-indigo-200 hover:text-white border border-indigo-400/40"
        >
          🔊 Test Sound
        </button>
        <button
          type="button"
          onClick={handleEnable}
          className="btn bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs py-2 px-4 shadow-md flex-1 sm:flex-initial"
        >
          🔔 Enable Alerts Now
        </button>
      </div>
    </div>
  );
}
