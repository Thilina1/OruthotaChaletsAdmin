import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data: allowanceTypes, error } = await supabase
            .from('allowance_types')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ allowanceTypes });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const { name, default_amount } = await request.json();
        if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        const { data, error } = await supabase
            .from('allowance_types')
            .insert([{ name: name.trim(), default_amount: Number(default_amount) || 0 }])
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ allowanceType: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const { id, name, default_amount } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const trimmedName = name?.trim();
        const newAmount = Number(default_amount) || 0;

        const { data, error } = await supabase
            .from('allowance_types')
            .update({ name: trimmedName, default_amount: newAmount })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        // Cascade: update all salary_details rows that have this allowance_type_id linked
        const { data: salaryRows } = await supabase
            .from('salary_details')
            .select('id, allowances_json')
            .not('allowances_json', 'is', null);

        let updatedCount = 0;
        if (salaryRows && salaryRows.length > 0) {
            const rowsToUpdate = salaryRows.filter((row: any) =>
                Array.isArray(row.allowances_json) &&
                row.allowances_json.some((a: any) => a.allowance_type_id === id)
            );
            updatedCount = rowsToUpdate.length;

            await Promise.all(rowsToUpdate.map((row: any) => {
                const updatedJson = row.allowances_json.map((a: any) =>
                    a.allowance_type_id === id
                        ? { ...a, name: trimmedName, amount: newAmount }
                        : a
                );
                const newTotal = updatedJson.reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
                return supabase
                    .from('salary_details')
                    .update({
                        allowances_json: updatedJson,
                        fixed_allowances: newTotal,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', row.id);
            }));
        }

        return NextResponse.json({ allowanceType: data, updatedEmployees: updatedCount });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        const { error } = await supabase.from('allowance_types').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
