import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const department_id = searchParams.get('department_id');

        let query = supabase
            .from('hotel_inventory_items')
            .select(`
                *,
                department:inventory_departments (
                    name
                ),
                menu_items (
                    id,
                    price,
                    category
                )
            `)
            .order('name');

        if (department_id) {
            query = query.eq('department_id', department_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ items: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();

        // Extract menu-specific fields
        const { is_menu_item, menu_price, menu_category, ...inventoryItemData } = body;

        const dataToSave = {
            ...inventoryItemData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('hotel_inventory_items')
            .insert(dataToSave)
            .select()
            .single();

        if (error) throw error;

        // Create secondary menu item if requested
        if (is_menu_item) {
            const menuItemData = {
                name: data.name,
                description: data.description,
                price: menu_price || 0,
                buying_price: data.buying_price || 0,
                category: menu_category || 'Beverages',
                stock_type: 'Inventoried',
                availability: true,
                sell_type: 'Direct',
                linked_inventory_item_id: data.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error: menuError } = await supabase
                .from('menu_items')
                .insert(menuItemData);

            if (menuError) {
                console.error('Failed to auto-create menu item:', menuError);
                // We don't fail the whole request if just the menu item fails,
                // but we could notify or log it.
            }
        }

        return NextResponse.json({ item: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { id, is_menu_item, menu_price, menu_category, ...updates } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('hotel_inventory_items')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Handle menu item creation or update
        if (is_menu_item) {
            // Check if a linked menu item already exists
            const { data: existingMenuItem, error: fetchError } = await supabase
                .from('menu_items')
                .select('id')
                .eq('linked_inventory_item_id', id)
                .single();

            const menuItemData = {
                name: data.name,
                description: data.description,
                price: menu_price || 0,
                buying_price: data.buying_price || 0,
                category: menu_category || 'Beverages',
                stock_type: 'Inventoried',
                availability: true,
                sell_type: 'Direct',
                linked_inventory_item_id: id,
                updated_at: new Date().toISOString()
            };

            if (existingMenuItem) {
                // Update existing
                await supabase
                    .from('menu_items')
                    .update(menuItemData)
                    .eq('id', existingMenuItem.id);
            } else {
                // Create new
                await supabase
                    .from('menu_items')
                    .insert({
                        ...menuItemData,
                        created_at: new Date().toISOString()
                    });
            }
        }

        return NextResponse.json({ item: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        // Cascade soft delete: Update menu items that are linked to this hotel inventory item
        // Wait, since we are doing hard deletes now, the linked inventory item ID will be set to NULL via DB ON DELETE SET NULL.
        // We do NOT need to hard-delete the menu items just because the inventory item is deleted.

        const { error } = await supabase
            .from('hotel_inventory_items')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
