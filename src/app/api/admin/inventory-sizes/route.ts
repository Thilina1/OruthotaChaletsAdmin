import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('inventory_sizes')
      .select('name')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data.map((s: { name: string }) => s.name));
  } catch (error) {
    console.error('Error fetching inventory sizes:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory sizes' }, { status: 500 });
  }
}
