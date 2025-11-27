'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Save } from 'lucide-react'
import { useAppMutation } from '@/lib/hooks/useAppMutation'

const profileSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  full_name: z.string().min(1, 'Name is required'),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['admin-profile'],
    queryFn: async () => {
      const response = await fetch('/api/admin/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      return response.json()
    },
  })

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: '',
      full_name: '',
    },
    values: profile
      ? {
          email: profile.email || '',
          full_name: profile.full_name || '',
        }
      : undefined,
  })

  const updateProfile = useAppMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email || null,
          full_name: data.full_name,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }
      return response.json()
    },
    invalidateQueries: [['admin-profile'], ['admin-users']],
    successMessage: 'Profile updated successfully',
  })

  function onSubmit(data: ProfileFormData) {
    updateProfile.mutate(data)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your admin profile information. This information will be displayed in the admin
          list.
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your name and email address. These fields are used to identify you in the admin
            portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormDescription>
                        Your display name as it will appear in the admin list.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@example.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Your email address. This can be different from your Clerk account email.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={updateProfile.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
