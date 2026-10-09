// Live USD to LKR rate (server only). The applied rate is the market rate
// less a margin; in Auto mode it is written to chalet_rates.usd_to_lkr_rate,
// which room prices, bookings (locked when made) and payments already use.

export type FxSettings = { mode: 'auto' | 'manual'; margin_percent: number };

const DEFAULT_SETTINGS: FxSettings = { mode: 'manual', margin_percent: 2 };

// Calendar day in Sri Lanka.
export const colomboToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export async function loadFxSettings(client: any): Promise<FxSettings> {
    const { data } = await client.from('app_settings').select('value').eq('key', 'fx_settings').maybeSingle();
    const value = data?.value && typeof data.value === 'object' ? data.value : {};
    return {
        mode: value.mode === 'auto' ? 'auto' : 'manual',
        margin_percent: Number.isFinite(Number(value.margin_percent)) ? Math.min(20, Math.max(0, Number(value.margin_percent))) : DEFAULT_SETTINGS.margin_percent,
    };
}

export async function saveFxSettings(client: any, settings: FxSettings) {
    const { error } = await client.from('app_settings').upsert({ key: 'fx_settings', value: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
}

// Market USD→LKR from a free feed, with a second feed as fallback.
export async function fetchMarketUsdLkr(): Promise<{ rate: number; source: string }> {
    const sources: { name: string; url: string; read: (json: any) => number }[] = [
        { name: 'open.er-api.com', url: 'https://open.er-api.com/v6/latest/USD', read: json => Number(json?.rates?.LKR) },
        { name: 'currency-api (jsDelivr)', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', read: json => Number(json?.usd?.lkr) },
    ];
    const errors: string[] = [];
    for (const source of sources) {
        try {
            const response = await fetch(source.url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const rate = source.read(await response.json());
            // Sanity check: reject obviously wrong values.
            if (!Number.isFinite(rate) || rate < 50 || rate > 2000) throw new Error(`unexpected rate ${rate}`);
            return { rate, source: source.name };
        } catch (error: any) {
            errors.push(`${source.name}: ${error.message}`);
        }
    }
    throw new Error(`Could not fetch the USD to LKR rate (${errors.join('; ')})`);
}

// Writes the rate to every chalet rate row (the Rate Matrix uses one rate).
async function applyToChaletRates(client: any, rate: number) {
    const { error } = await client
        .from('chalet_rates')
        .update({ usd_to_lkr_rate: rate, updated_at: new Date().toISOString() })
        .not('id', 'is', null);
    if (error) throw error;
}

// Fetch today's market rate and record it. In Auto mode it is also applied,
// unless a manual rate was set for today.
export async function refreshExchangeRate(client: any) {
    const settings = await loadFxSettings(client);
    const today = colomboToday();
    const market = await fetchMarketUsdLkr();
    const applied = Math.round(market.rate * (1 - settings.margin_percent / 100) * 100) / 100;

    const { data: manualToday } = await client
        .from('exchange_rates')
        .select('id')
        .eq('rate_date', today)
        .eq('is_manual', true)
        .limit(1);
    const keepManual = Array.isArray(manualToday) && manualToday.length > 0;

    const { data: row, error } = await client.from('exchange_rates').insert({
        rate_date: today,
        market_rate: Math.round(market.rate * 10000) / 10000,
        margin_percent: settings.margin_percent,
        applied_rate: applied,
        source: market.source,
        is_manual: false,
    }).select().single();
    if (error) throw error;

    const appliedNow = settings.mode === 'auto' && !keepManual;
    if (appliedNow) await applyToChaletRates(client, applied);
    return { row, applied: appliedNow, settings };
}

// Set today's rate by hand (e.g. the official CBSL rate); applied immediately.
export async function setManualExchangeRate(client: any, rate: number, userId: string | null) {
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter a valid USD to LKR rate.');
    const { data: row, error } = await client.from('exchange_rates').insert({
        rate_date: colomboToday(),
        market_rate: null,
        margin_percent: 0,
        applied_rate: Math.round(rate * 100) / 100,
        source: 'Manual',
        is_manual: true,
        created_by: userId,
    }).select().single();
    if (error) throw error;
    await applyToChaletRates(client, row.applied_rate);
    return row;
}
