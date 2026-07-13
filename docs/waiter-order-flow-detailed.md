# Waiter Order Flow — Full Detail (Database → UI)

> Covers every step a waiter takes from opening the app to completing a bill. Includes exact database operations, field names, business rules, and UI behaviour for each action.

---

## Overview of the Full Flow

```
App Open
   │
   ▼
[Login Screen]
   │ POST /api/auth/login
   ▼
[Dashboard — Table Grid]
   │ Shows all tables grouped by section
   │ Each card shows table status + bill preview
   │
   ├─── Table is AVAILABLE or OCCUPIED (open order)
   │       │ Tap card
   │       ▼
   │    [Order Detail Screen — Active State]
   │       │ Browse menu → add to local cart → submit
   │       │ Edit existing items → +/− or delete
   │       │ Enter customer mobile (optional)
   │       │ Tap "Send to Payment"
   │       ▼
   │    [Order Detail Screen — Billed State]
   │       │ Waiter waits, polls every 3 seconds
   │       │ Cashier confirms bill → confirmed_total set
   │       │ "View Bill" button activates
   │       ▼
   │    [Bill Breakdown Dialog]
   │       Shows full charges + grand total
   │
   └─── Table is BILLED (awaiting payment)
           │ Tap card → same Order Detail in Billed State
```

---

## PART 1 — Dashboard Screen

### What is loaded on startup

| # | Data | Source | Query |
|---|---|---|---|
| 1 | All restaurant sections | API | `GET /api/admin/restaurant-sections` |
| 2 | All tables | Supabase direct | `SELECT * FROM restaurant_tables` |
| 3 | Active billed orders | Supabase direct | `SELECT id, table_id, total_price, confirmed_total, status FROM orders WHERE status = 'billed' AND table_id IN (...)` |
| 4 | Order items for billed orders | Supabase direct | `SELECT * FROM order_items WHERE order_id IN (...)` |

### How sections and tables are linked

- `restaurant_sections` has: `id`, `name`
- `restaurant_tables` has: `location` (plain text, equals a section name)
- **Group logic**: `tables.filter(t => t.location === section.name)`

### Table card rendering rules

```
For each table card:

1. Check if there is a billed order for this table
   → billedOrder = billedOrders[table.id]

2. If billedOrder exists:
   BORDER  = orange
   BADGE   = "Awaiting Payment" (orange)
   CONTENT = list of order items with quantities + prices
           + subtotal OR confirmed_total (if cashier confirmed)
   BUTTON  = "View Bill" (outline style)

3. If NO billedOrder:
   BORDER  = based on table.status:
             available → green
             occupied  → yellow
             reserved  → purple
   BADGE   = table.status text (capitalized)
   CONTENT = table capacity
   BUTTON  = "View / Add Order" (primary style)
```

### Confirmed total display on card

```javascript
if (billedOrder.confirmed_total) {
  // Show two lines:
  // "Subtotal: LKR X.XX"  (grey)
  // "Total (incl. charges): LKR X.XX"  (green bold)
  displayTotal = billedOrder.confirmed_total;
} else {
  // Show one line:
  // "Total: LKR X.XX"  (bold)
  displayTotal = billedOrder.total_price;
}
```

### Refresh behaviour

- **Manual**: Refresh button (top-right) calls `fetchData()` — no page reload
- **Auto poll**: `setInterval(fetchData, 5000)` — every 5 seconds
- **Realtime**: Supabase subscription on `restaurant_tables` + `orders` tables (requires Realtime enabled in Supabase dashboard)

---

## PART 2 — Waiter Taps a Table Card

### What is loaded when the Order Screen opens

All fetched in parallel on open:

**Step 1 — Menu items**
```
GET /api/admin/menu-items

Response:
{
  menuItems: [
    {
      id, name, description, price, category,
      availability, stock_type, sell_type,
      stock, unit, linked_inventory_item_id
    }
  ],
  menuSections: [ { id, name } ]
}
```

**Step 2 — Restaurant warehouse ID**
```sql
SELECT id FROM inventory_warehouses WHERE name = 'Restaurant' LIMIT 1
```
→ Stored as `restaurantWHId`

**Step 3 — Current stock in Restaurant warehouse** (only if warehouse found)
```sql
SELECT
  inventory_stock.*,
  inventory_batches.*   -- joined as "batch"
FROM inventory_stock
JOIN inventory_batches ON inventory_batches.id = inventory_stock.batch_id
WHERE inventory_stock.warehouse_id = '<restaurantWHId>'
```

**Step 4 — Batch pricing for all menu items**
```sql
SELECT menu_item_id, batch_id, selling_price
FROM menu_item_batch_pricing
WHERE menu_item_id IN ('<all menu item ids>')
```
→ Stored as `pricingMap[menu_item_id][batch_id] = selling_price`

**Step 5 — Existing open/billed order for this table**
```sql
SELECT *
FROM orders
WHERE table_id = '<table.id>'
  AND status IN ('open', 'billed')
ORDER BY created_at DESC
LIMIT 1
```

**Step 6 — Order items** (only if an order was found)
```sql
SELECT * FROM order_items WHERE order_id = '<order.id>'
```

### Building `available_batches` for each Inventoried menu item

```javascript
const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

for each menuItem where stock_type === 'Inventoried' AND linked_inventory_item_id is set:

  available_batches = stockData
    .filter(s =>
      s.item_id === menuItem.linked_inventory_item_id   // correct inventory item
      && s.batch !== null                                // has a batch
      && s.quantity > 0                                  // has stock
      && (s.batch.expiry_date == null                    // not expired
          || s.batch.expiry_date >= today)
    )
    .map(s => ({
      id:            s.batch.id,
      batch_number:  s.batch.batch_number,
      expiry_date:   s.batch.expiry_date,
      quantity:      s.quantity,
      selling_price: pricingMap[menuItem.id]?.[s.batch.id] ?? null
      //             ↑ use batch-specific price, or null if not set
    }))
    .sort((a, b) => {
      // FIFO — earliest expiry first
      if (!a.expiry_date) return 1;   // no expiry → push to end
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

  menuItem.restaurant_stock = sum of all batch quantities above
  menuItem.available_batches = available_batches
```

### Real-time subscription (while order screen is open)

```javascript
supabase.channel(`order-waiter-${order.id}`)
  .on('postgres_changes', {
    event: '*', schema: 'public',
    table: 'order_items',
    filter: `order_id=eq.${order.id}`
  }, () => fetchData())
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public',
    table: 'orders',
    filter: `id=eq.${order.id}`
  }, () => fetchData())    // catches cashier setting confirmed_total
  .subscribe()
```

Also: if `order.status === 'billed'` AND `confirmed_total` is null:
```javascript
setInterval(() => fetchData(), 3000)  // poll every 3s until cashier confirms
```

---

## PART 3 — Menu Display (Left Panel)

### Filtering rules — what the waiter sees

```javascript
menuItems
  .filter(item => item.availability === true)       // only available
  .filter(item => item.sell_type !== 'Indirect')    // hide hotel/room billing items
  .filter(item => /* matches category filter */)
  .filter(item => /* matches search term */)
```

### How price is displayed on each menu card

```javascript
if (item.stock_type === 'Inventoried' && item.linked_inventory_item_id) {
  // Show price range from batches
  const prices = item.available_batches
    .map(b => b.selling_price)
    .filter(p => p != null && p > 0);

  if (prices.length === 0) {
    display = "Price by batch"
  } else {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    display = min === max
      ? `LKR ${min.toFixed(2)}`
      : `LKR ${min.toFixed(2)} – ${max.toFixed(2)}`
  }
} else {
  // Non-inventoried or manual stock
  display = `LKR ${item.price.toFixed(2)}`
}
```

### How stock count is displayed

```javascript
if (item.stock_type === 'Inventoried') {
  const cartCount = localCart entries for this item (all batches combined);
  const effectiveStock = item.restaurant_stock - cartCount;
  display = `Stock: ${effectiveStock}`
  color = effectiveStock > 0 ? green : red
}
// Non-Inventoried items show no stock counter
```

### "Add" button disabled logic

```javascript
const isOutOfStock =
  item.stock_type === 'Inventoried' &&
  (effectiveStock - cartCount) <= 0;

button.disabled = isOutOfStock;
```

---

## PART 4 — Waiter Adds an Item

### Case A: Non-Inventoried item (e.g. Fried Rice)

Waiter taps "Add" → item goes directly to **local cart** (no DB write yet)

```javascript
localCart[menuItem.id] = (localCart[menuItem.id] || 0) + 1
```

The local cart is a `Record<string, number>`:
- key = `menuItemId` (no batch)
- value = quantity

### Case B: Inventoried item WITHOUT a linked inventory item

Same as Case A — goes to local cart using `menuItem.id` as key.

### Case C: Inventoried item WITH a linked inventory item (has batches)

Waiter taps "Add" → **Batch Selection dialog** opens

Dialog shows each available batch:
```
Batch: [batch_number]
Expires: [expiry_date]       ← hidden if null
Stock: [quantity - inCart]
Selling Price: LKR [selling_price or item.price]
[Add to Order] button        ← disabled if stock = 0
```

Waiter taps "Add to Order" for a batch → item goes to local cart:
```javascript
const key = `${menuItem.id}::${batch.id}`
localCart[key] = (localCart[key] || 0) + 1
```

The local cart key format:
- **No batch**: `"<menuItemId>"`
- **With batch**: `"<menuItemId>::<batchId>"`

### Stock validation before adding to cart

```javascript
// For items with batches:
const batchInCart = localCart[`${menuItem.id}::${batch.id}`] || 0;
if (batch.quantity - batchInCart <= 0) {
  → Show "Out of Stock" toast, do NOT add
}

// For items without batches:
const inCart = localCart[menuItem.id] || 0;
if (menuItem.restaurant_stock - inCart <= 0) {
  → Show "Out of Stock" toast
}
```

### Price used for the item

```javascript
const itemPrice = batch?.selling_price || menuItem.price
// batch.selling_price comes from menu_item_batch_pricing
// Falls back to menu_items.price if no batch pricing set
```

---

## PART 5 — "Add Items to Bill" Button

This is the main submit action. Writes everything to the database.

### Pre-condition
- `localCart` must not be empty (button is disabled otherwise)
- User must be logged in (`currentUser` must exist)

### Step-by-step DB operations

```
┌─────────────────────────────────────────────────────┐
│ STEP 1: Does an open order exist for this table?    │
└─────────────────────────────────────────────────────┘

IF no open order:
  INSERT INTO orders:
  {
    table_id:     table.id,
    table_number: table.table_number,
    status:       'open',
    total_price:  0,
    waiter_id:    currentUser.id,
    waiter_name:  currentUser.name,
    customer_mobile: customerMobile || null
  }
  → Get back newOrder.id, use as currentOrderId

IF open order already exists:
  → Use openOrder.id as currentOrderId

┌─────────────────────────────────────────────────────┐
│ STEP 2: For each item in localCart                  │
└─────────────────────────────────────────────────────┘

For each [key, quantity] in localCart:

  Parse key:
    menuItemId = key.split('::')[0]
    batchId    = key.split('::')[1] or null

  Find menuItem from loaded menu items
  Calculate itemPrice = batch?.selling_price || menuItem.price
  Calculate lineTotal = itemPrice × quantity

  ── Check if same item+price already exists in order ──
  SELECT * FROM order_items
  WHERE order_id = currentOrderId
    AND menu_item_id = menuItemId
    AND price = itemPrice

  IF row found:
    UPDATE order_items SET quantity = existing.quantity + quantity
    WHERE id = existing.id

  IF row NOT found:
    INSERT INTO order_items:
    {
      order_id:     currentOrderId,
      menu_item_id: menuItemId,
      batch_id:     batchId or null,
      name:         menuItem.name,       ← SNAPSHOT at time of order
      price:        itemPrice,           ← SNAPSHOT at time of order
      quantity:     quantity
    }

  ── Inventory deduction ──
  IF menuItem.stock_type === 'Inventoried':

    IF menuItem.linked_inventory_item_id is set AND batchId is set:
      ← New inventory system (warehouse + batch based)

      SELECT id FROM inventory_warehouses WHERE name = 'Restaurant'
      → warehouseId

      SELECT * FROM inventory_stock
      WHERE warehouse_id = warehouseId AND batch_id = batchId

      newStock = currentStock.quantity - quantity

      UPDATE inventory_stock SET quantity = newStock
      WHERE id = currentStock.id

      INSERT INTO inventory_transactions:
      {
        item_id:              menuItem.linked_inventory_item_id,
        batch_id:             batchId,
        transaction_type:     'issue',
        quantity:             quantity,
        previous_stock:       currentStock.quantity,
        new_stock:            newStock,
        reason:               'Sold via POS',
        reference_department: warehouseId,
        created_by:           currentUser.id
      }

    ELSE IF NO linked_inventory_item_id (manual stock):
      ← Old/manual stock system

      TRY: CALL decrement_stock(item_id := menuItem.id, quantity := quantity)
      ← RPC function on Supabase

      IF RPC fails:
        SELECT stock FROM menu_items WHERE id = menuItem.id
        UPDATE menu_items SET stock = currentStock - quantity WHERE id = menuItem.id

┌─────────────────────────────────────────────────────┐
│ STEP 3: Update order total_price                    │
└─────────────────────────────────────────────────────┘

SELECT total_price FROM orders WHERE id = currentOrderId
→ freshTotal

UPDATE orders SET
  total_price  = freshTotal + (sum of all lineTotal values in this submit),
  updated_at   = now(),
  waiter_id    = currentUser.id,
  waiter_name  = currentUser.name,
  customer_mobile = customerMobile (if set)
WHERE id = currentOrderId

┌─────────────────────────────────────────────────────┐
│ STEP 4: Update table status                         │
└─────────────────────────────────────────────────────┘

IF table.status === 'available':
  UPDATE restaurant_tables SET status = 'occupied'
  WHERE id = table.id

┌─────────────────────────────────────────────────────┐
│ STEP 5: UI reset                                    │
└─────────────────────────────────────────────────────┘

localCart = {}         ← clear cart
Call fetchData()       ← reload order from DB
Show toast: "Items Added"
```

---

## PART 6 — Existing Order Items (Right Panel — Current Bill)

### What is shown

```
[Customer Mobile input]   ← optional, saves on blur

[Yellow warning banner]   ← only when status = 'billed'
  "Bill sent — awaiting payment from cashier."

[Order Items list]
  For each order_item:
    Item Name
    LKR (price × quantity)
    IF status = 'open':  [−] [qty] [+] [🗑] buttons
    IF status = 'billed': read-only, shows "× qty"

[New Items section]       ← only when status = 'open'
  For each item in localCart:
    Item name (Batch: X)  × qty    LKR total
    [+] [−] controls

[Total Bill]              ← only when status = 'open'
  = order.total_price + sum(localCart prices)

[Add Items to Bill]       ← disabled when localCart is empty
[Send to Payment]         ← disabled when no open order exists
```

### Editing an existing order item (+ button)

```javascript
// Increase quantity by 1
newQty = item.quantity + 1

// Stock check first
if (menuItem.stock_type === 'Inventoried') {
  if (effectiveStock <= 0) → toast "Out of Stock", abort
}

UPDATE order_items SET quantity = newQty WHERE id = item.id

// Adjust inventory stock (add 1 more deduction)
// Same logic as adding item (delta = +1)
// → UPDATE inventory_stock, INSERT inventory_transaction (type: 'issue')

// Update order total
UPDATE orders SET
  total_price = currentTotal + item.price,
  updated_at  = now()
WHERE id = order.id

fetchData()
```

### Editing an existing order item (− button)

```javascript
// Decrease quantity by 1
newQty = item.quantity - 1

IF newQty < 1:
  → triggers handleRemoveOrderItem() (see delete below)

ELSE:
  UPDATE order_items SET quantity = newQty WHERE id = item.id

  // Restore 1 unit of inventory (delta = -1)
  → UPDATE inventory_stock (quantity + 1)
  → INSERT inventory_transaction (type: 'return')

  // Update order total
  UPDATE orders SET
    total_price = currentTotal - item.price,
    updated_at  = now()
  WHERE id = order.id

  fetchData()
```

### Deleting an existing order item (🗑 button)

```javascript
DELETE FROM order_items WHERE id = item.id

// Restore ALL units of this item to inventory
IF menuItem.linked_inventory_item_id AND item.batch_id:
  SELECT * FROM inventory_stock
  WHERE warehouse_id = restaurantWHId AND batch_id = item.batch_id

  newStock = currentStock.quantity + item.quantity

  UPDATE inventory_stock SET quantity = newStock WHERE id = currentStock.id

  INSERT INTO inventory_transactions:
  {
    transaction_type: 'return',
    quantity:         item.quantity,
    previous_stock:   currentStock.quantity,
    new_stock:        newStock,
    reason:           'Removed from POS bill'
  }

ELSE IF manual stock:
  SELECT stock FROM menu_items WHERE id = menuItem.id
  UPDATE menu_items SET stock = currentStock + item.quantity WHERE id = menuItem.id

// Update order total
SELECT total_price FROM orders WHERE id = order.id
UPDATE orders SET
  total_price = max(0, total_price - (item.price × item.quantity)),
  updated_at  = now()
WHERE id = order.id

fetchData()
toast "Item Removed"
```

---

## PART 7 — Customer Mobile Input

```
Field: text input
Placeholder: "e.g. 0771234567 (optional)"
Trigger: saved on blur (when waiter taps away from field)
```

### DB write on blur

```javascript
if (order.id && customerMobile) {
  UPDATE orders SET customer_mobile = customerMobile WHERE id = order.id
}
```

If creating a new order, `customer_mobile` is included in the INSERT.

---

## PART 8 — "Send to Payment" Button

### Pre-condition
- An open order must exist (`openOrder` is not null)
- Button is disabled otherwise

### DB operations

```javascript
// 1. Change order status to billed
UPDATE orders SET
  status     = 'billed',
  updated_at = now()
WHERE id = openOrder.id

// 2. Keep table occupied (do NOT free it)
UPDATE restaurant_tables SET status = 'occupied'
WHERE id = table.id

// UI changes:
localCart = {}
fetchData()
toast "Bill Sent for Payment"
```

### What happens to the UI after "Send to Payment"

- Left panel (menu) **disappears**
- Right panel expands to full width / centered
- Yellow banner appears: "Bill sent — awaiting payment from cashier."
- All item quantity controls (+/−/delete) become **read-only**
- "Add Items to Bill" and "Send to Payment" buttons **disappear**
- "View Bill" button **appears** (disabled, grey)
- Polling starts: `setInterval(fetchData, 3000)`

---

## PART 9 — Waiting for Cashier (Billed State)

While `order.status === 'billed'`:

### What the waiter sees

```
┌─────────────────────────────────────────────────────┐
│  ⏰ Bill sent — awaiting payment from cashier.      │
│  (yellow banner)                                    │
├─────────────────────────────────────────────────────┤
│  Order Items (read-only)                            │
│  Fried Rice × 2                    LKR 1,700.00     │
│  Mineral Water × 1                 LKR 250.00       │
├─────────────────────────────────────────────────────┤
│  [View Bill (awaiting cashier confirmation)]        │
│   ↑ DISABLED, greyed out                           │
└─────────────────────────────────────────────────────┘
```

### Polling logic

```javascript
// Active while: order.status === 'billed' AND confirmed_total is null AND screen is open
const interval = setInterval(async () => {
  await fetchData();
  // fetchData re-reads the order from DB
  // if confirmed_total is now set → polling stops (useEffect cleanup)
}, 3000);
```

### When cashier confirms (what changes in DB)

Cashier clicks "Confirm Bill" in the web app:
```sql
UPDATE orders
SET confirmed_total = <grand total with all charges>
WHERE id = order.id
```

This is detected by:
1. The poll (`fetchData` returns updated order with `confirmed_total`)
2. OR Supabase Realtime fires the `orders` UPDATE subscription → `fetchData()`

### "View Bill" button becomes active

```javascript
// Button enabled condition:
const isEnabled = order.confirmed_total != null;

// Button label:
label = isEnabled
  ? `View Bill — LKR ${order.confirmed_total.toFixed(2)}`
  : 'View Bill (awaiting cashier confirmation)'
```

---

## PART 10 — Bill Breakdown Dialog

### When does it open

Waiter taps the enabled "View Bill" button.

### What data is needed

1. `billingConfig` — fetched when order becomes `billed`:
   ```
   GET /api/admin/app-settings?key=restaurant_billing_config
   ```
   Stored in state. Automatically loaded whenever `order.status === 'billed'`.

2. `orderItems` — already loaded in the order detail screen

3. `order.total_price` — the raw subtotal (no charges)

4. `order.confirmed_total` — the cashier's confirmed grand total

### Billing calculation (same formula as cashier)

```javascript
const subtotal = order.total_price;

// Service charges — applied to subtotal
const scLines = billingConfig.service_charges
  .filter(sc => sc.enabled)
  .map(sc => ({
    name:   sc.name,
    type:   sc.type,
    value:  sc.value,
    amount: sc.type === 'percentage'
              ? subtotal * sc.value / 100
              : sc.value
  }));

// Other charges — applied to subtotal
const ocLines = billingConfig.other_charges
  .filter(oc => oc.enabled)
  .map(oc => ({
    name:   oc.name,
    type:   oc.type,
    value:  oc.value,
    amount: oc.type === 'percentage'
              ? subtotal * oc.value / 100
              : oc.value
  }));

const scTotal = scLines.reduce((sum, l) => sum + l.amount, 0);
const ocTotal = ocLines.reduce((sum, l) => sum + l.amount, 0);

// VAT — applied AFTER service + other charges
const vatBase  = subtotal + scTotal + ocTotal;
const vatAmount = billingConfig.vat.enabled
  ? vatBase * billingConfig.vat.rate / 100
  : 0;

const calculatedTotal = subtotal + scTotal + ocTotal + vatAmount;

// ALWAYS use cashier's confirmed_total as the display total
// (cashier may have applied discounts or manual override)
const grandTotal = order.confirmed_total ?? calculatedTotal;
```

### Dialog layout

```
┌──────────────────────────────────────┐
│  Bill — Table 2                      │
├──────────────────────────────────────┤
│  Fried Rice × 2          LKR 1700.00 │  ← grey text
│  Mineral Water × 1        LKR 250.00 │
├──────────────────────────────────────┤
│  Subtotal                LKR 1950.00 │
│  Service Charge (10%)     LKR 195.00 │  ← each enabled service charge
│  Tourism Levy (1%)         LKR 19.50 │  ← each enabled other charge
│  VAT (5%)                 LKR 108.23 │  ← if VAT enabled
├──────────────────────────────────────┤
│  Total                   LKR 2272.73 │  ← GREEN, BOLD — confirmed_total
├──────────────────────────────────────┤
│  [Close]                             │
└──────────────────────────────────────┘
```

---

## PART 11 — After Payment (What Waiter Sees)

The **cashier** (web app) processes payment:
```sql
UPDATE orders SET status = 'closed', updated_at = now() WHERE id = order.id
UPDATE restaurant_tables SET status = 'available' WHERE id = table.id
```

The waiter app detects this via polling or realtime:
- `order.status` changes to `'closed'`
- The order detail screen query filters `status IN ('open', 'billed')` → returns nothing
- `openOrder` becomes `null`
- Table status becomes `'available'`

The table card on the dashboard returns to the green "Available" state.

---

## PART 12 — All Database Tables Used by Waiter (Summary)

| Table | Read | Write | When |
|---|---|---|---|
| `restaurant_sections` | ✅ | ❌ | Dashboard load |
| `restaurant_tables` | ✅ | ✅ | Dashboard load; mark occupied/available |
| `menu_items` | ✅ | ✅ | Order screen; manual stock decrement |
| `menu_sections` | ✅ | ❌ | Order screen (category filter) |
| `orders` | ✅ | ✅ | Create, update total, update status |
| `order_items` | ✅ | ✅ | Add, update qty, delete items |
| `inventory_warehouses` | ✅ | ❌ | Find Restaurant warehouse ID |
| `inventory_stock` | ✅ | ✅ | Check stock, deduct on add, restore on remove |
| `inventory_batches` | ✅ | ❌ | Joined with inventory_stock |
| `menu_item_batch_pricing` | ✅ | ❌ | Get per-batch selling price |
| `inventory_transactions` | ❌ | ✅ | Log every stock movement |
| `app_settings` | ✅* | ❌ | Billing config — via API route only |

*Direct Supabase query fails due to RLS. Always use `GET /api/admin/app-settings?key=restaurant_billing_config`.

---

## PART 13 — All States of `orders.status`

| Status | Set by | Meaning |
|---|---|---|
| `'open'` | Waiter (on first item add) | Order is active, waiter still adding items |
| `'billed'` | Waiter (Send to Payment) | Bill sent to cashier, waiter locked out of editing |
| `'closed'` | Cashier (Process Payment) | Payment collected, table freed |

---

## PART 14 — All States of `restaurant_tables.status`

| Status | Set by | Meaning |
|---|---|---|
| `'available'` | Cashier (after payment) | Table is free |
| `'occupied'` | Waiter (first item added OR send to payment) | Table has active/billed order |
| `'reserved'` | Admin (table management) | Table booked in advance |

---

## PART 15 — Key Business Rules

1. **One active order per table** — only one `open` or `billed` order can exist per table at a time. The query always fetches the most recent one.

2. **Waiter cannot edit after "Send to Payment"** — once `status = 'billed'`, all item controls are read-only.

3. **Price is snapshotted** — `order_items.price` is saved at the time of ordering. Menu price changes do not affect existing orders.

4. **Item name is snapshotted** — `order_items.name` is saved at the time of ordering. Menu name changes do not affect existing orders.

5. **`order.total_price` is always the raw subtotal** — never includes charges or VAT. That is only in `confirmed_total`.

6. **`confirmed_total` is set by cashier** — the waiter never writes to this field. It is the authoritative final amount including all charges, VAT, and any discounts the cashier applied.

7. **Table stays `occupied` after Send to Payment** — the cashier's payment action (not the waiter) is what frees the table to `available`.

8. **Inventory stock is deducted immediately** when waiter taps "Add Items to Bill" — not when the order is sent to payment.

9. **Stock is restored immediately** when waiter removes an item or decreases quantity.

10. **FIFO batch selection** — batches are sorted by expiry date ascending. Earliest-expiring batch should be used first.

---

*Source: `/src/components/dashboard/waiter-dashboard.tsx` + `/src/components/dashboard/waiter/order-modal.tsx` — branch `main` — 2026-06-30*
