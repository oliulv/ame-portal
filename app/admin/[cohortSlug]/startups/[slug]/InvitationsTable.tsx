'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { FounderDetailsDialog } from './FounderDetailsDialog'

interface FounderProfile {
  id: string
  full_name: string
  personal_email: string
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  phone?: string
  bio?: string
  linkedin_url?: string
  x_url?: string
  onboarding_status: string
}

interface Invitation {
  id: string
  full_name: string
  email: string
  accepted_at: string | null
  created_at: string
  created_at_formatted: string
  expires_at: string
  founderProfile: FounderProfile | null
}

interface InvitationsTableProps {
  invitations: Invitation[]
}

export function InvitationsTable({ invitations }: InvitationsTableProps) {
  const router = useRouter()
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null)

  async function handleResend(invitationId: string) {
    setResendingId(invitationId)
    
    try {
      const response = await fetch(`/api/admin/invitations/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to resend invitation')
      }

      toast.success('Invitation resent successfully')
      
      // Refresh the page to update the invitations list
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  if (invitations.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No founders invited yet
      </p>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => {
            const isAccepted = !!invitation.accepted_at
            const isExpired = !isAccepted && new Date(invitation.expires_at) < new Date()
            const status = isAccepted ? 'accepted' : isExpired ? 'expired' : 'pending'
            const canResend = !isAccepted
            
            return (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">{invitation.full_name}</TableCell>
                <TableCell>{invitation.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      status === 'accepted'
                        ? 'success'
                        : status === 'expired'
                        ? 'destructive'
                        : 'info'
                    }
                  >
                    {status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {invitation.created_at_formatted}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isAccepted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedInvitation(invitation)}
                      >
                        <Eye className="mr-2 h-3 w-3" />
                        View More
                      </Button>
                    )}
                    {canResend && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResend(invitation.id)}
                        disabled={resendingId === invitation.id}
                      >
                        <RefreshCw
                          className={`mr-2 h-3 w-3 ${
                            resendingId === invitation.id ? 'animate-spin' : ''
                          }`}
                        />
                        Resend
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {selectedInvitation && (
        <FounderDetailsDialog
          open={!!selectedInvitation}
          onOpenChange={(open) => !open && setSelectedInvitation(null)}
          founderProfile={selectedInvitation.founderProfile}
          invitationEmail={selectedInvitation.email}
          invitationName={selectedInvitation.full_name}
        />
      )}
    </>
  )
}

