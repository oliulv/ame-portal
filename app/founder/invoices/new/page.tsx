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
import { Upload, ArrowLeft, AlertTriangle, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewInvoicePage() {
  const router = useRouter()
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const generateUploadUrl = useMutation(api.invoices.generateUploadUrl)
  const createInvoice = useMutation(api.invoices.create)
  const invoiceInfo = useQuery(api.invoices.getFounderInvoiceInfo)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)

  const startupName = invoiceInfo?.startupName ?? null
  const expectedNumber = invoiceInfo?.nextInvoiceNumber ?? 1
  const available = fundingSummary?.available ?? 0

  const form = useForm<FounderInvoiceUploadFormData>({
    resolver: zodResolver(founderInvoiceUploadSchema),
    defaultValues: {
      vendor_name: '',
      invoice_date: '',
      description: '',
    },
  })

  const invoiceNameError = (() => {
    if (!invoiceFile) return null
    if (!invoiceFile.name.toLowerCase().endsWith('.pdf')) return 'Must be a PDF file'
    if (!startupName) return null
    const pattern = new RegExp(
      `^${startupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Invoice \\d+\\.pdf$`,
      'i'
    )
    if (!pattern.test(invoiceFile.name))
      return `Must be named "${startupName} Invoice ${expectedNumber}.pdf"`
    const num = invoiceFile.name.match(/Invoice (\d+)\.pdf$/i)?.[1]
    if (num && parseInt(num, 10) !== expectedNumber)
      return `Invoice number must be ${expectedNumber}. Please name your file "${startupName} Invoice ${expectedNumber}.pdf".`
    return null
  })()

  const receiptNameErrors: (string | null)[] = receiptFiles.map((file, i) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return 'Must be a PDF file'
    if (!startupName) return null
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const expectedLetter = letters[i] ?? '?'
    const escapedName = startupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(
      `^${escapedName} Receipt ${expectedNumber}-${expectedLetter}\\.pdf$`,
      'i'
    )
    if (!pattern.test(file.name))
      return `Must be named "${startupName} Receipt ${expectedNumber}-${expectedLetter}.pdf"`
    return null
  })
  const hasReceiptErrors = receiptNameErrors.some((e) => e !== null)

  const amountValue = form.watch('amount_gbp')
  const amountExceedsBalance = typeof amountValue === 'number' && amountValue > available

  const canSubmit =
    !!invoiceFile &&
    receiptFiles.length > 0 &&
    !invoiceNameError &&
    !hasReceiptErrors &&
    !amountExceedsBalance

  const onSubmit = async (data: FounderInvoiceUploadFormData) => {
    if (!invoiceFile) {
      toast.error('Please select an invoice file to upload')
      return
    }

    if (receiptFiles.length === 0) {
      toast.error('Please select at least one receipt file')
      return
    }

    if (invoiceNameError) {
      toast.error(invoiceNameError)
      return
    }

    if (hasReceiptErrors) {
      toast.error('One or more receipt files have naming errors')
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

      // Upload all receipt files sequentially
      const receiptStorageIds: string[] = []
      const receiptFileNames: string[] = []
      for (const file of receiptFiles) {
        const uploadUrl = await generateUploadUrl()
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!result.ok) throw new Error(`Failed to upload receipt: ${file.name}`)
        const { storageId } = await result.json()
        receiptStorageIds.push(storageId)
        receiptFileNames.push(file.name)
      }

      await createInvoice({
        storageId: invoiceStorageId,
        fileName: invoiceFile.name,
        vendorName: data.vendor_name,
        invoiceDate: data.invoice_date,
        amountGbp: data.amount_gbp,
        description: data.description || undefined,
        receiptStorageIds: receiptStorageIds as any,
        receiptFileNames,
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
                  {startupName ?? 'YourStartup'} Invoice {expectedNumber}.pdf
                </code>
              </li>
              <li>
                Receipts:{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono">
                  {startupName ?? 'YourStartup'} Receipt {expectedNumber}-A.pdf
                </code>
                {', '}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono">
                  ...{expectedNumber}-B.pdf
                </code>
                {' etc.'}
              </li>
              <li>
                PDF only. Your next invoice number is <strong>{expectedNumber}</strong>. Numbers
                must be sequential. Use letters (A, B, C...) for multiple receipts.
              </li>
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
              <TooltipProvider>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium leading-none">
                      Invoice File (Required — PDF only)
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[280px]">
                        <p>
                          A PDF document from your company or you as a founder, addressed to
                          Accelerate ME, requesting reimbursement for expenses.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
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
                  {invoiceNameError && (
                    <p className="text-sm text-destructive">{invoiceNameError}</p>
                  )}
                </div>

                {/* Receipt File Upload */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium leading-none">
                      Receipt Files (Required — PDF only, multiple allowed)
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[280px]">
                        <p>
                          The actual proof-of-purchase receipts from the vendor or supplier. You can
                          upload multiple receipt PDFs — name them with letters (A, B, C...).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files
                      if (files) setReceiptFiles(Array.from(files))
                    }}
                    className="cursor-pointer"
                  />
                  {receiptFiles.length > 0 && (
                    <div className="space-y-1">
                      {receiptFiles.map((file, i) => (
                        <div key={i}>
                          <p className="text-sm text-muted-foreground">
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </p>
                          {receiptNameErrors[i] && (
                            <p className="text-sm text-destructive">{receiptNameErrors[i]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TooltipProvider>

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
