'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function GoogleAnalytics() {
    const [hasConsent, setHasConsent] = useState(false)

    useEffect(() => {
        // Check if user has accepted cookies
        const checkConsent = () => {
            const consent = localStorage.getItem('cookie-consent')
            setHasConsent(consent === 'accepted')
        }

        // Check immediately
        checkConsent()

        // Also listen for storage changes (in case user accepts later)
        const handleStorageChange = () => {
            checkConsent()
        }

        window.addEventListener('storage', handleStorageChange)

        // Custom event for same-tab updates
        const interval = setInterval(checkConsent, 1000)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            clearInterval(interval)
        }
    }, [])

    // Don't render anything if no consent or no GA ID
    if (!hasConsent || !GA_MEASUREMENT_ID) {
        return null
    }

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', {
                        anonymize_ip: true
                    });
                `}
            </Script>
        </>
    )
}
