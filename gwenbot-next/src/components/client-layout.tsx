'use client'

import { ToastProvider } from '@/components/toast-context'
import { ReactNode } from 'react'

export default function ClientLayout({ children }: { children: ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>
}
