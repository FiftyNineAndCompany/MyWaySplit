/**
 * Advanced Multi-Tenant Expense Splitting & Debt Engine
 *
 * Supports:
 * 1. Selective member inclusions & exclusions (e.g., dinner split between A & B, excluding C)
 * 2. 30-day recent expense retention filtering
 * 3. Greedy debt minimization algorithm (O(N) transactions instead of O(N^2))
 * 4. Expense categorization metadata & totals
 */

export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food & Dining', emoji: '🍕', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'travel', label: 'Travel & Transport', emoji: '🚗', color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { id: 'stay', label: 'Stay & Rent', emoji: '🏨', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'groceries', label: 'Groceries & Supplies', emoji: '🛒', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'entertainment', label: 'Entertainment & Outings', emoji: '🎬', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'utilities', label: 'Bills & Utilities', emoji: '💡', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { id: 'other', label: 'General / Other', emoji: '📦', color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

/**
 * Filter transactions to only include those created within the last N days (default: 30 days).
 * @param {Array} expenses
 * @param {number} days - default 30
 * @returns {Array}
 */
export function filterRecentExpenses(expenses = [], days = 30, referenceTime = null) {
  if (!referenceTime) {
    return expenses.filter(exp => !exp.is_archived);
  }
  const cutoffTime = referenceTime - (days * 24 * 60 * 60 * 1000);
  return expenses.filter(exp => {
    if (exp.is_archived) return false;
    if (!exp.created_at) return true;
    const expTime = new Date(exp.created_at).getTime();
    return expTime >= cutoffTime;
  });
}

/**
 * Calculate net balances for participants supporting selective inclusions & exclusions.
 *
 * Algorithm:
 * 1. Initialize all participants with 0 net balance.
 * 2. For each expense:
 *    a. Credit the payer with the full expense amount.
 *    b. Determine included participants from `exp.split_among` (or all group participants if omitted).
 *    c. Divide the amount equally only among included members: `share = amount / included.length`.
 *    d. Debit each included member by `share`. Excluded members remain unchanged.
 *
 * @param {Array} participants - Array of participant/profile objects with `id`
 * @param {Array} expenses - Array of expense objects with `paid_by`, `amount`, `split_among`
 * @returns {Object} Map of participantId -> net balance
 */
export function calculateBalances(participants, expenses) {
  const balances = {};

  // Initialize all participants to zero
  participants.forEach(p => {
    balances[p.id] = 0;
  });

  expenses.forEach(exp => {
    if (exp.is_archived) return;

    const amount = Number(exp.amount) || 0;
    const payerId = exp.paid_by;

    // Credit the payer
    if (balances[payerId] !== undefined) {
      balances[payerId] += amount;
    }

    // Determine who is included in this split
    let includedIds = [];
    if (Array.isArray(exp.split_among) && exp.split_among.length > 0) {
      // Filter included IDs to ensure they currently belong to the participants list
      includedIds = exp.split_among.filter(id => balances[id] !== undefined);
    }

    // Fall back to all participants if split_among is empty or unspecified
    if (includedIds.length === 0) {
      includedIds = participants.map(p => p.id);
    }

    // Each included member pays their equal fraction
    const splitFraction = amount / includedIds.length;
    includedIds.forEach(id => {
      balances[id] -= splitFraction;
    });
  });

  return balances;
}

/**
 * Generate the optimal minimal settlement plan using a greedy algorithm.
 * Produces at most (N - 1) transactions instead of N^2 pairwise transfers.
 *
 * @param {Array} participants - Array of participant/profile objects
 * @param {Array} expenses - Array of expense objects
 * @returns {Array} Array of settlements: [{ from: participant, to: participant, amount }]
 */
export function calculateSettlements(participants, expenses) {
  if (!participants || participants.length === 0 || !expenses || expenses.length === 0) {
    return [];
  }

  const balances = calculateBalances(participants, expenses);

  const debtors = [];
  const creditors = [];

  for (const [id, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ id, amount: Math.abs(rounded) });
    } else if (rounded > 0.01) {
      creditors.push({ id, amount: rounded });
    }
  }

  // Sort descending by magnitude for optimal greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const settledAmount = Math.min(d.amount, c.amount);

    if (settledAmount > 0.01) {
      const fromParticipant = participants.find(p => p.id === d.id);
      const toParticipant = participants.find(p => p.id === c.id);

      if (fromParticipant && toParticipant) {
        settlements.push({
          from: fromParticipant,
          to: toParticipant,
          amount: Math.round(settledAmount * 100) / 100,
        });
      }
    }

    d.amount -= settledAmount;
    c.amount -= settledAmount;

    if (d.amount < 0.01) i++;
    if (c.amount < 0.01) j++;
  }

  return settlements;
}

/**
 * Compute total outstanding debt for a given user across active expenses.
 */
export function calculateUserDebt(userId, participants, expenses) {
  if (!userId || participants.length === 0) return 0;
  const settlements = calculateSettlements(participants, expenses);
  return settlements
    .filter(s => s.from.id === userId)
    .reduce((total, s) => total + s.amount, 0);
}

/**
 * Group expenses by category and calculate sum per category.
 */
export function calculateCategoryBreakdown(expenses) {
  const breakdown = {};
  EXPENSE_CATEGORIES.forEach(cat => {
    breakdown[cat.id] = { ...cat, total: 0, count: 0 };
  });

  expenses.forEach(exp => {
    if (exp.is_archived) return;
    const catId = exp.category || 'other';
    const amount = Number(exp.amount) || 0;
    if (breakdown[catId]) {
      breakdown[catId].total += amount;
      breakdown[catId].count += 1;
    } else if (breakdown.other) {
      breakdown.other.total += amount;
      breakdown.other.count += 1;
    }
  });

  return Object.values(breakdown).filter(c => c.total > 0);
}
