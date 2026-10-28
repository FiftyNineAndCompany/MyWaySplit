'use client';

import { calculateSettlements } from '@/lib/splitEngine';
import UpiPayButton from '@/components/payment/UpiPayButton';
import WhatsAppReminder from '@/components/payment/WhatsAppReminder';
import ReminderButton from '@/components/notifications/ReminderButton';

export default function SettlementPlan({ participants, expenses, currentUser, activeGroupId }) {
  // Deduplicate participants to ensure accurate settlement calculations
  const uniqueParticipants = participants.filter((p, index, self) => {
    return index === self.findIndex(t => (
      (t.user_id && p.user_id && t.user_id === p.user_id) ||
      (t.id && p.id && t.id === p.id) ||
      (t.name && p.name && t.name.trim().toLowerCase() === p.name.trim().toLowerCase())
    ));
  });

  const settlements = calculateSettlements(uniqueParticipants, expenses);

  if (uniqueParticipants.length === 0 || expenses.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
          <h2 className="text-xl font-bold font-display text-slate-800">3. Final Settlements</h2>
          <span className="badge badge-primary">0</span>
        </div>
        <div className="text-center py-8 text-slate-400 italic text-sm">
          Add participants and expenses to see the settlement math.
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
        <h2 className="text-xl font-bold font-display text-slate-800">3. Final Settlements</h2>
        <span className="badge badge-primary">{settlements.length}</span>
      </div>

      {settlements.length === 0 ? (
        <div className="text-center py-6 bg-emerald-50 rounded-xl font-bold text-emerald-600 border border-emerald-100 flex items-center justify-center gap-2">
          🎉 All settled up!
        </div>
      ) : (
        <div className="space-y-3">
          {settlements.map((s, idx) => {
            const isUserDebtor = currentUser === s.from.id || currentUser === s.from.user_id;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-4 rounded-xl border fade-in flex-wrap gap-4 transition hover:shadow-md ${
                  isUserDebtor ? 'settlement-you' : 'settlement-normal'
                }`}
              >
                {/* Avatars & Text */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-inner z-10 relative border-2 border-white">
                      {(s.from?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-inner absolute top-0 left-6 border-2 border-white">
                      {(s.to?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="font-medium text-slate-700 ml-4">
                    {isUserDebtor ? (
                      <span className="font-bold text-rose-600">You</span>
                    ) : (
                      <span className="font-bold text-slate-800">{s.from?.name || 'Member'}</span>
                    )}{' '}
                    owe{isUserDebtor ? '' : 's'}{' '}
                    <span className="font-bold text-slate-800">{s.to?.name || 'Member'}</span>
                  </div>
                </div>

                {/* Amount + Action Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-1 flex-wrap">
                  <div className="font-black text-slate-800 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 font-display">
                    ₹{s.amount.toFixed(2)}
                  </div>

                  {/* WhatsApp Reminder — shown when debtor has phone */}
                  <WhatsAppReminder
                    debtorPhone={s.from.phone}
                    debtorName={s.from.name}
                    amount={s.amount}
                    creditorUpiId={s.to.upi_id}
                  />

                  {/* UPI Pay Button — shown when creditor has UPI ID */}
                  <UpiPayButton
                    receiverUpiId={s.to.upi_id}
                    receiverName={s.to.name}
                    amount={s.amount}
                  />

                  {/* Targeted Push Notification Reminder */}
                  <ReminderButton
                    debtorId={s.from.user_id || s.from.id}
                    debtorName={s.from.name}
                    creditorName={s.to.name}
                    amount={s.amount}
                    currentUser={currentUser}
                    groupId={activeGroupId}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
