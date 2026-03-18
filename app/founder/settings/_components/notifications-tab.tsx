'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  whatsappNumberSchema,
  whatsappVerificationSchema,
  type WhatsAppNumberFormData,
  type WhatsAppVerificationFormData,
} from '@/lib/schemas'
import { CheckCircle2, MessageSquare, Shield, Loader2 } from 'lucide-react'

export function NotificationsTab({ prefillPhone }: { prefillPhone?: string }) {
  const whatsappData = useQuery(api.whatsapp.getMyWhatsApp)
  const requestVerification = useMutation(api.whatsapp.requestVerification)
  const confirmVerification = useMutation(api.whatsapp.confirmVerification)
  const updatePreferences = useMutation(api.whatsapp.updatePreferences)
  const toggleNotifications = useMutation(api.whatsapp.toggleNotifications)
  const removeNumber = useMutation(api.whatsapp.removeNumber)

  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showVerification, setShowVerification] = useState(false)

  const phoneForm = useForm<WhatsAppNumberFormData>({
    resolver: zodResolver(whatsappNumberSchema),
    defaultValues: { phone: prefillPhone || '' },
  })

  const codeForm = useForm<WhatsAppVerificationFormData>({
    resolver: zodResolver(whatsappVerificationSchema),
    defaultValues: { code: '' },
  })

  const whatsapp = whatsappData?.whatsapp
  const preferences = whatsappData?.preferences

  // Prefill phone if provided and no existing number
  useEffect(() => {
    if (prefillPhone && !whatsapp) {
      phoneForm.setValue('phone', prefillPhone)
    }
  }, [prefillPhone, whatsapp, phoneForm])

  // Auto-dismiss verification form when verified (reactive update from Convex)
  useEffect(() => {
    if (whatsapp?.isVerified && showVerification) {
      setShowVerification(false)
      codeForm.reset()
      toast.success('WhatsApp number verified successfully')
    }
  }, [whatsapp?.isVerified, showVerification, codeForm])

  if (whatsappData === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  const handleRequestCode = async (data: WhatsAppNumberFormData) => {
    setIsRequestingCode(true)
    try {
      await requestVerification({ phone: data.phone })
      setShowVerification(true)
      toast.success('Verification code sent to your WhatsApp')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleVerify = async (data: WhatsAppVerificationFormData) => {
    setIsVerifying(true)
    try {
      await confirmVerification({ code: data.code })
      // The verification is checked asynchronously — show a pending message.
      // The Convex reactive query (whatsappData) will auto-update when isVerified flips to true.
      toast.info('Verifying your code...')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleNotifications({ enabled })
      toast.success(enabled ? 'Notifications enabled' : 'Notifications paused')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handlePreferenceChange = async (key: string, value: boolean) => {
    try {
      await updatePreferences({ [key]: value })
    } catch (err) {
      toast.error('Failed to update preference')
    }
  }

  const handleRemove = async () => {
    try {
      await removeNumber()
      setShowVerification(false)
      phoneForm.reset({ phone: '' })
      toast.success('WhatsApp number removed')
    } catch (err) {
      toast.error('Failed to remove number')
    }
  }

  return (
    <div className="space-y-6">
      {/* WhatsApp Number Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Notifications
          </CardTitle>
          <CardDescription>
            Receive real-time updates about invoices, milestones, events, and announcements via
            WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {whatsapp?.isVerified ? (
            // Verified state
            <div className="space-y-4">
              <div className="flex items-center justify-between border p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">{whatsapp.phone}</p>
                    <p className="text-sm text-muted-foreground">
                      Verified{' '}
                      {whatsapp.verifiedAt &&
                        new Date(whatsapp.verifiedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {whatsapp.notificationsEnabled ? 'Active' : 'Paused'}
                    </span>
                    <Switch
                      checked={whatsapp.notificationsEnabled}
                      onCheckedChange={handleToggle}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleRemove}>
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Unverified / setup state
            <div className="space-y-4">
              {!showVerification ? (
                <Form {...phoneForm}>
                  <form onSubmit={phoneForm.handleSubmit(handleRequestCode)} className="space-y-4">
                    <FormField
                      control={phoneForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+447700900000" {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter your number in international format (e.g. +44 for UK)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isRequestingCode}>
                      {isRequestingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Verification Code
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground border p-3 bg-muted/30">
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>
                      A 6-digit code has been sent to{' '}
                      <strong>{whatsapp?.phone || phoneForm.getValues('phone')}</strong> via
                      WhatsApp
                    </span>
                  </div>
                  <Form {...codeForm}>
                    <form onSubmit={codeForm.handleSubmit(handleVerify)} className="space-y-4">
                      <FormField
                        control={codeForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Verification Code</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="123456"
                                maxLength={6}
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                                  field.onChange(value)
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" disabled={isVerifying}>
                          {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Verify
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setShowVerification(false)
                            codeForm.reset()
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      {whatsapp?.isVerified && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose which notifications you want to receive</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  key: 'invoiceStatusChanged',
                  label: 'Invoice Updates',
                  description: 'When your invoices are approved or rejected',
                },
                {
                  key: 'milestoneStatusChanged',
                  label: 'Milestone Updates',
                  description: 'When your milestones are approved or need changes',
                },
                {
                  key: 'announcements',
                  label: 'Announcements',
                  description: 'Important announcements from the programme',
                },
                {
                  key: 'eventReminders',
                  label: 'Event Reminders',
                  description: 'Daily reminders for events happening today',
                },
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between border p-3">
                  <div>
                    <p className="font-medium text-sm">{pref.label}</p>
                    <p className="text-xs text-muted-foreground">{pref.description}</p>
                  </div>
                  <Switch
                    checked={
                      (preferences?.[pref.key as keyof typeof preferences] as boolean) ?? true
                    }
                    onCheckedChange={(checked) => handlePreferenceChange(pref.key, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
