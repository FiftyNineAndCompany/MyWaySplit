'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import {
  playPhoneNotificationSound,
  triggerDeviceNotification,
  initAudioUnlock,
  requestNotificationPermission,
} from '@/lib/notificationSound';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState('default');
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Unlock Web Audio context on first user touch/click
    initAudioUnlock();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  const knownNotificationIdsRef = useRef(new Set());
  const isInitialFetchRef = useRef(true);

  // Helper to handle an incoming new notification with guaranteed phone chime & vibration
  const handleIncomingNotification = useCallback((notif) => {
    if (!notif?.id) return;
    if (knownNotificationIdsRef.current.has(notif.id)) return;
    knownNotificationIdsRef.current.add(notif.id);

    // Update notifications list
    setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);

    // 1. Play default phone notification sound & vibrate debtor's phone
    playPhoneNotificationSound();

    // 2. Trigger native OS phone notification (shows on lockscreen / status bar)
    triggerDeviceNotification(
      notif.title || '💰 MyWaySplit Payment Reminder',
      notif.message || 'You have an unsettled balance to review.'
    );
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        if (isInitialFetchRef.current) {
          // On first load, seed known IDs without playing sound for past notifications
          data.forEach(n => knownNotificationIdsRef.current.add(n.id));
          isInitialFetchRef.current = false;
          setNotifications(data);
        } else {
          // Check if any brand new notification arrived!
          const newNotifs = data.filter(n => !knownNotificationIdsRef.current.has(n.id));
          if (newNotifs.length > 0) {
            newNotifs.forEach(n => handleIncomingNotification(n));
          } else {
            setNotifications(data);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    }
  }, [user?.id, handleIncomingNotification]);

  useEffect(() => {
    fetchNotifications();

    if (!user?.id) return;

    let channel = null;
    try {
      // Unique channel topic so Supabase never reuses an already-subscribed channel
      const channelId = `user-notifs-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          payload => {
            if (payload?.new) {
              handleIncomingNotification(payload.new);
            }
          }
        )
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[Realtime] Notifications channel error');
          }
        });
    } catch (err) {
      console.warn('Realtime channel setup error:', err);
    }

    // 4-second reactive polling fallback to guarantee notification delivery and sound
    // even if Supabase Realtime WebSocket drops or table is not in publication
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchNotifications, handleIncomingNotification]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAsRead(id) {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.warn('Error marking read:', err);
    }
  }

  async function markAllAsRead() {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.warn('Error marking all read:', err);
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-indigo-600 rounded-xl hover:bg-slate-100 transition-colors"
        title="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/80 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playPhoneNotificationSound();
                    triggerDeviceNotification('🔔 Sound Test', 'Default phone notification sound is working!');
                  }}
                  className="text-[11px] text-amber-600 hover:text-amber-800 font-semibold px-2 py-0.5 rounded-lg hover:bg-amber-50 border border-amber-200/80 transition flex items-center gap-1"
                  title="Test phone chime sound & vibration"
                >
                  🔊 Test Sound
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>

            {permissionState === 'default' && (
              <div className="bg-indigo-50/80 rounded-xl p-2 flex items-center justify-between gap-2 border border-indigo-100">
                <p className="text-[11px] text-indigo-800 leading-tight">
                  Enable device sound & push alerts for reminders
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    setPermissionState(res);
                    if (res === 'granted') {
                      playPhoneNotificationSound();
                      triggerDeviceNotification('✅ Alerts Enabled', 'You will now receive phone notifications with sound!');
                    }
                  }}
                  className="btn btn-primary text-[10px] py-1 px-2.5 shrink-0"
                >
                  Enable
                </button>
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No notifications yet. You&apos;re all caught up!
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start ${
                    !notif.is_read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <span className="text-xl mt-0.5">
                    {notif.type === 'group_invite' ? '👥' :
                     notif.type === 'expense_added' ? '🧾' :
                     notif.type === 'debt_reminder' ? '💰' : '🔔'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800">{notif.title}</p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(notif.created_at).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
