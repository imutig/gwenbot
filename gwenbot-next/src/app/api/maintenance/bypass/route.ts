import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    const formData = await request.formData()
    const code = formData.get('code') as string

    const bypassCode = process.env.MAINTENANCE_BYPASS_CODE

    if (code && bypassCode && code === bypassCode) {
        const cookieStore = await cookies()
        cookieStore.set('maintenance_bypass', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        })
        return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.redirect(new URL('/maintenance?error=invalid', request.url))
}
