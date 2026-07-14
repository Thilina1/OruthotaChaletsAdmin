-- Inventory Cash Requests: petty-cash style workflow for buying inventory items
CREATE TABLE IF NOT EXISTS inventory_cash_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_number TEXT UNIQUE NOT NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    purpose TEXT NOT NULL,
    requested_amount DECIMAL(12,2) NOT NULL,
    approved_amount DECIMAL(12,2),
    issued_amount DECIMAL(12,2),
    spent_amount DECIMAL(12,2),
    returned_amount DECIMAL(12,2),

    -- Overspend additional request (sub-flow within the same record)
    additional_requested_amount DECIMAL(12,2),
    additional_reason TEXT,
    additional_status TEXT CHECK (additional_status IN ('PENDING', 'APPROVED', 'REJECTED', 'ISSUED')),
    additional_approved_amount DECIMAL(12,2),
    additional_issued_amount DECIMAL(12,2),
    additional_rejection_reason TEXT,

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'SETTLED')),
    notes TEXT,
    rejection_reason TEXT,

    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    issued_by UUID REFERENCES users(id),
    issued_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icr_requested_by ON inventory_cash_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_icr_status ON inventory_cash_requests(status);
CREATE INDEX IF NOT EXISTS idx_icr_po_id ON inventory_cash_requests(purchase_order_id);
