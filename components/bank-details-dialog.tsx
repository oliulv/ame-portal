'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface BankDetails {
  accountHolderName: string
  bankName?: string
  sortCode: string
  accountNumber: string
}

interface BankDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankDetails: BankDetails | null | undefined
  startupName: string
}

function CopyableField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="group">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={copy}
          className={`text-left hover:text-primary cursor-pointer transition-colors ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </button>
        <button
          onClick={copy}
          className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

export function BankDetailsDialog({
  open,
  onOpenChange,
  bankDetails,
  startupName,
}: BankDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bank Details</DialogTitle>
          <DialogDescription>Bank account details for {startupName}.</DialogDescription>
        </DialogHeader>
        {bankDetails === undefined ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : bankDetails === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No bank details have been submitted yet.
          </p>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <CopyableField label="Account Holder" value={bankDetails.accountHolderName} />
              {bankDetails.bankName && (
                <CopyableField label="Bank Name" value={bankDetails.bankName} />
              )}
              <CopyableField label="Sort Code" value={bankDetails.sortCode} mono />
              <CopyableField label="Account Number" value={bankDetails.accountNumber} mono />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
