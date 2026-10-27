'use client';

import { useState } from 'react';
import { useToast } from '@/components/layout/Toast';

/**
 * Targeted Push Notification Reminder Button.
 * Triggers OneSignal push notification to the specific debtor's device
 * and logs an in-app reminder to the debtor's account.
 */
export default function ReminderButton({
  debtorId,
  debtorName,
  creditorName,
  amount,
  currentUser,
  groupId,
}) {
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);

  // Only show the button if the current user is NOT the debtor (i.e., creditor is owed money)
  if (!currentUser || currentUser === debtorId) return null;

  async function handleSendReminder(e) {
    e.stopPropagation();
    if (sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [debtorId],
          heading: `💰 Payment Reminder from ${creditorName}`,
          content: `Hey ${debtorName}! You owe ₹${Number(amount).toFixed(2)} to ${creditorName}. Please settle up on MyWaySplit.`,
          senderId: currentUser,
          groupId: groupId || null,
          type: 'manual_reminder',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`🔔 Push reminder sent to ${debtorName}'s device!`, 'success');
      } else {
        showToast(data.error || 'Failed to send reminder.', 'error');
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
      showToast('Network error sending reminder.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSendReminder}
      disabled={sending}
      className="btn btn-ghost p-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700 border border-amber-200/80 rounded-xl transition-all shadow-sm"
      title={`Send instant push notification reminder to ${debtorName}`}
      aria-label={`Send push reminder to ${debtorName}`}
    >
      {sending ? (
        <svg className="animate-spin h-4 w-4 border-t-2 border-b-2 border-amber-600 rounded-full" viewBox="0 0 24 24" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )}
    </button>
  );
}
