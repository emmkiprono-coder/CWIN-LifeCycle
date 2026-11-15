/**
 * Rate & pay rules engine.
 *
 * Architectural constraint (from CWIN At Home's existing pricing model —
 * keep this in sync if the business rule ever changes):
 *   client rate = direct care cost / 0.80
 * i.e. a fixed 20% administrative margin. This is not a tunable default,
 * it's the company's pricing law, so it's a named constant, not a config
 * value buried in a spreadsheet.
 */
export const ADMIN_MARGIN = 0.20;
export const DIRECT_COST_SHARE = 1 - ADMIN_MARGIN; // 0.80

/** Given what the caregiver is paid per hour, returns what the client is billed per hour. */
export function clientRateFromDirectCost(directCostPerHour: number): number {
  return round2(directCostPerHour / DIRECT_COST_SHARE);
}

/** Inverse: given a client bill rate, what direct-cost rate does that imply. */
export function directCostFromClientRate(clientRatePerHour: number): number {
  return round2(clientRatePerHour * DIRECT_COST_SHARE);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Pay rule resolution ----------

export interface PayRuleInput {
  id: string;
  clientId: string | null; // null = applies to any client for this caregiver
  rateType: "FLAT_HOURLY" | "MULTIPLIER";
  payRatePerHour: number;
  multiplier: number | null;
  appliesFrom: Date | null;
  appliesTo: Date | null;
  priority: number;
  active: boolean;
}

export interface ShiftForPayCalc {
  clientId: string;
  clockIn: Date;
  durationHours: number;
  caregiverDefaultRate: number;
}

/**
 * Resolves the effective $/hr for one shift:
 * 1. Start from the caregiver's default rate.
 * 2. Apply the highest-priority active PayRule that matches the client
 *    (or has no client restriction) and whose date window covers the shift.
 * 3. FLAT_HOURLY rules replace the rate outright; MULTIPLIER rules scale
 *    whatever rate has been resolved so far (so a flat override plus a
 *    holiday multiplier can stack if both are intentionally given different
 *    priorities — the rules apply in priority order, low to high).
 */
export function resolvePayRate(shift: ShiftForPayCalc, rules: PayRuleInput[]): number {
  const applicable = rules
    .filter((r) => r.active)
    .filter((r) => r.clientId === null || r.clientId === shift.clientId)
    .filter((r) => !r.appliesFrom || r.appliesFrom <= shift.clockIn)
    .filter((r) => !r.appliesTo || r.appliesTo >= shift.clockIn)
    .sort((a, b) => a.priority - b.priority); // apply lowest priority first, highest last (wins)

  let rate = shift.caregiverDefaultRate;
  for (const rule of applicable) {
    if (rule.rateType === "FLAT_HOURLY") {
      rate = rule.payRatePerHour;
    } else if (rule.rateType === "MULTIPLIER" && rule.multiplier) {
      rate = rate * rule.multiplier;
    }
  }
  return round2(rate);
}

/** Computes a shift's pay and bill amounts once its rate has been resolved. */
export function computeShiftAmounts(durationHours: number, payRatePerHour: number) {
  const grossPay = round2(durationHours * payRatePerHour);
  const billRatePerHour = clientRateFromDirectCost(payRatePerHour);
  const billAmount = round2(durationHours * billRatePerHour);
  return { grossPay, billRatePerHour, billAmount };
}
