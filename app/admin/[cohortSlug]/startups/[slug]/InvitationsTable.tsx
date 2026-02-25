'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Doc, Id } from '@/convex/_generated/dataModel'
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

type Invitation = Doc<'invitations'>

interface InvitationsTableProps {
  invitations: Invitation[]
}

export function InvitationsTable({ invitations }: InvitationsTableProps) {
  const resendInvitation = useMutation(api.invitations.resend)
  const [resendingId, setResendingId] = useState<Id<'invitations'> | null>(null)
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null)

  async function handleResend(invitationId: Id<'invitations'>) {
    setResendingId(invitationId)

    try {
      await resendInvitation({ id: invitationId })
      toast.success('Invitation resent successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  if (invitations.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No founders invited yet</p>
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
            const isAccepted = !!invitation.acceptedAt
            const isExpired = !isAccepted && new Date(invitation.expiresAt) < new Date()
            const status = isAccepted ? 'accepted' : isExpired ? 'expired' : 'pending'
            const canResend = !isAccepted

            return (
              <TableRow key={invitation._id}>
                <TableCell className="font-medium">{invitation.fullName}</TableCell>
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
                  {new Date(invitation._creationTime).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
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
                        onClick={() => handleResend(invitation._id)}
                        disabled={resendingId === invitation._id}
                      >
                        <RefreshCw
                          className={`mr-2 h-3 w-3 ${
                            resendingId === invitation._id ? 'animate-spin' : ''
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
          founderProfile={null}
          invitationEmail={selectedInvitation.email}
          invitationName={selectedInvitation.fullName}
        />
      )}
    </>
  )
}
