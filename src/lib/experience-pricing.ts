import type { SupabaseClient } from '@supabase/supabase-js';

// The service charge, tax and other charges last saved on an experience
// inquiry or bill. New inquiries and bills start from these (app_settings
// 'experience_pricing_defaults').
export type ExperiencePricingDefaults = {
  service_charge_rate: number;
  tax_rate: number;
  other_charges: { name: string; amount: number }[];
};

const KEY = 'experience_pricing_defaults';
export const FALLBACK_EXPERIENCE_PRICING: ExperiencePricingDefaults = { service_charge_rate: 10, tax_rate: 0, other_charges: [] };

export async function getExperiencePricingDefaults(client: SupabaseClient): Promise<ExperiencePricingDefaults> {
  const { data } = await client.from('app_settings').select('value').eq('key', KEY).maybeSingle();
  return data?.value ? { ...FALLBACK_EXPERIENCE_PRICING, ...data.value } : FALLBACK_EXPERIENCE_PRICING;
}

// Best effort: a failure here must not fail saving the inquiry or bill.
export async function saveExperiencePricingDefaults(client: SupabaseClient, pricing: ExperiencePricingDefaults) {
  const { error } = await client.from('app_settings').upsert({ key: KEY, value: pricing, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) console.error('Saving experience pricing defaults failed:', error);
}
