


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
  permissions?: string[]; // Array of application section paths they can access
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
  created_at?: string;
  updated_at?: string;
  bill_number?: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
};

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

export type ReservationStatus = 'booked' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';

export type Reservation = {
  id: string;
  guest_name: string;
  guest_email?: string;
  room_id: string;
  room_title?: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
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
  created_at?: string;
};

export type HotelInventoryItem = {
  id: string;
  name: string;
  description?: string;
  category: string;
  department_id: string;
  department?: { name: string };
  unit: string;
  buying_price: number;
  current_stock: number;
  safety_stock: number;
  reorder_level: number;
  maximum_level: number;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
};

export type InventoryTransaction = {
  id: string;
  item_id: string;
  item?: { name: string };
  transaction_type: 'receive' | 'issue' | 'damage' | 'audit_adjustment' | 'initial_stock';
  quantity: number;
  previous_stock?: number;
  new_stock?: number;
  reference_department?: string;
  department?: { name: string };
  reason?: string;
  remarks?: string;
  created_by?: string;
  user?: { name: string };
  created_at?: string;
};
