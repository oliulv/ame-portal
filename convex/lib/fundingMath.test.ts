import { describe, it, expect } from 'bun:test'
import {
  canDeductAvailable,
  computeInvoiceFundingTotals,
  computeStartupFunding,
  computeTopUpPool,
} from './fundingMath'

describe('fundingMath', () => {
  it('caps baseline claimable by approved milestones', () => {
    const summary = computeStartupFunding({
      baseline: 5000,
      approvedMilestones: 8000,
      topUps: 0,
      deductions: 0,
      committedInvoices: 0,
      deployedInvoices: 0,
    })

    expect(summary.unlocked).toBe(5000)
    expect(summary.available).toBe(5000)
  })

  it('increases available immediately for top-ups', () => {
    const summary = computeStartupFunding({
      baseline: 5000,
      approvedMilestones: 1000,
      topUps: 1500,
      deductions: 0,
      committedInvoices: 0,
      deployedInvoices: 0,
    })

    expect(summary.entitlement).toBe(6500)
    expect(summary.available).toBe(2500)
  })

  it('deducts only from unspent available funding', () => {
    const summary = computeStartupFunding({
      baseline: 5000,
      approvedMilestones: 5000,
      topUps: 1000,
      deductions: 750,
      committedInvoices: 0,
      deployedInvoices: 0,
    })

    expect(summary.entitlement).toBe(5250)
    expect(summary.available).toBe(5250)
    expect(canDeductAvailable(summary, 5251)).toBe(false)
    expect(canDeductAvailable(summary, 5250)).toBe(true)
  })

  it('protects approved and paid invoices from availability', () => {
    const summary = computeStartupFunding({
      baseline: 5000,
      approvedMilestones: 5000,
      topUps: 500,
      deductions: 0,
      committedInvoices: 1200,
      deployedInvoices: 1500,
    })

    expect(summary.committed).toBe(1200)
    expect(summary.deployed).toBe(1500)
    expect(summary.available).toBe(2800)
  })

  it('moves an invoice from committed to deployed without double counting', () => {
    const approved = computeStartupFunding({
      baseline: 5000,
      approvedMilestones: 5000,
      topUps: 0,
      deductions: 0,
      committedInvoices: 2000,
      deployedInvoices: 0,
    })
    const paid = computeStartupFunding({
      baseline: 5000,
      approvedMilestones: 5000,
      topUps: 0,
      deductions: 0,
      committedInvoices: 0,
      deployedInvoices: 2000,
    })

    expect(approved.available).toBe(3000)
    expect(paid.available).toBe(3000)
  })

  it('excludes batched component invoices from committed and deployed totals', () => {
    const totals = computeInvoiceFundingTotals([
      { status: 'approved', amountGbp: 500, batchedIntoId: 'batch' },
      { status: 'paid', amountGbp: 750, batchedIntoId: 'batch' },
      { status: 'approved', amountGbp: 1000 },
      { status: 'paid', amountGbp: 2000 },
    ])

    expect(totals).toEqual({ committed: 1000, deployed: 2000 })
  })

  it('decreases top-up pool on allocation and increases it on deduction', () => {
    expect(
      computeTopUpPool({
        totalAllocation: 70000,
        baselinePerStartup: 5000,
        includedStartupCount: 12,
        topUpsAllocated: 2500,
        deductionsReturned: 500,
      })
    ).toBe(8000)
  })
})
