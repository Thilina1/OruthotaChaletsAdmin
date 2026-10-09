import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApiUser, hasApiPathAccess } from '@/lib/api-auth';
import { colomboToday, loadFxSettings, refreshExchangeRate, saveFxSettings, setManualExchangeRate } from '@/lib/exchange-rate';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
);

// Managed from Chalet → Room Rates & Packages.
const PAGE_PATH = '/dashboard/chalet/rates';

async function authorise() {
    const user = await getApiUser();
    if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!hasApiPathAccess(user, PAGE_PATH)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { user };
}

async function currentStatus() {
    const settings = await loadFxSettings(supabase);
    const { data: history, error } = await supabase
        .from('exchange_rates')
        .select('id,rate_date,market_rate,margin_percent,applied_rate,source,is_manual,created_at,user:users(name)')
        .order('created_at', { ascending: false })
        .limit(30);
    if (error) throw error;
    const { data: inUse } = await supabase
        .from('chalet_rates')
        .select('usd_to_lkr_rate')
        .gt('usd_to_lkr_rate', 0)
        .limit(1)
        .maybeSingle();
    return {
        settings,
        today: colomboToday(),
        rate_in_use: Number(inUse?.usd_to_lkr_rate || 0),
        latest: history?.[0] || null,
        history: history || [],
    };
}

// GET: settings, the rate prices currently use, latest fetch and history.
// In Auto mode, fetches today's rate if it has not been fetched yet (so it
// works even when the daily job is not running, e.g. locally).
export async function GET() {
    try {
        const auth = await authorise();
        if (auth.error) return auth.error;
        let warning: string | null = null;
        const settings = await loadFxSettings(supabase);
        if (settings.mode === 'auto') {
            const { data: todayRows } = await supabase.from('exchange_rates').select('id').eq('rate_date', colomboToday()).limit(1);
            if (!todayRows || todayRows.length === 0) {
                try {
                    await refreshExchangeRate(supabase);
                } catch (error: any) {
                    warning = `${error.message}. Using the last saved rate.`;
                }
            }
        }
        return NextResponse.json({ ...(await currentStatus()), warning });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST { action: 'refresh' }            → fetch the live rate now
// POST { action: 'manual', rate }      → set today's rate by hand
export async function POST(request: Request) {
    try {
        const auth = await authorise();
        if (auth.error) return auth.error;
        const body = await request.json();
        if (body.action === 'refresh') {
            const result = await refreshExchangeRate(supabase);
            return NextResponse.json({ ...(await currentStatus()), applied: result.applied });
        }
        if (body.action === 'manual') {
            await setManualExchangeRate(supabase, Number(body.rate), auth.user!.id);
            return NextResponse.json({ ...(await currentStatus()), applied: true });
        }
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT { mode: 'auto' | 'manual', margin_percent } → switching to Auto applies
// today's live rate straight away.
export async function PUT(request: Request) {
    try {
        const auth = await authorise();
        if (auth.error) return auth.error;
        const body = await request.json();
        const current = await loadFxSettings(supabase);
        const next = {
            mode: body.mode === 'auto' ? 'auto' as const : body.mode === 'manual' ? 'manual' as const : current.mode,
            margin_percent: body.margin_percent !== undefined
                ? Math.min(20, Math.max(0, Number(body.margin_percent) || 0))
                : current.margin_percent,
        };
        await saveFxSettings(supabase, next);
        let warning: string | null = null;
        if (next.mode === 'auto') {
            try {
                await refreshExchangeRate(supabase);
            } catch (error: any) {
                warning = `${error.message}. Using the last saved rate.`;
            }
        }
        return NextResponse.json({ ...(await currentStatus()), warning });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
