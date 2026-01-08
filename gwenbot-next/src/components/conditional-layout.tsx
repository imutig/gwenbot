'use client'

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect } from 'react'
import Navbar from '@/components/navbar'
import ClientLayout from '@/components/client-layout'

interface ConditionalLayoutProps {
    children: ReactNode
    floralBackground: ReactNode
}

export default function ConditionalLayout({ children, floralBackground }: ConditionalLayoutProps) {
    const pathname = usePathname()
    const isOverlay = pathname?.startsWith('/overlay')

    // Add/remove overlay-mode class on body
    useEffect(() => {
        if (isOverlay) {
            document.body.classList.add('overlay-mode')
        } else {
            document.body.classList.remove('overlay-mode')
        }
        return () => {
            document.body.classList.remove('overlay-mode')
        }
    }, [isOverlay])

    // For overlay routes: no navbar, no background, no footer
    if (isOverlay) {
        return (
            <div style={{ background: 'transparent' }}>
                {children}
            </div>
        )
    }

    // Normal routes: full layout with navbar, background, footer
    return (
        <>
            {floralBackground}
            <Navbar />
            <ClientLayout>
                <main className="main-content">
                    {children}
                </main>
                <footer className="footer">
                    <p>Powered by <a href="#">GwenBot</a></p>
                </footer>
            </ClientLayout>
        </>
    )
}

