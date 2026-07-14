import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
<<<<<<< HEAD
  title: 'Kyma — Autonomous Trading Intelligence',
=======
  title: 'Agent.OS — Autonomous Trading Intelligence',
>>>>>>> 329e9be2135d833cd4216995a8008f2985cca82d
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
