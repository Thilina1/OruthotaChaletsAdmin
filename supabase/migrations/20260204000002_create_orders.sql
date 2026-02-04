-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    table_number INTEGER,
    status TEXT NOT NULL DEFAULT 'open', -- open, billed, paid, cancelled
    total_price NUMERIC DEFAULT 0,
    waiter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    waiter_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies for orders
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.orders;
CREATE POLICY "Allow all access for authenticated users" ON public.orders
    FOR ALL TO authenticated USING (true);

-- Policies for order_items
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.order_items;
CREATE POLICY "Allow all access for authenticated users" ON public.order_items
    FOR ALL TO authenticated USING (true);

-- Create decrement_stock function
CREATE OR REPLACE FUNCTION public.decrement_stock(item_id UUID, quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.menu_items
  SET stock = stock - quantity
  WHERE id = item_id AND stock IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
