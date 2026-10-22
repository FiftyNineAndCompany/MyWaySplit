/**
 * UPI Deep Link Generator
 * Generates standard UPI intent URIs that natively prompt Android/iOS
 * to open PhonePe, GPay, Paytm, etc.
 *
 * Format: upi://pay?pa={VPA}&pn={NAME}&am={AMOUNT}&cu=INR&tn={NOTE}
 */

/**
 * Generate a UPI payment deep link.
 * @param {Object} params
 * @param {string} params.receiverUpiId - Receiver's VPA (e.g. "rahul@okaxis")
 * @param {string} params.receiverName - Receiver's display name
 * @param {number} params.amount - Amount in INR
 * @param {string} [params.note] - Optional transaction note
 * @returns {string|null} UPI intent URI or null if no UPI ID
 */
export function generateUpiLink({ receiverUpiId, receiverName, amount, note }) {
  if (!receiverUpiId) return null;

  const params = new URLSearchParams({
    pa: receiverUpiId,
    pn: receiverName || 'Payee',
    am: amount.toFixed(2),
    cu: 'INR',
  });

  if (note) {
    params.set('tn', note);
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Generate a WhatsApp reminder link for debt collection.
 * @param {Object} params
 * @param {string} params.debtorPhone - Debtor's phone (with country code, digits only)
 * @param {string} params.debtorName - Debtor's name
 * @param {number} params.amount - Amount owed
 * @param {string} [params.creditorUpiId] - Optional: creditor's UPI for easy payment
 * @returns {string|null} WhatsApp wa.me URL or null if no phone
 */
export function generateWhatsAppLink({ debtorPhone, debtorName, amount, creditorUpiId }) {
  if (!debtorPhone) return null;

  const cleanPhone = debtorPhone.replace(/\D/g, '');
  const upiLine = creditorUpiId ? ` My UPI is: ${creditorUpiId}` : '';
  const message = `Hey ${debtorName}! Just a reminder to pay ₹${amount.toFixed(2)} for our expenses on MyWaySplit.${upiLine}`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
