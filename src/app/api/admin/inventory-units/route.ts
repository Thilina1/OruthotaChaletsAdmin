import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('inventory_units')
      .select('name')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data.map((u: { name: string }) => u.name));
  } catch (error) {
    console.error('Error fetching inventory units:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory units' }, { status: 500 });
  }
}
