ALTER TABLE "public"."menu_items"
ADD COLUMN IF NOT EXISTS "linked_inventory_item_id" UUID REFERENCES "public"."hotel_inventory_items"("id") ON DELETE SET NULL;
