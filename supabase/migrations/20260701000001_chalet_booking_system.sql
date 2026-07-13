-- Chalet rooms (10 physical chalets)
CREATE TABLE chalet_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    room_number TEXT NOT NULL UNIQUE,
    floor TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
    notes TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packages (Room Only, Bed & Breakfast, Half Board, Full Board)
CREATE TABLE chalet_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    includes_breakfast BOOLEAN NOT NULL DEFAULT FALSE,
    includes_lunch BOOLEAN NOT NULL DEFAULT FALSE,
    includes_dinner BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Occupancy types (Single, Double, Triple, Quadruple, Family)
CREATE TABLE chalet_occupancy_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    max_guests INT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate matrix (package × occupancy type)
CREATE TABLE chalet_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES chalet_packages(id) ON DELETE CASCADE,
    occupancy_type_id UUID NOT NULL REFERENCES chalet_occupancy_types(id) ON DELETE CASCADE,
    rate_per_night NUMERIC(12,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(package_id, occupancy_type_id)
);

-- Bookings
CREATE TABLE chalet_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_ref TEXT NOT NULL UNIQUE DEFAULT 'CB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6)),
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    nights INT GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
    package_id UUID REFERENCES chalet_packages(id),
    occupancy_type_id UUID REFERENCES chalet_occupancy_types(id),
    guest_count INT NOT NULL DEFAULT 1,
    room_id UUID REFERENCES chalet_rooms(id),
    rate_per_night NUMERIC(12,2) NOT NULL DEFAULT 0,
    service_charge_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
    subtotal NUMERIC(12,2) GENERATED ALWAYS AS (rate_per_night * (check_out_date - check_in_date)) STORED,
    service_charge_amount NUMERIC(12,2) GENERATED ALWAYS AS (rate_per_night * (check_out_date - check_in_date) * service_charge_pct / 100) STORED,
    grand_total NUMERIC(12,2) GENERATED ALWAYS AS (rate_per_night * (check_out_date - check_in_date) * (1 + service_charge_pct / 100)) STORED,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
    special_requests TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default packages
INSERT INTO chalet_packages (name, description, includes_breakfast, includes_lunch, includes_dinner, sort_order) VALUES
('Room Only', 'Accommodation only, no meals included', FALSE, FALSE, FALSE, 1),
('Bed & Breakfast', 'Accommodation with breakfast', TRUE, FALSE, FALSE, 2),
('Half Board', 'Accommodation with breakfast and dinner', TRUE, FALSE, TRUE, 3),
('Full Board', 'Accommodation with all meals', TRUE, TRUE, TRUE, 4);

-- Seed default occupancy types
INSERT INTO chalet_occupancy_types (name, max_guests, sort_order) VALUES
('Single', 1, 1),
('Double', 2, 2),
('Triple', 3, 3),
('Quadruple', 4, 4),
('Family', 6, 5);

-- Seed 10 chalet rooms
INSERT INTO chalet_rooms (name, room_number, sort_order) VALUES
('Chalet 01', '01', 1),
('Chalet 02', '02', 2),
('Chalet 03', '03', 3),
('Chalet 04', '04', 4),
('Chalet 05', '05', 5),
('Chalet 06', '06', 6),
('Chalet 07', '07', 7),
('Chalet 08', '08', 8),
('Chalet 09', '09', 9),
('Chalet 10', '10', 10);

-- Seed rates based on the rate card image
-- We'll insert rates after we know package/occupancy IDs via DO block
DO $$
DECLARE
    pkg_room_only UUID;
    pkg_bb UUID;
    pkg_hb UUID;
    pkg_fb UUID;
    occ_single UUID;
    occ_double UUID;
    occ_triple UUID;
    occ_quadruple UUID;
    occ_family UUID;
BEGIN
    SELECT id INTO pkg_room_only FROM chalet_packages WHERE name = 'Room Only';
    SELECT id INTO pkg_bb FROM chalet_packages WHERE name = 'Bed & Breakfast';
    SELECT id INTO pkg_hb FROM chalet_packages WHERE name = 'Half Board';
    SELECT id INTO pkg_fb FROM chalet_packages WHERE name = 'Full Board';
    SELECT id INTO occ_single FROM chalet_occupancy_types WHERE name = 'Single';
    SELECT id INTO occ_double FROM chalet_occupancy_types WHERE name = 'Double';
    SELECT id INTO occ_triple FROM chalet_occupancy_types WHERE name = 'Triple';
    SELECT id INTO occ_quadruple FROM chalet_occupancy_types WHERE name = 'Quadruple';
    SELECT id INTO occ_family FROM chalet_occupancy_types WHERE name = 'Family';

    INSERT INTO chalet_rates (package_id, occupancy_type_id, rate_per_night) VALUES
    -- Room Only
    (pkg_room_only, occ_single,    9200),
    (pkg_room_only, occ_double,   11350),
    (pkg_room_only, occ_triple,   12500),
    (pkg_room_only, occ_quadruple,14600),
    (pkg_room_only, occ_family,   17300),
    -- Bed & Breakfast
    (pkg_bb, occ_single,   11200),
    (pkg_bb, occ_double,   15350),
    (pkg_bb, occ_triple,   18500),
    (pkg_bb, occ_quadruple,22600),
    (pkg_bb, occ_family,   25300),
    -- Half Board
    (pkg_hb, occ_single,   13200),
    (pkg_hb, occ_double,   19400),
    (pkg_hb, occ_triple,   24500),
    (pkg_hb, occ_quadruple,30600),
    (pkg_hb, occ_family,   33300),
    -- Full Board
    (pkg_fb, occ_single,   15200),
    (pkg_fb, occ_double,   23500),
    (pkg_fb, occ_triple,   30500),
    (pkg_fb, occ_quadruple,38600),
    (pkg_fb, occ_family,   41300);
END $$;

-- RLS
ALTER TABLE chalet_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalet_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalet_occupancy_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalet_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalet_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chalet_rooms_all" ON chalet_rooms FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "chalet_packages_all" ON chalet_packages FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "chalet_occupancy_types_all" ON chalet_occupancy_types FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "chalet_rates_all" ON chalet_rates FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "chalet_bookings_all" ON chalet_bookings FOR ALL USING (TRUE) WITH CHECK (TRUE);
