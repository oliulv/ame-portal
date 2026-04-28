export type FundingAdjustmentInput = {
  type: 'top_up' | 'deduction'
  amount: number
}

export type FundingInvoiceInput = {
  status: string
  amountGbp: number
  batchedIntoId?: unknown
}

export type StartupFundingInput = {
  baseline: number
  approvedMilestones: number
  topUps: number
  deductions: number
  committedInvoices: number
  deployedInvoices: number
}

export type StartupFundingSummary = {
  baseline: number
  topUp: number
  deductions: number
  entitlement: number
  unlocked: number
  claimable: number
  committed: number
  deployed: number
  available: number
}

function positive(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export function sumAdjustments(adjustments: FundingAdjustmentInput[]) {
  return adjustments.reduce(
    (totals, adjustment) => {
      const amount = positive(adjustment.amount)
      if (adjustment.type === 'top_up') totals.topUps += amount
      if (adjustment.type === 'deduction') totals.deductions += amount
      return totals
    },
    { topUps: 0, deductions: 0 }
  )
}

export function computeInvoiceFundingTotals(invoices: FundingInvoiceInput[]) {
  return invoices.reduce(
    (totals, invoice) => {
      if (invoice.batchedIntoId) return totals
      const amount = positive(invoice.amountGbp)
      if (invoice.status === 'approved') totals.committed += amount
      if (invoice.status === 'paid') totals.deployed += amount
      return totals
    },
    { committed: 0, deployed: 0 }
  )
}

export function computeStartupFunding(input: StartupFundingInput): StartupFundingSummary {
  const baseline = positive(input.baseline)
  const approvedMilestones = positive(input.approvedMilestones)
  const topUp = positive(input.topUps)
  const deductions = positive(input.deductions)
  const committed = positive(input.committedInvoices)
  const deployed = positive(input.deployedInvoices)

  const unlocked = Math.min(approvedMilestones, baseline)
  const claimable = Math.max(0, unlocked + topUp - deductions)
  const entitlement = Math.max(0, baseline + topUp - deductions)
  const available = Math.max(0, claimable - committed - deployed)

  return {
    baseline: roundCurrency(baseline),
    topUp: roundCurrency(topUp),
    deductions: roundCurrency(deductions),
    entitlement: roundCurrency(entitlement),
    unlocked: roundCurrency(unlocked),
    claimable: roundCurrency(claimable),
    committed: roundCurrency(committed),
    deployed: roundCurrency(deployed),
    available: roundCurrency(available),
  }
}

export function computeTopUpPool(input: {
  totalAllocation: number
  baselinePerStartup: number
  includedStartupCount: number
  topUpsAllocated: number
  deductionsReturned: number
}): number {
  const totalAllocation = positive(input.totalAllocation)
  const baselineReserve = positive(input.baselinePerStartup) * positive(input.includedStartupCount)
  const topUpsAllocated = positive(input.topUpsAllocated)
  const deductionsReturned = positive(input.deductionsReturned)
  return roundCurrency(totalAllocation - baselineReserve - topUpsAllocated + deductionsReturned)
}

export function canDeductAvailable(
  summary: Pick<StartupFundingSummary, 'available'>,
  amount: number
) {
  const normalized = positive(amount)
  return normalized > 0 && normalized <= summary.available
}
