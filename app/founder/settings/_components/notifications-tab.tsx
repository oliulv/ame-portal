'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { ConvexError } from 'convex/values'
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
  smsNumberSchema,
  smsVerificationSchema,
  type SmsNumberFormData,
  type SmsVerificationFormData,
} from '@/lib/schemas'
import { CheckCircle2, MessageSquare, Shield, Loader2 } from 'lucide-react'
import { ACTIVE_NOTIFICATION_TYPES } from '@/convex/lib/notificationTypes'

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) return err.data as string
  if (err instanceof Error) return err.message
  return fallback
}

export function NotificationsTab({
  prefillPhone,
  userRole,
}: {
  prefillPhone?: string
  userRole?: 'super_admin' | 'admin' | 'founder'
}) {
  const phoneData = useQuery(api.notifications.getMyPhone)
  const requestVerification = useMutation(api.notifications.requestVerification)
  const confirmVerification = useMutation(api.notifications.confirmVerification)
  const updatePreferences = useMutation(api.notifications.updatePreferences)
  const toggleNotifications = useMutation(api.notifications.toggleNotifications)
  const removeNumber = useMutation(api.notifications.removeNumber)

  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showVerification, setShowVerification] = useState(false)

  const phoneForm = useForm<SmsNumberFormData>({
    resolver: zodResolver(smsNumberSchema),
    defaultValues: { phone: prefillPhone || '' },
  })

  const codeForm = useForm<SmsVerificationFormData>({
    resolver: zodResolver(smsVerificationSchema),
    defaultValues: { code: '' },
  })

  const smsRecord = phoneData?.smsRecord
  const preferences = phoneData?.preferences

  // Prefill phone if provided and no existing number
  useEffect(() => {
    if (prefillPhone && !smsRecord) {
      phoneForm.setValue('phone', prefillPhone)
    }
  }, [prefillPhone, smsRecord, phoneForm])

  if (phoneData === undefined) {
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

  const handleRequestCode = async (data: SmsNumberFormData) => {
    setIsRequestingCode(true)
    try {
      await requestVerification({ phone: data.phone })
      setShowVerification(true)
      toast.success('Verification code sent via SMS')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to send verification code'))
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleVerify = async (data: SmsVerificationFormData) => {
    setIsVerifying(true)
    try {
      await confirmVerification({ code: data.code })
      setShowVerification(false)
      codeForm.reset()
      toast.success('Phone number verified successfully')
    } catch (err) {
      toast.error(errorMessage(err, 'Verification failed'))
    } finally {
      setIsVerifying(false)
    }
  }

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleNotifications({ enabled })
      toast.success(enabled ? 'Notifications enabled' : 'Notifications paused')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update'))
    }
  }

  const handlePreferenceChange = async (key: string, value: boolean) => {
    try {
      await updatePreferences({ [key]: value })
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update preference'))
    }
  }

  const handleRemove = async () => {
    try {
      await removeNumber()
      setShowVerification(false)
      phoneForm.reset({ phone: '' })
      toast.success('Phone number removed')
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to remove number'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Phone Number Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Notifications
          </CardTitle>
          <CardDescription>
            Receive real-time updates about invoices, milestones, events, and announcements via SMS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {smsRecord?.isVerified ? (
            // Verified state
            <div className="space-y-4">
              <div className="flex items-center justify-between border p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">{smsRecord.phone}</p>
                    <p className="text-sm text-muted-foreground">
                      Verified{' '}
                      {smsRecord.verifiedAt &&
                        new Date(smsRecord.verifiedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {smsRecord.notificationsEnabled ? 'Active' : 'Paused'}
                    </span>
                    <Switch
                      checked={smsRecord.notificationsEnabled}
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
                          <FormLabel>Phone Number</FormLabel>
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
                      <strong>{smsRecord?.phone || phoneForm.getValues('phone')}</strong> via SMS
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
      {smsRecord?.isVerified && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose which notifications you want to receive</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ACTIVE_NOTIFICATION_TYPES.filter((t) => {
                const isAdmin = userRole === 'admin' || userRole === 'super_admin'
                if (isAdmin) return true // admins see all types
                return t.audience === 'founders' || t.audience === 'all'
              }).map((pref) => (
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
