import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import BingwenBoard from './bingwen-board'

export default async function BingwenPage() {
    const supabase = await createClient()

    if (!supabase) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl backdrop-blur-md text-center">
                    <h1 className="text-xl font-bold mb-2">Configuration requise</h1>
                    <p className="text-slate-400">Supabase n'est pas configuré.</p>
                </div>
            </div>
        )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth/login?next=/bingwen')
    }

    return (
        <div className="animate-fadeIn pb-20 flex flex-col items-center justify-center min-h-[80vh]">
            <BingwenBoard />
        </div>
    )
}
