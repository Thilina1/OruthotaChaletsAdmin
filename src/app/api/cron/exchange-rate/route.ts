import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refreshExchangeRate } from '@/lib/exchange-rate';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
);

// Daily job (Vercel Cron, see vercel.json): fetch today's USD→LKR rate and,
// in Auto mode, apply it. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const result = await refreshExchangeRate(supabase);
        return NextResponse.json({
            ok: true,
            rate_date: result.row.rate_date,
            market_rate: result.row.market_rate,
            applied_rate: result.row.applied_rate,
            applied: result.applied,
            mode: result.settings.mode,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
