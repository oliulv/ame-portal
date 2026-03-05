'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { founderInvoiceUploadSchema, type FounderInvoiceUploadFormData } from '@/lib/schemas'
import { Upload, ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewInvoicePage() {
  const router = useRouter()
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const generateUploadUrl = useMutation(api.invoices.generateUploadUrl)
  const createInvoice = useMutation(api.invoices.create)
  const startupName = useQuery(api.invoices.getFounderStartupName)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)

  const available = fundingSummary?.available ?? 0

  const form = useForm<FounderInvoiceUploadFormData>({
    resolver: zodResolver(founderInvoiceUploadSchema),
    defaultValues: {
      vendor_name: '',
      invoice_date: '',
      description: '',
    },
  })

  const invoiceNamePattern = startupName
    ? new RegExp(`^${startupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Invoice \\d+\\.pdf$`, 'i')
    : null
  const receiptNamePattern = startupName
    ? new RegExp(`^${startupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Receipt \\d+\\.pdf$`, 'i')
    : null

  // Extract invoice number from filename for receipt matching
  const invoiceNumber = invoiceFile?.name.match(/Invoice (\d+)\.pdf$/i)?.[1] ?? null

  const invoiceNameError =
    invoiceFile && invoiceNamePattern && !invoiceNamePattern.test(invoiceFile.name)
      ? `Must be named "${startupName} Invoice {number}.pdf"`
      : invoiceFile && !invoiceFile.name.toLowerCase().endsWith('.pdf')
        ? 'Must be a PDF file'
        : null

  const receiptNameError = (() => {
    if (!receiptFile) return null
    if (!receiptFile.name.toLowerCase().endsWith('.pdf')) return 'Must be a PDF file'
    if (receiptNamePattern && !receiptNamePattern.test(receiptFile.name))
      return `Must be named "${startupName} Receipt {number}.pdf"`
    // Enforce matching number between invoice and receipt
    if (invoiceNumber) {
      const receiptNumber = receiptFile.name.match(/Receipt (\d+)\.pdf$/i)?.[1] ?? null
      if (receiptNumber && receiptNumber !== invoiceNumber)
        return `Receipt number must match invoice number (${invoiceNumber})`
    }
    return null
  })()

  const amountValue = form.watch('amount_gbp')
  const amountExceedsBalance = typeof amountValue === 'number' && amountValue > available

  const canSubmit = !!invoiceFile && !invoiceNameError && !receiptNameError && !amountExceedsBalance

  const onSubmit = async (data: FounderInvoiceUploadFormData) => {
    if (!invoiceFile) {
      toast.error('Please select an invoice file to upload')
      return
    }

    if (invoiceNameError) {
      toast.error(invoiceNameError)
      return
    }

    if (receiptNameError) {
      toast.error(receiptNameError)
      return
    }

    if (amountExceedsBalance) {
      toast.error(`Amount exceeds available balance of £${available.toFixed(2)}`)
      return
    }

    setIsSubmitting(true)

    try {
      // Upload invoice file
      const invoiceUploadUrl = await generateUploadUrl()
      const invoiceUploadResult = await fetch(invoiceUploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': invoiceFile.type },
        body: invoiceFile,
      })
      if (!invoiceUploadResult.ok) throw new Error('Failed to upload invoice file')
      const { storageId: invoiceStorageId } = await invoiceUploadResult.json()

      // Upload receipt file if present
      let receiptStorageId: string | undefined
      let receiptFileName: string | undefined
      if (receiptFile) {
        const receiptUploadUrl = await generateUploadUrl()
        const receiptUploadResult = await fetch(receiptUploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': receiptFile.type },
          body: receiptFile,
        })
        if (!receiptUploadResult.ok) throw new Error('Failed to upload receipt file')
        const result = await receiptUploadResult.json()
        receiptStorageId = result.storageId
        receiptFileName = receiptFile.name
      }

      await createInvoice({
        storageId: invoiceStorageId,
        fileName: invoiceFile.name,
        vendorName: data.vendor_name,
        invoiceDate: data.invoice_date,
        amountGbp: data.amount_gbp,
        description: data.description || undefined,
        receiptStorageId: receiptStorageId as never,
        receiptFileName,
      })

      toast.success('Invoice uploaded successfully')
      router.push('/founder/invoices')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <Link href="/founder/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Upload Invoice</h1>
          <p className="text-muted-foreground">Submit a new invoice for review and reimbursement</p>
        </div>
      </div>

      {/* Naming rules */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-start gap-3 pt-4 pb-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">File naming rules</p>
            <ul className="mt-1 space-y-0.5 text-amber-800">
              <li>
                Invoice:{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono">
                  {startupName ?? 'YourStartup'} Invoice N.pdf
                </code>
              </li>
              <li>
                Receipt:{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono">
                  {startupName ?? 'YourStartup'} Receipt N.pdf
                </code>
              </li>
              <li>PDF only. Each invoice number must be unique. Duplicates will be rejected.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>
            Fill in the invoice information and upload the invoice and receipt documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="vendor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Amazon, Office Supplies Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount_gbp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          inputMode="decimal"
                          placeholder="500"
                          {...field}
                          value={field.value ?? ''}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? undefined : Number(value))
                          }}
                        />
                      </FormControl>
                      {amountExceedsBalance && (
                        <p className="text-sm text-destructive">
                          Exceeds available balance of £{available.toFixed(2)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this invoice..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Invoice File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Invoice File (Required — PDF only)
                </label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                {invoiceFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {invoiceFile.name} ({(invoiceFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {invoiceNameError && <p className="text-sm text-destructive">{invoiceNameError}</p>}
              </div>

              {/* Receipt File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Receipt File (Recommended — PDF only)
                </label>
                <p className="text-xs text-muted-foreground">
                  Collate all receipts for this invoice into a single PDF.
                </p>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                {receiptFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {receiptNameError && <p className="text-sm text-destructive">{receiptNameError}</p>}
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/founder/invoices">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || !canSubmit}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Uploading...' : 'Upload Invoice'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
