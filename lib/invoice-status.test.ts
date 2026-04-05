import { describe, it, expect } from 'bun:test'

import {
  getInvoiceStatusVariant,
  getInvoiceStatusLabel,
  matchesInvoiceStatusFilter,
  type InvoiceStatus,
} from './invoice-status'

describe('getInvoiceStatusVariant', () => {
  it("should return 'success' for approved", () => {
    expect(getInvoiceStatusVariant('approved')).toBe('success')
  })

  it("should return 'danger' for rejected", () => {
    expect(getInvoiceStatusVariant('rejected')).toBe('danger')
  })

  it("should return 'info' for paid", () => {
    expect(getInvoiceStatusVariant('paid')).toBe('info')
  })

  it("should return 'warning' for submitted", () => {
    expect(getInvoiceStatusVariant('submitted')).toBe('warning')
  })

  it("should return 'warning' for under_review", () => {
    expect(getInvoiceStatusVariant('under_review')).toBe('warning')
  })

  it("should return 'secondary' for unknown status", () => {
    expect(getInvoiceStatusVariant('unknown')).toBe('secondary')
    expect(getInvoiceStatusVariant('')).toBe('secondary')
  })
})

describe('getInvoiceStatusLabel', () => {
  it('should return correct labels for each known status', () => {
    expect(getInvoiceStatusLabel('submitted')).toBe('Submitted')
    expect(getInvoiceStatusLabel('under_review')).toBe('Under Review')
    expect(getInvoiceStatusLabel('approved')).toBe('Approved')
    expect(getInvoiceStatusLabel('rejected')).toBe('Rejected')
    expect(getInvoiceStatusLabel('paid')).toBe('Paid')
  })

  it('should replace underscores with spaces for unknown status', () => {
    expect(getInvoiceStatusLabel('some_other_status')).toBe('some other status')
  })
})

describe('matchesInvoiceStatusFilter', () => {
  const allStatuses: InvoiceStatus[] = ['submitted', 'under_review', 'approved', 'rejected', 'paid']

  it("should match all statuses when filter is 'all'", () => {
    for (const status of allStatuses) {
      expect(matchesInvoiceStatusFilter(status, 'all')).toBe(true)
    }
  })

  it("should match only submitted and under_review when filter is 'pending'", () => {
    expect(matchesInvoiceStatusFilter('submitted', 'pending')).toBe(true)
    expect(matchesInvoiceStatusFilter('under_review', 'pending')).toBe(true)
    expect(matchesInvoiceStatusFilter('approved', 'pending')).toBe(false)
    expect(matchesInvoiceStatusFilter('rejected', 'pending')).toBe(false)
    expect(matchesInvoiceStatusFilter('paid', 'pending')).toBe(false)
  })

  it('should match exact status when filter is a specific status', () => {
    expect(matchesInvoiceStatusFilter('approved', 'approved')).toBe(true)
    expect(matchesInvoiceStatusFilter('paid', 'paid')).toBe(true)
  })

  it('should return false when status does not match filter', () => {
    expect(matchesInvoiceStatusFilter('approved', 'rejected')).toBe(false)
    expect(matchesInvoiceStatusFilter('submitted', 'paid')).toBe(false)
  })
})
