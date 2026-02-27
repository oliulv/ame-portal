'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from 'convex/react'
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
import { Upload, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewInvoicePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const generateUploadUrl = useMutation(api.invoices.generateUploadUrl)
  const createInvoice = useMutation(api.invoices.create)

  const form = useForm<FounderInvoiceUploadFormData>({
    resolver: zodResolver(founderInvoiceUploadSchema),
    defaultValues: {
      vendor_name: '',
      invoice_date: '',
      description: '',
    },
  })

  const onSubmit = async (data: FounderInvoiceUploadFormData) => {
    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    setIsSubmitting(true)

    try {
      // Upload file to Convex storage
      const uploadUrl = await generateUploadUrl()
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadResult.ok) {
        throw new Error('Failed to upload file')
      }

      const { storageId } = await uploadResult.json()

      // Create invoice record
      await createInvoice({
        storageId,
        fileName: file.name,
        vendorName: data.vendor_name,
        invoiceDate: data.invoice_date,
        amountGbp: data.amount_gbp,
        description: data.description || undefined,
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
          <h1 className="text-3xl font-bold tracking-tight">Upload Invoice</h1>
          <p className="text-muted-foreground">Submit a new invoice for review and reimbursement</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>
            Fill in the invoice information and upload the invoice document
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
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Invoice File (Required)
                </label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0]
                      if (selectedFile) {
                        setFile(selectedFile)
                      }
                    }}
                    className="cursor-pointer"
                  />
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
                {!file && (
                  <p className="text-sm text-muted-foreground">
                    Please upload a PDF or image file of your invoice
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-4">
                <Link href="/founder/invoices">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || !file}>
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
