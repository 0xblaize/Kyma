import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kyma — Autonomous Trading Intelligence',
  description: 'Perception → Decision → Execution → Risk → Exit',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Inline zinc-950 paints BEFORE Tailwind/global CSS loads, killing the
    // white flash on refresh and matching Spec §1.1's #09090B base.
    <html lang="en" style={{ background: '#09090b' }}>
      <body style={{ background: '#09090b' }}>{children}</body>
    </html>
  )
}
