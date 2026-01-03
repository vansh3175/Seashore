import type { Metadata } from 'next'
import { Inter, Orbitron } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import GlobalRecovery from '@/components/GlobalRecovery'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })

export const metadata: Metadata = {
  title: 'Seashore',
  description: 'Video recording platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${orbitron.variable}`}>
        <body className="bg-[#060A14] text-white antialiased overflow-x-hidden">
            {children}
          <GlobalRecovery/>
        </body>
      </html>
    </ClerkProvider>
  )
}