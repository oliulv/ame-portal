import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider'
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
            <AnalyticsProvider />
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  )
}
