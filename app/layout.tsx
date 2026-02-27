import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Accelerate ME',
  description: 'Internal tool for managing cohorts, startups, and founders',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider signInUrl="/login">
      <ConvexClientProvider>
        <html lang="en">
          <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
            {children}
            <Analytics
              beforeSend={(event) => {
                // Don't waste quota on admin/internal pages
                if (new URL(event.url).pathname.startsWith('/admin')) {
                  return null
                }
                return event
              }}
            />
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  )
}
