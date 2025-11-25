import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function AccessRequiredPage() {
  const { userId } = await auth()

  // If somehow hit this page without being authenticated, send to login
  if (!userId) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
            <CardDescription>
              Hey there! You're probably not supposed to see this.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account is authenticated, but you haven't been invited as a founder or granted admin access yet.
              If you believe you should have access, please contact an administrator.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>You'll need to be invited before you can access the platform.</li>
              <li>
                If you were expecting an invitation email, check with the programme team that it was
                sent to the correct address.
              </li>
            </ul>

            <div className="pt-2">
              <Button variant="outline" asChild className="w-full">
                <a href="/login">Sign out and switch account</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


