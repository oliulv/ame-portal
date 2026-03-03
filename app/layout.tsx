import type { Metadata } from 'next'
import { Geist_Mono, Source_Serif_4, Work_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ConvexClientProvider } from '@/components/providers/ConvexClientProvider'
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider'
import './globals.css'

const workSans = Work_Sans({
  variable: '--font-work-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
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
          <body
            className={`${workSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
          >
            {children}
            <AnalyticsProvider />
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  )
}
