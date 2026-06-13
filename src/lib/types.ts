


export type UserRole = 'admin' | 'waiter' | 'kitchen' | 'payment';
export type PaymentMethod = 'cash' | 'card';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string;
  phone_number?: string;
  address?: string;
  nic?: string;
  job_title?: string;
  join_date?: string;
  permissions?: string[];
  department?: string;
  restrict_admin_permissions?: boolean;
  gender?: string;
  leave_scheme_id?: string | null;
  reporting_manager_id?: string | null;
  working_calendar_id?: string | null;
  // Joined objects populated by /api/auth/me
  leave_scheme?: {
    id: string;
    name: string;
    leave_scheme_types?: { id: string; name: string; days_count: number; reset_period: string }[];
  } | null;
  working_calendar?: {
    id: string;
    name: string;
    year: number;
    description?: string;
  } | null;
};

export type WorkingCalendar = {
  id: string;
  name: string;
  description?: string;
  year: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TableStatus = 'available' | 'occupied' | 'reserved';

export type Table = {
  id: string;
  table_number: number;
  status: TableStatus;
  capacity: number;
  location?: string;
};


export type RestaurantSection = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type MenuSection = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type TableSection = string;

export type MenuCategory = string;

export type DishVariety = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  buying_price: number;
  category: MenuCategory;
  availability: boolean;
  stock_type: 'Inventoried' | 'Non-Inventoried';
  stock?: number;
  unit?: 'kg' | 'g' | 'l' | 'ml';
  sell_type: 'Direct' | 'Indirect';
  variety_of_dishes?: string;
  linked_inventory_item_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Order = {
  id: string;
  table_id: string;
  table_number: number;
  status: 'open' | 'billed' | 'closed';
  total_price: number;
  waiter_id: string;
  waiter_name: string;
  customer_id?: string;
  created_at?: string;
  updated_at?: string;
  bill_number?: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  batch_id?: string;
  name: string;
  price: number;
  quantity: number;
};

export const INVENTORY_UOM = [
  'kg', 
  'g', 
  'Ltr', 
  'Ml', 
  'Nos', 
  'Box', 
  'Btl', 
  'Pkt', 
  'Can', 
  'Roll', 
  'Bundle', 
  'Crtn', 
  'Tin',
  'Ream',
  'Cylinder',
  'Card'
] as const;

export type Bill = {
  id: string;
  bill_number: string;
  order_id: string;
  table_id: string;
  table_number: number;
  waiter_name: string;
  items: OrderItem[];
  status: 'unpaid' | 'paid' | 'cancelled';
  payment_method?: 'cash' | 'card';
  subtotal: number;
  discount: number;
  total: number;
  created_at?: string;
  paid_at?: string;
};


export type RoomStatus = 'available' | 'occupied' | 'maintenance';

export type Room = {
  id: string;
  title: string;
  room_number: string;     // mapped from room_number
  type: string;
  pricePerNight: number;   // Existing DB has camelCase?
  roomCount: number;       // Existing DB has camelCase?
  view: string;
  status: RoomStatus;
  created_at?: string;
};

export type ReservationStatus = 'booked' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled' | 'completed' | 'pending';

export type Reservation = {
  id: string;
  guest_name: string;
  guest_email?: string;
  customer_id?: string;
  room_id: string;
  room_title?: string;
  room?: {
    title: string;
  };
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_cost: number;
  status: ReservationStatus;
  created_at?: string;
  updated_at?: string;
};

export type WithId<T> = T & { id: string };

export type LoyaltyDiscount = {
  id: string;
  name: string;
  points_required: number;
  discount_percentage: number;
  is_active: boolean;
  created_at?: string;
};

export type Activity = {
  id: string;
  name: string;
  description?: string;
  type: 'priceable' | 'non-priceable';
  price_per_person?: number;
  created_at?: string;
  updated_at?: string;
};

export type Experience = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  created_at?: string;
  updated_at?: string;
};

export type BlogColor = 'amber' | 'green' | 'creme' | 'blue';

export type Blog = {
  id: string;
  title: string;
  preview_header: string;
  preview_description: string;
  header_1: string;
  content_1: string;
  content_2?: string;
  content_image?: string;
  author_id: string;
  featured: boolean;
  featured_position?: number;
  color: BlogColor;
  tags: string[];
  pro_tips: { title: string; description: string }[];
  booking_button_text: string;
  booking_button_content: string;
  created_at?: string;
  updated_at?: string;
};

export type LoyaltyCustomer = {
  id: string;
  name: string;
  mobile_number: string;
  dob?: string;
  total_loyalty_points: number;
  created_at?: string;
  updated_at?: string;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at?: string;
  updated_at?: string;
};

export type OtherIncome = {
  id: string;
  description: string;
  amount: number;
  source: string;
  date: string;
  created_at?: string;
  updated_at?: string;
};

export type ServiceIncomeItem = {
  description: string;
  amount: number;
};

export type ServiceIncome = {
  id: string;
  description: string;
  amount: number;
  service_type: string;
  date: string;
  customer_name?: string;
  room_number?: string;
  customer_id?: string;
  payment_status?: 'paid' | 'add_to_bill';
  payment_method?: 'cash' | 'card';
  line_items?: ServiceIncomeItem[];
  created_at?: string;
  updated_at?: string;
};

export type ConsolidatedBill = {
  customer: Customer;
  reservations: Reservation[];
  orders: Order[];
  serviceIncomes: ServiceIncome[];
  totalOutstanding: number;
  totalPaid: number;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
};

export type LeaveType = 'annual' | 'sick' | 'casual' | 'nopay';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type Leave = {
  id: string;
  user_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
  status: LeaveStatus;
  approved_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type LeaveSchemeType = {
  id: string;
  scheme_id: string;
  name: string;
  days_count: number;
  reset_period: 'weekly' | 'monthly' | 'yearly';
  carry_forward: boolean;
  carry_forward_max?: number;
  created_at?: string;
  updated_at?: string;
};

export type LeaveScheme = {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  leave_scheme_types?: LeaveSchemeType[];
};

export type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  half_day_type?: 'morning' | 'evening';
  created_at?: string;
  updated_at?: string;
};

export type DailyReport = {
  id: string;
  user_id: string;
  date: string;
  tasks_completed: string;
  issues_faced?: string;
  next_day_plan?: string;
  created_at?: string;
  updated_at?: string;
};

export type SalaryDetails = {
  id: string;
  user_id: string;
  basic_salary: number;
  fixed_allowances: number;
  updated_at?: string;
};

export type PayrollRecord = {
  id: string;
  user_id: string;
  month: string;
  basic_salary: number;
  allowances: number;
  gross_salary: number;
  epf_employee_8: number;
  epf_employer_12: number;
  etf_employer_3: number;
  tax: number;
  deductions: number;
  net_salary: number;
  status: 'draft' | 'processed';
  created_at?: string;
  updated_at?: string;
};

export type Attendance = {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'present' | 'absent' | 'half-day';
  latitude?: number;
  longitude?: number;
  created_at?: string;
  users?: {
    name: string;
    email: string;
    role: string;
  };
};

export type InventoryDepartment = {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  items_count?: { count: number }[];
  created_at?: string;
};

export type InventoryWarehouse = {
  id: string;
  name: string;
  type: 'MAIN' | 'DEPARTMENT';
  department_id?: string;
  is_main: boolean;
  status: 'active' | 'inactive';
  is_active: boolean;
  description?: string;
  department?: { id: string; name: string };
  created_at?: string;
  updated_at?: string;
};

export type InventoryItemCategory = {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
};

export type InventoryUnit = {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
};

export type InventoryItem = {
  id: string;
  code: string;
  name: string;
  description?: string;
  category_id: string;
  category?: InventoryItemCategory;
  unit_id: string;
  unit?: InventoryUnit;
  item_size?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
  
  // Computed fields for UI
  total_stock: number;
  warehouse_stock?: {
    id: string;
    name: string;
    total_stock: number;
    batches?: InventoryBatch[];
  }[];
  batches?: InventoryBatch[];
};

export type InventoryBatch = {
  id: string;
  item_id: string;
  item?: InventoryItem;
  batch_number: string;
  buying_price: number;
  expiry_date?: string;
  supplier?: string;
  status: 'active' | 'expired' | 'depleted';
  created_at?: string;
  updated_at?: string;
  // Computed fields populated by the batches API
  total_stock?: number;
  warehouse_stock?: { name: string; quantity: number }[];
  pricing_id?: string | null;
  selling_price?: number | null;
};

export type MenuItemBatchPricing = {
  id: string;
  menu_item_id: string;
  batch_id: string;
  batch?: InventoryBatch;
  selling_price: number;
  created_at?: string;
  updated_at?: string;
};

export type InventoryStock = {
  id: string;
  warehouse_id: string;
  warehouse?: InventoryWarehouse;
  item_id: string;
  item?: InventoryItem;
  batch_id: string;
  batch?: InventoryBatch;
  quantity: number;
  last_updated: string;
};

export type HotelInventoryProduct = {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  item_size?: string;
  category: string;
  unit: string;
  safety_stock: number;
  reorder_level: number;
  maximum_level?: number;
  created_at?: string;
  updated_at?: string;
};

export type LegacyInventoryBatch = {
  id: string;
  product_id: string;
  product?: HotelInventoryProduct;
  batch_number?: string;
  supplier?: string;
  buying_price: number;
  expiry_date?: string;
  created_at?: string;
  updated_at?: string;
};

export type HotelInventoryItem = {
  id: string;
  product_id: string;
  product?: HotelInventoryProduct;
  batch_id?: string;
  batch?: LegacyInventoryBatch;
  name?: string; // Legacy/Display
  description?: string; // Legacy/Display
  category?: string | InventoryItemCategory; // Legacy or Normalized
  unit?: string | InventoryUnit; // Legacy or Normalized
  department_id: string;
  department?: { name: string };
  item_size?: string;
  buying_price: number;
  current_stock: number;
  safety_stock?: number; // Legacy/Moved to product
  reorder_level?: number; // Legacy/Moved to product
  maximum_level?: number; // Legacy/Moved to product
  status: 'active' | 'inactive';
  brand?: string;
  supplier?: string;
  barcode?: string;
  expiry_date?: string;
  batch_number?: string;
  created_at?: string;
  updated_at?: string;
  menu_items?: { id: string; price: number; category: string }[];
};

export type InventoryTransaction = {
  id: string;
  item_id: string;
  item?: { 
    name: string; 
    category?: { name: string };
    unit?: { name: string };
  };
  batch_id?: string;
  batch?: InventoryBatch;
  transaction_type: 'receive' | 'issue' | 'damage' | 'audit_adjustment' | 'initial_stock';
  quantity: number;
  item_size?: string;
  previous_stock?: number;
  new_stock?: number;
  reference_department?: string;
  department?: { name: string };
  reason?: string;
  remarks?: string;
  brand?: string;
  supplier?: string;
  expiry_date?: string;
  unit_price?: number;
  barcode?: string;
  batch_number?: string;
  created_by?: string;
  user?: { name: string };
  created_at?: string;
};

export type InventoryRequest = {
    id: string;
    request_type: 'NEW_ITEM' | 'ADD_STOCK' | 'receive' | 'issue' | 'damage' | 'audit_adjustment' | 'initial_stock' | 'TRANSFER_REQUEST';
    item_id: string | null;
    item?: InventoryItem;
    requested_quantity: number;
    estimated_cost?: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    requested_by: string;
    requester?: { name: string; email: string; department: string };
    reviewed_by?: string;
    reviewer?: { name: string; email: string };
    notes?: string;
    action_metadata?: {
        brand?: string;
        expiry_date?: string;
        unit_price?: number;
        barcode?: string;
        received_quantity?: number;
        item_price?: number;
        actual_cost?: number;
        reference_department?: string | null;
        reason?: string;
        requesting_department_id?: string;
        requesting_department_name?: string;
        needs_external_purchase?: boolean;
    };
    purchase_order_id?: string;
    created_at: string;
    updated_at: string;
};

export type TableBookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type TableBooking = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  date: string;
  meal_type: string;
  guests: number;
  comments?: string;
  status: TableBookingStatus;
  created_at?: string;
};
