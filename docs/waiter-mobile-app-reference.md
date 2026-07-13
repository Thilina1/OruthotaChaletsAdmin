# Waiter Mobile App — Complete Implementation Reference

> **Purpose**: Everything a mobile developer needs to rebuild the waiter feature set on a native/cross-platform mobile app, derived directly from the running web codebase.

---

## 1. Project Overview

**System**: Orudhota Chalets — Restaurant POS + Hotel Management  
**Waiter role**: Takes table orders, adds items to bills, sends bills to the cashier, views the final bill breakdown after cashier confirms.

### Roles in the system
| Role | Access |
|---|---|
| `admin` | Full access to all features |
| `waiter` | Dashboard, tables, orders, leaves, attendance, HRMS self-service |
| `payment` | Billing / cashier screen only |
| `kitchen` | Kitchen-facing views |

The mobile app only needs the **`waiter`** role screens.

---

## 2. Backend Infrastructure

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL) |
| Auth | Custom JWT (HS256) — NOT Supabase Auth |
| API | Next.js 15 API Routes (hosted on same server as web app) |
| Real-time | Supabase Realtime (postgres_changes) |
| File Storage | Supabase Storage (not needed for waiter mobile) |

### Environment values (already public / publishable)
```
SUPABASE_URL      = https://ysejulbuvunfhodersjr.supabase.co
SUPABASE_ANON_KEY = sb_publishable_nn7GsENQXU_YmbYO7S8bUA_s8P4SVW5
```

> The **API base URL** is wherever the Next.js server is hosted (e.g., `https://your-domain.com` in production, `http://localhost:3000` in development).

---

## 3. Authentication

### How it works
The system uses a **custom JWT** signed with `HS256`. It is NOT Supabase Auth — `supabase.auth.getUser()` always returns null.

**JWT payload**:
```json
{
  "userId": "<uuid>",
  "email": "waiter@example.com",
  "role": "waiter",
  "name": "John Smith",
  "iat": 1234567890,
  "exp": 1234654290
}
```
**Token lifetime**: 24 hours  
**Algorithm**: HS256  
**Secret**: stored in `AUTH_SECRET` env variable on the server

### Web app behaviour (cookie-based)
The web app stores the token in an **httpOnly cookie** named `auth_token`. Mobile apps cannot use httpOnly cookies directly.

### ⚠️ Required backend modification for mobile

The login API route must be updated to **also return the raw token** in the response body so mobile apps can store it in secure storage and send it back as a `Bearer` token.

**Modify** `src/app/api/auth/login/route.ts` — change the return at the end:
```typescript
// CURRENT (web only):
return NextResponse.json({ user }, { status: 200 });

// CHANGE TO (supports both web and mobile):
return NextResponse.json({ user, token }, { status: 200 });
```

**Also modify all protected API routes** to accept `Authorization: Bearer <token>` in addition to the cookie. Example helper to add to each route:

```typescript
async function getTokenFromRequest(request: Request): Promise<string | null> {
  // 1. Try Authorization header (mobile)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // 2. Fall back to cookie (web)
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value ?? null;
}
```

### Mobile login flow
```
POST /api/auth/login
Body: { "email": "waiter@example.com", "password": "password123" }

Response 200:
{
  "user": { "id": "...", "name": "...", "email": "...", "role": "waiter", ... },
  "token": "eyJhbGc..."    ← store this in SecureStorage / Keychain
}

Response 401: { "error": "Invalid credentials" }
```

### Sending authenticated requests from mobile
```
GET /api/admin/restaurant-sections
Headers:
  Authorization: Bearer eyJhbGc...
  Content-Type: application/json
```

### Get current user
```
GET /api/auth/me
Headers: Authorization: Bearer <token>

Response 200:
{
  "user": {
    "id": "uuid",
    "name": "John Smith",
    "email": "john@example.com",
    "role": "waiter",
    "department": "Restaurant",
    "job_title": "Waiter",
    "phone_number": "...",
    "permissions": []
  }
}
```

---

## 4. Database Schema (Waiter-Relevant Tables)

### `restaurant_tables`
```sql
id            UUID PRIMARY KEY
table_number  INTEGER
status        TEXT  -- 'available' | 'occupied' | 'reserved'
capacity      INTEGER
location      TEXT  -- maps to a restaurant_section name (e.g. 'Indoor', 'Outdoor')
```

### `restaurant_sections`
```sql
id         UUID PRIMARY KEY
name       TEXT UNIQUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```
> `restaurant_tables.location` matches `restaurant_sections.name` — tables are grouped into sections by matching this string.

### `menu_sections`
```sql
id   UUID PRIMARY KEY
name TEXT UNIQUE      -- category name shown on the menu (e.g. 'Rice', 'Beverages')
```

### `menu_items`
```sql
id                      UUID PRIMARY KEY
name                    TEXT
description             TEXT
price                   NUMERIC          -- base selling price
buying_price            NUMERIC
category                TEXT             -- matches menu_sections.name
availability            BOOLEAN          -- false = hidden from menu
stock_type              TEXT             -- 'Inventoried' | 'Non-Inventoried'
stock                   INTEGER          -- only used when stock_type='Non-Inventoried'
unit                    TEXT             -- 'kg' | 'g' | 'l' | 'ml'
sell_type               TEXT             -- 'Direct' | 'Indirect' (Indirect items hidden from waiter)
linked_inventory_item_id UUID REFERENCES inventory_items(id)
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

### `orders`
```sql
id              UUID PRIMARY KEY
table_id        UUID REFERENCES restaurant_tables(id)
table_number    INTEGER
status          TEXT        -- 'open' | 'billed' | 'closed'
total_price     NUMERIC     -- sum of all order_items (price × qty), no charges
waiter_id       UUID
waiter_name     TEXT
customer_mobile TEXT        -- optional, for loyalty lookup
confirmed_total NUMERIC     -- set by cashier when confirming payment; includes all charges + VAT
bill_number     TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**Order status flow**:
```
open  →  billed  →  closed
         ↑
   waiter clicks
  "Send to Payment"
                   ↑
          cashier confirms
          payment & sets
          confirmed_total
```

### `order_items`
```sql
id           UUID PRIMARY KEY
order_id     UUID REFERENCES orders(id)
menu_item_id UUID REFERENCES menu_items(id)
batch_id     UUID REFERENCES inventory_batches(id)  -- null for non-inventoried
name         TEXT     -- snapshot of menu item name at time of ordering
price        NUMERIC  -- snapshot of price at time of ordering
quantity     INTEGER
```

### `inventory_warehouses`
```sql
id   UUID PRIMARY KEY
name TEXT   -- 'Restaurant' warehouse is the one used by POS
type TEXT   -- 'MAIN' | 'DEPARTMENT'
```

### `inventory_batches`
```sql
id            UUID PRIMARY KEY
item_id       UUID REFERENCES inventory_items(id)
batch_number  TEXT
buying_price  NUMERIC
expiry_date   DATE
supplier      TEXT
status        TEXT  -- 'active' | 'expired' | 'depleted'
```

### `inventory_stock`
```sql
id           UUID PRIMARY KEY
warehouse_id UUID REFERENCES inventory_warehouses(id)
item_id      UUID REFERENCES inventory_items(id)
batch_id     UUID REFERENCES inventory_batches(id)
quantity     NUMERIC
last_updated TIMESTAMPTZ
```

### `menu_item_batch_pricing`
```sql
id            UUID PRIMARY KEY
menu_item_id  UUID REFERENCES menu_items(id)
batch_id      UUID REFERENCES inventory_batches(id)
selling_price NUMERIC   -- overrides menu_items.price for this batch
```

### `inventory_transactions`
```sql
id                  UUID PRIMARY KEY
item_id             UUID
batch_id            UUID
transaction_type    TEXT  -- 'receive' | 'issue' | 'damage' | 'return' | ...
quantity            NUMERIC
previous_stock      NUMERIC
new_stock           NUMERIC
reason              TEXT
reference_department UUID
created_by          UUID
created_at          TIMESTAMPTZ
```

### `app_settings`
```sql
key        TEXT PRIMARY KEY
value      JSONB         -- structure depends on key
updated_at TIMESTAMPTZ
```

**Key used by waiter**: `restaurant_billing_config`
```json
{
  "vat": {
    "enabled": true,
    "rate": 5
  },
  "service_charges": [
    { "id": "sc1", "name": "Service Charge", "type": "percentage", "value": 10, "enabled": true },
    { "id": "sc2", "name": "Cover Charge",   "type": "fixed",      "value": 50,  "enabled": false }
  ],
  "other_charges": [
    { "id": "oc1", "name": "Tourism Levy", "type": "percentage", "value": 1, "enabled": true }
  ]
}
```

---

## 5. API Endpoints

All endpoints are prefixed with the Next.js server base URL (e.g. `https://your-domain.com`).  
All authenticated endpoints require: `Authorization: Bearer <token>` (after the mobile modification above).

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Login with email + password |
| GET | `/api/auth/me` | Yes | Get current logged-in user |
| POST | `/api/auth/logout` | Yes | Clear session (cookie) |

**Login**
```
POST /api/auth/login
Body: { "email": string, "password": string }
Response: { "user": User, "token": string }   ← after mobile modification
```

### Restaurant

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/restaurant-sections` | Yes | All restaurant sections/zones |
| GET | `/api/admin/menu-items` | No* | All menu items + menu sections |
| GET | `/api/admin/app-settings?key=restaurant_billing_config` | Yes | Billing charges config |
| GET | `/api/admin/orders?id=<order_id>` | Yes | Order items for an order |

*`/api/admin/menu-items` uses service role key, no auth check — but add auth for security.

**GET /api/admin/restaurant-sections**
```json
{
  "sections": [
    { "id": "uuid", "name": "Indoor", "created_at": "...", "updated_at": "..." },
    { "id": "uuid", "name": "Outdoor", "created_at": "...", "updated_at": "..." }
  ]
}
```

**GET /api/admin/menu-items**
```json
{
  "menuItems": [
    {
      "id": "uuid",
      "name": "Fried Rice",
      "price": 850.00,
      "category": "Rice",
      "availability": true,
      "stock_type": "Non-Inventoried",
      "sell_type": "Direct"
    }
  ],
  "menuSections": [
    { "id": "uuid", "name": "Rice" },
    { "id": "uuid", "name": "Beverages" }
  ]
}
```

**GET /api/admin/app-settings?key=restaurant_billing_config**
```json
{
  "value": {
    "vat": { "enabled": true, "rate": 5 },
    "service_charges": [ ... ],
    "other_charges": [ ... ]
  }
}
```

---

## 6. Direct Supabase Operations

These are done **directly via Supabase JS client** (using anon key) from the mobile app. Most RLS policies allow the anon role to read/write these tables — verify in Supabase Dashboard > Authentication > Policies if any fail.

Use the official Supabase SDK for your platform:
- **React Native / Expo**: `@supabase/supabase-js`
- **Flutter**: `supabase_flutter`
- **Swift / Android native**: `supabase-swift` / `supabase-kt`

```javascript
// Supabase client init (React Native example)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ysejulbuvunfhodersjr.supabase.co',
  'sb_publishable_nn7GsENQXU_YmbYO7S8bUA_s8P4SVW5'
);
```

### Fetch all tables
```javascript
const { data: tables } = await supabase
  .from('restaurant_tables')
  .select('*');
// Returns: Array of { id, table_number, status, capacity, location }
```

### Fetch billed orders for all tables (for dashboard card display)
```javascript
const { data: billedOrders } = await supabase
  .from('orders')
  .select('id, table_id, total_price, confirmed_total, status')
  .in('table_id', tableIds)
  .eq('status', 'billed')
  .order('created_at', { ascending: false });
```

### Fetch the current open or billed order for a table
```javascript
const { data: order } = await supabase
  .from('orders')
  .select('*')
  .eq('table_id', tableId)
  .in('status', ['open', 'billed'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

### Fetch order items
```javascript
const { data: items } = await supabase
  .from('order_items')
  .select('*')
  .eq('order_id', orderId);
```

### Fetch inventory stock in Restaurant warehouse
```javascript
// Step 1: get Restaurant warehouse ID
const { data: wh } = await supabase
  .from('inventory_warehouses')
  .select('id')
  .eq('name', 'Restaurant')
  .maybeSingle();

// Step 2: get stock with batch details
const { data: stock } = await supabase
  .from('inventory_stock')
  .select('*, batch:inventory_batches(*)')
  .eq('warehouse_id', wh.id);
```

### Fetch batch pricing for menu items
```javascript
const { data: pricing } = await supabase
  .from('menu_item_batch_pricing')
  .select('menu_item_id, batch_id, selling_price')
  .in('menu_item_id', menuItemIds);
```

### Create a new order
```javascript
const { data: newOrder } = await supabase
  .from('orders')
  .insert([{
    table_id: table.id,
    table_number: table.table_number,
    status: 'open',
    total_price: 0,
    waiter_id: currentUser.id,
    waiter_name: currentUser.name,
    customer_mobile: customerMobile || null,
  }])
  .select()
  .single();
```

### Add item to order (insert or increment)
```javascript
// Check if same menu item + price already in order
const { data: existing } = await supabase
  .from('order_items')
  .select('*')
  .eq('order_id', orderId)
  .eq('menu_item_id', menuItemId)
  .eq('price', itemPrice);

if (existing && existing.length > 0) {
  // Increment quantity
  await supabase
    .from('order_items')
    .update({ quantity: existing[0].quantity + quantityToAdd })
    .eq('id', existing[0].id);
} else {
  // Insert new row
  await supabase
    .from('order_items')
    .insert([{
      order_id: orderId,
      menu_item_id: menuItemId,
      batch_id: batchId || null,   // null for non-inventoried items
      name: menuItem.name,
      price: itemPrice,
      quantity: quantityToAdd,
    }]);
}

// Update order total
const { data: freshOrder } = await supabase
  .from('orders')
  .select('total_price')
  .eq('id', orderId)
  .single();

await supabase
  .from('orders')
  .update({
    total_price: freshOrder.total_price + (itemPrice * quantityToAdd),
    updated_at: new Date().toISOString(),
    waiter_id: currentUser.id,
    waiter_name: currentUser.name,
  })
  .eq('id', orderId);
```

### Mark table as occupied (when first item added)
```javascript
if (table.status === 'available') {
  await supabase
    .from('restaurant_tables')
    .update({ status: 'occupied' })
    .eq('id', table.id);
}
```

### Deduct inventory stock (for Inventoried items with batch)
```javascript
const { data: currentStock } = await supabase
  .from('inventory_stock')
  .select('*')
  .eq('warehouse_id', warehouseId)
  .eq('batch_id', batchId)
  .maybeSingle();

const newQty = currentStock.quantity - quantityToAdd;

await supabase
  .from('inventory_stock')
  .update({ quantity: newQty })
  .eq('id', currentStock.id);

// Log transaction
await supabase
  .from('inventory_transactions')
  .insert([{
    item_id: menuItem.linked_inventory_item_id,
    batch_id: batchId,
    transaction_type: 'issue',
    quantity: quantityToAdd,
    previous_stock: currentStock.quantity,
    new_stock: newQty,
    reason: 'Sold via POS',
    reference_department: warehouseId,
    created_by: currentUser.id,
  }]);
```

### Remove an order item
```javascript
await supabase.from('order_items').delete().eq('id', itemId);

// Restore stock (reverse of deduction above, transaction_type: 'return')

// Update order total
await supabase.from('orders').update({
  total_price: Math.max(0, currentTotal - (item.price * item.quantity)),
  updated_at: new Date().toISOString(),
}).eq('id', orderId);
```

### Update order item quantity
```javascript
await supabase
  .from('order_items')
  .update({ quantity: newQuantity })
  .eq('id', itemId);

// Adjust stock and order total accordingly (delta = newQuantity - oldQuantity)
```

### Send bill to cashier (waiter action)
```javascript
await supabase
  .from('orders')
  .update({
    status: 'billed',
    updated_at: new Date().toISOString(),
  })
  .eq('id', orderId);

// Keep table as 'occupied' — cashier frees it after payment
await supabase
  .from('restaurant_tables')
  .update({ status: 'occupied' })
  .eq('id', tableId);
```

### Save customer mobile number
```javascript
await supabase
  .from('orders')
  .update({ customer_mobile: mobileNumber })
  .eq('id', orderId);
```

---

## 7. Real-time Subscriptions

Use Supabase Realtime to get instant updates when other waiters or the cashier make changes.

> **Important**: Realtime must be enabled per table in Supabase Dashboard → Database → Replication. Enable it for `restaurant_tables` and `orders`.

### Subscribe to table status changes (dashboard)
```javascript
const channel = supabase
  .channel('table-updates')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'restaurant_tables' },
    (payload) => { refreshTables(); }
  )
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'orders' },
    (payload) => { refreshTables(); }
  )
  .subscribe();

// Cleanup on screen unmount:
supabase.removeChannel(channel);
```

### Subscribe to a specific order (order detail screen)
```javascript
const channel = supabase
  .channel(`order-${orderId}`)
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'order_items',
      filter: `order_id=eq.${orderId}`,
    },
    () => { refreshOrder(); }
  )
  .on('postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    },
    () => { refreshOrder(); }  // catches confirmed_total being set by cashier
  )
  .subscribe();
```

### Polling fallback (if Realtime not enabled)
If Realtime is not enabled on the tables, poll every 5 seconds:
```javascript
// Dashboard — refresh every 5 seconds
const interval = setInterval(() => refreshTables(), 5000);
// Clear on unmount: clearInterval(interval)

// Order detail — poll while order is 'billed' and confirmed_total is null
// (waiting for cashier to confirm)
if (order.status === 'billed' && !order.confirmed_total) {
  const interval = setInterval(() => refreshOrder(), 3000);
}
```

---

## 8. Billing Calculation Logic

When the order status is `billed`, the cashier reviews and confirms the total. The waiter can then tap **View Bill** to see the full breakdown.

### Step 1: Fetch billing config
```
GET /api/admin/app-settings?key=restaurant_billing_config
```

### Step 2: Calculate
```javascript
function calculateBill(subtotal, billingConfig) {
  // Service charges (applied to subtotal)
  const scLines = (billingConfig.service_charges || [])
    .filter(sc => sc.enabled)
    .map(sc => ({
      name: sc.name,
      type: sc.type,
      value: sc.value,
      amount: sc.type === 'percentage' ? subtotal * sc.value / 100 : sc.value,
    }));

  // Other charges (applied to subtotal)
  const ocLines = (billingConfig.other_charges || [])
    .filter(oc => oc.enabled)
    .map(oc => ({
      name: oc.name,
      type: oc.type,
      value: oc.value,
      amount: oc.type === 'percentage' ? subtotal * oc.value / 100 : oc.value,
    }));

  const scTotal = scLines.reduce((sum, l) => sum + l.amount, 0);
  const ocTotal = ocLines.reduce((sum, l) => sum + l.amount, 0);

  // VAT is applied AFTER service + other charges
  const vatBase = subtotal + scTotal + ocTotal;
  const vatAmount = billingConfig.vat?.enabled
    ? vatBase * billingConfig.vat.rate / 100
    : 0;

  const grandTotal = subtotal + scTotal + ocTotal + vatAmount;

  return { scLines, ocLines, vatAmount, grandTotal };
}
```

### Step 3: Display
Show `order.confirmed_total` as the grand total if set (cashier may have applied a discount or override). Fall back to the calculated `grandTotal` if `confirmed_total` is null.

```javascript
const displayTotal = order.confirmed_total ?? grandTotal;
```

### View Bill button logic
```
if order.status === 'billed':
  if order.confirmed_total is set → show "View Bill — LKR X.XX" (enabled)
  if order.confirmed_total is null → show "View Bill (awaiting cashier)" (disabled)
```

---

## 9. Menu Item Logic

### Filtering rules (what a waiter sees)
1. `availability === true` — only show available items
2. `sell_type !== 'Indirect'` — hide items sold indirectly (e.g. via hotel billing)

### Inventoried items with batches
When `stock_type === 'Inventoried'` and `linked_inventory_item_id` is set:
- Fetch available batches from `inventory_stock` (Restaurant warehouse) joined with `inventory_batches`
- Filter out batches where `expiry_date < today` or `quantity <= 0`
- Sort by `expiry_date` ascending (FIFO — use earliest expiry first)
- Each batch may have a different `selling_price` from `menu_item_batch_pricing`
- Show batch selection dialog when the waiter taps "Add" for such an item

```javascript
// Build available_batches for a menu item
const availableBatches = stockData
  .filter(s =>
    s.item_id === menuItem.linked_inventory_item_id &&
    s.batch &&
    s.quantity > 0 &&
    (!s.batch.expiry_date || s.batch.expiry_date >= todayStr)
  )
  .map(s => ({
    id: s.batch.id,
    batch_number: s.batch.batch_number,
    expiry_date: s.batch.expiry_date,
    quantity: s.quantity,
    selling_price: pricingMap[menuItem.id]?.[s.batch.id] ?? null,
  }))
  .sort((a, b) => {
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
```

### Price to display
```javascript
// For inventoried items — show price range across batches
const prices = batches
  .map(b => b.selling_price)
  .filter(p => p != null && p > 0);
const min = Math.min(...prices);
const max = Math.max(...prices);
const priceDisplay = min === max ? `LKR ${min}` : `LKR ${min} – ${max}`;

// For non-inventoried items
const priceDisplay = `LKR ${menuItem.price}`;
```

### Item price to use when adding to order
```javascript
const itemPrice = batch?.selling_price || menuItem.price;
```

---

## 10. Recommended Mobile Tech Stack

Given the web app is Next.js + React, **React Native with Expo** is the natural match — same language, similar patterns, maximum code sharing.

### Recommended stack

| Concern | Package |
|---|---|
| Framework | Expo (React Native) |
| Navigation | Expo Router or React Navigation |
| Supabase | `@supabase/supabase-js` |
| Secure storage (token) | `expo-secure-store` |
| State management | React Context + useState (same as web) |
| HTTP client | `fetch` (built-in) |
| Real-time | Supabase JS client (included above) |
| UI components | NativeWind (Tailwind for RN) or React Native Paper |

### Alternative: Flutter
If Flutter is preferred, use `supabase_flutter` package and `flutter_secure_storage` for token.

---

## 11. Screen-by-Screen Specification

### Screen 1: Login

**Fields**: Email, Password  
**Action**: `POST /api/auth/login`  
**On success**: Store `token` in SecureStorage, navigate to Dashboard  
**On fail**: Show error message from `response.error`

---

### Screen 2: Waiter Dashboard (Table List)

**Data needed**:
1. `GET /api/admin/restaurant-sections` → sections for tab grouping
2. `supabase.from('restaurant_tables').select('*')` → all tables
3. `supabase.from('orders').select(...)...eq('status','billed')` → billed orders for card display
4. `supabase.from('order_items').select(...)` → items for each billed order card

**Layout**:
- Tabs across top — one per section
- Grid of table cards inside each tab
- Refresh button top-right

**Table card states**:

| State | Badge | Border | Bottom Button |
|---|---|---|---|
| `available` | Green "Available" | Green | "View / Add Order" (primary) |
| `occupied` (open order) | Yellow "Occupied" | Yellow | "View / Add Order" (primary) |
| `billed` (awaiting payment) | Orange "Awaiting Payment" | Orange | "View Bill" (outline) |
| `reserved` | Purple "Reserved" | Purple | "View / Add Order" (primary) |

**Billed card extra content**:
- List of order items: `Item Name × qty — LKR amount`
- If `confirmed_total` set: show "Total (incl. charges): LKR X.XX" in green
- If `confirmed_total` null: show subtotal only

**Polling / Realtime**: Refresh every 5 seconds + Supabase Realtime on `restaurant_tables` and `orders`

---

### Screen 3: Order Detail Screen

Opened when waiter taps a table card. Two states: **Not Billed** and **Billed**.

#### State A — Not Billed (active order)

**Layout**: Two-column on tablet, stacked on phone

**Left panel — Menu**:
- Search bar (filter by name)
- Category dropdown/chips (filter by `menu_sections`)
- List of available menu items (availability=true, sell_type=Direct)
- Each item shows: name, price (or range), stock count if inventoried
- "Add" button — disabled if out of stock
- If item has batches: opens Batch Selection bottom sheet

**Right panel — Current Bill**:
- Customer Mobile input (optional, saved on blur)
- List of `order_items` with +/− controls and delete button
- "New Items" section showing items in local cart (not yet submitted)
- Total amount (order total + local cart)
- **"Add Items to Bill"** button — disabled if local cart is empty
- **"Send to Payment"** button — disabled if no open order exists

#### State B — Billed (awaiting cashier)

**Layout**: Single centered panel

**Content**:
- Yellow banner: "Bill sent — awaiting payment from cashier."
- List of order items (read-only, quantity shown as "× N")
- **"View Bill"** button:
  - Disabled with label "View Bill (awaiting cashier confirmation)" if `confirmed_total` is null
  - Enabled with label "View Bill — LKR X.XX" once cashier sets `confirmed_total`
- Poll order every 3 seconds while billed + no `confirmed_total`

---

### Screen 4: Batch Selection Bottom Sheet

Shown when waiter taps "Add" on an inventoried menu item.

**For each batch**:
- Batch number
- Expiry date (if set)
- Available stock
- Selling price: "LKR X.XX"
- "Add to Order" button (disabled if stock = 0)

---

### Screen 5: Bill Breakdown Dialog

Shown when waiter taps the enabled "View Bill" button.

**Content**:
1. Header: "Bill — Table [N]"
2. Item lines (grey): `Item Name × qty — LKR X.XX`
3. Separator
4. Subtotal: `LKR X.XX`
5. Each enabled service charge: `Charge Name (X%) — LKR X.XX`
6. Each enabled other charge: `Charge Name (X%) — LKR X.XX`
7. VAT line (if enabled): `VAT (X%) — LKR X.XX`
8. Separator
9. **Total** (green, bold): `LKR X.XX` ← use `order.confirmed_total`
10. Close button

---

## 12. Complete Workflow: Waiter Takes an Order

```
1. WAITER opens app → sees table grid

2. WAITER taps an available table
   → Open Order Detail screen
   → Fetch menu items (GET /api/admin/menu-items)
   → Fetch existing open order for this table (none exists yet)

3. WAITER searches menu, selects item
   → If inventoried: show Batch Selection sheet
   → Item goes into local cart

4. WAITER taps "Add Items to Bill"
   → No existing order: CREATE new order in `orders` (status=open)
   → INSERT order_items for each cart item
   → UPDATE order.total_price
   → UPDATE table.status = 'occupied' (if was 'available')
   → Deduct inventory_stock (if inventoried)
   → Log inventory_transactions
   → Clear local cart

5. WAITER can continue adding items (repeat step 3–4)

6. WAITER optionally enters customer mobile number (for loyalty)
   → PATCH order.customer_mobile on blur

7. WAITER taps "Send to Payment"
   → UPDATE order.status = 'billed'
   → Screen switches to Billed state
   → Start polling every 3s for confirmed_total

8. CASHIER (web app) confirms payment
   → Sets order.confirmed_total = grand total with charges
   → Sets order.status = 'closed'
   → Sets table.status = 'available'

9. WAITER app detects confirmed_total is set (via poll or realtime)
   → "View Bill" button becomes enabled

10. WAITER taps "View Bill"
    → Fetch billing config (GET /api/admin/app-settings?key=restaurant_billing_config)
    → Show full breakdown dialog with confirmed_total as grand total
```

---

## 13. Important Notes & Gotchas

### Auth cookie vs. Bearer token
The web app uses an `httpOnly` cookie (`auth_token`). Mobile apps must use the `Authorization: Bearer <token>` header. The backend login route must be modified to return the token in the response body (see Section 3).

### `confirmed_total` and `customer_mobile` columns
These columns were added via migration. If the database returns a "column not found" error, run this SQL in Supabase SQL Editor:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_mobile TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_total NUMERIC;
```

### `app_settings` RLS
The `app_settings` table has an RLS policy requiring `auth.role() = 'authenticated'`. Since the custom JWT doesn't integrate with Supabase Auth, direct Supabase client queries to this table will fail. Always use the API route:
```
GET /api/admin/app-settings?key=restaurant_billing_config
```

### Supabase Realtime setup
In Supabase Dashboard → Database → Replication, enable the following tables:
- `restaurant_tables`
- `orders`
- `order_items`

Without this, Realtime subscriptions silently receive no events. Use polling as a fallback.

### order.total_price is the RAW subtotal
`orders.total_price` is always the sum of `order_items` prices only — no service charges, no VAT. The final amount the customer pays is `orders.confirmed_total`, set by the cashier after applying all charges.

### Batch pricing overrides base price
For inventoried items, each batch can have a different selling price in `menu_item_batch_pricing`. Always check this table and use `batch.selling_price` if available; fall back to `menu_items.price` only if null.

### FIFO batch selection
Sort available batches by `expiry_date` ascending so the earliest-expiring stock is shown first and used first.

### Table ↔ Section mapping
`restaurant_tables.location` is a plain text string that matches `restaurant_sections.name`. Filter tables into sections by comparing `table.location === section.name`.

---

## 14. Environment & Deployment Checklist

Before going to production:

- [ ] Change `AUTH_SECRET` from `your-secret-key-change-in-prod` to a strong random string
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` on the server (currently empty in .env.local)
- [ ] Enable Realtime on `restaurant_tables`, `orders`, `order_items` in Supabase
- [ ] Modify login route to return `token` in response body
- [ ] Update all protected API routes to accept `Authorization: Bearer` header
- [ ] Run DB migrations for `confirmed_total` and `customer_mobile` columns
- [ ] Add RLS policy for public read of `app_settings` (or always use the API route)
- [ ] Configure production CORS if the mobile app calls the Next.js API directly

---

*Generated from codebase: Orudhota Chalets Admin — branch `main` — 2026-06-30*
