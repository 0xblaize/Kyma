import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kyma Terminal — AI Trading Intelligence',
  description: 'Kyma is a transparent, AI-governed crypto trading agent that analyzes market structure using Smart Money Concepts and executes governed strategies on-chain.',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
    shortcut: '/logo.jpg',
  },
  openGraph: {
    title: 'Kyma Terminal',
    description: 'AI-powered crypto trading with full transparency. Every trade decision explained.',
    images: ['/logo.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: '#09090b' }}>
      <head>
        <link rel="icon" href="/logo.jpg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body style={{ background: '#09090b' }}>{children}</body>
    </html>
  )
}
