import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'

import { SiteNav } from '@/components/site-nav'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const siteUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // The template is what per-job metadata plugs into:
  // "{title} at {company}" → "… — Dev Job Board". SPEC §8.
  title: {
    default: 'Dev Job Board',
    template: '%s — Dev Job Board',
  },
  description: 'Developer jobs in Japan. Every listing is reviewed before it goes public.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <nav
            aria-label="Main"
            className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4"
          >
            <Link href="/" className="font-semibold tracking-tight">
              Dev Job Board
            </Link>
            <SiteNav />
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t">
          <div className="text-muted-foreground mx-auto w-full max-w-5xl px-4 py-6 text-sm">
            Dev Job Board — a portfolio project.
          </div>
        </footer>

        <Toaster />
      </body>
    </html>
  )
}
