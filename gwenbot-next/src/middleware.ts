import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // === MAINTENANCE MODE ===
    const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'
    const bypassCookie = request.cookies.get('maintenance_bypass')?.value === 'true'

    // Debug log (visible in Railway logs)
    if (pathname === '/') {
        console.log(`[Middleware] MAINTENANCE_MODE=${process.env.MAINTENANCE_MODE}, bypassCookie=${bypassCookie}`)
    }

    // Allow access to maintenance page, bypass API, all API routes, and overlay routes
    const isMaintenancePath = pathname === '/maintenance' ||
        pathname.startsWith('/api/maintenance') ||
        pathname.startsWith('/api/') ||  // Allow all API routes through
        pathname.startsWith('/overlay')  // Allow overlay routes for OBS Browser Source

    if (maintenanceMode && !bypassCookie && !isMaintenancePath) {
        return NextResponse.redirect(new URL('/maintenance', request.url))
    }

    // If maintenance mode is off but user has bypass cookie and is on maintenance page, redirect to home
    if (!maintenanceMode && pathname === '/maintenance') {
        return NextResponse.redirect(new URL('/', request.url))
    }

    // === SUPABASE SESSION ===
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return supabaseResponse
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                )
                supabaseResponse = NextResponse.next({
                    request,
                })
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                )
            },
        },
    })

    // Refresh session if expired
    await supabase.auth.getUser()

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
