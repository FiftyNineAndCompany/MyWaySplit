'use client';

import { generateUpiLink } from '@/lib/upiUtils';

/**
 * UPI Pay Button — generates a standard UPI intent deep link.
 * On Android/iOS, this natively prompts the user to open PhonePe, GPay, Paytm, etc.
 * On desktop, shows the UPI ID for manual payment.
 */
export default function UpiPayButton({ receiverUpiId, receiverName, amount }) {
  if (!receiverUpiId) return null;

  const upiUrl = generateUpiLink({
    receiverUpiId,
    receiverName,
    amount,
    note: `MyWaySplit settlement to ${receiverName}`,
  });

  return (
    <a
      href={upiUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-upi text-sm whitespace-nowrap"
      title={`Pay ₹${amount.toFixed(2)} via UPI to ${receiverUpiId}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      Pay UPI
    </a>
  );
}
