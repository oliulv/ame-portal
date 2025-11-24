'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExternalLink } from 'lucide-react'

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

interface FounderDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  founderProfile: FounderProfile | null
  invitationEmail: string
  invitationName: string
}

export function FounderDetailsDialog({
  open,
  onOpenChange,
  founderProfile,
  invitationEmail,
  invitationName,
}: FounderDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Founder Details</DialogTitle>
          <DialogDescription>
            Complete information for {invitationName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <span className="text-xs text-muted-foreground">Full Name</span>
                <p className="text-sm font-medium">{invitationName}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Email</span>
                <p className="text-sm font-medium">{invitationEmail}</p>
              </div>
              {founderProfile?.phone && (
                <div>
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <p className="text-sm font-medium">{founderProfile.phone}</p>
                </div>
              )}
              {founderProfile?.onboarding_status && (
                <div>
                  <span className="text-xs text-muted-foreground">Onboarding Status</span>
                  <p className="text-sm font-medium capitalize">
                    {founderProfile.onboarding_status.replace('_', ' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {founderProfile && (
            <>
              {(founderProfile.address_line1 ||
                founderProfile.city ||
                founderProfile.postcode ||
                founderProfile.country) && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Address</h3>
                  <div className="space-y-1">
                    {founderProfile.address_line1 && (
                      <p className="text-sm">{founderProfile.address_line1}</p>
                    )}
                    {founderProfile.address_line2 && (
                      <p className="text-sm">{founderProfile.address_line2}</p>
                    )}
                    <div className="flex gap-2">
                      {founderProfile.city && (
                        <span className="text-sm">{founderProfile.city}</span>
                      )}
                      {founderProfile.postcode && (
                        <span className="text-sm">{founderProfile.postcode}</span>
                      )}
                    </div>
                    {founderProfile.country && (
                      <p className="text-sm">{founderProfile.country}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Bio */}
              {founderProfile.bio && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Bio</h3>
                  <p className="text-sm text-muted-foreground">{founderProfile.bio}</p>
                </div>
              )}

              {/* Social Links */}
              {(founderProfile.linkedin_url || founderProfile.x_url) && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Social Links</h3>
                  <div className="flex flex-wrap gap-4">
                    {founderProfile.linkedin_url && (
                      <a
                        href={founderProfile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center"
                      >
                        LinkedIn
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    )}
                    {founderProfile.x_url && (
                      <a
                        href={founderProfile.x_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center"
                      >
                        X (Twitter)
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Not Onboarded Message */}
          {!founderProfile && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                This founder has accepted the invitation but hasn't completed onboarding yet.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

