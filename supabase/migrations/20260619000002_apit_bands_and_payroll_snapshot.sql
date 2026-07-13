-- APIT tax bands (IRD Tax Table No. 01, configurable by admins)
CREATE TABLE IF NOT EXISTS apit_tax_bands (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order   INT              NOT NULL DEFAULT 0,
    band_label   TEXT             NOT NULL,
    min_income   NUMERIC(14, 2)   NOT NULL,
    max_income   NUMERIC(14, 2),              -- NULL = no upper limit (top band)
    rate         NUMERIC(6, 4)    NOT NULL,   -- e.g. 0.06 for 6%
    deduction    NUMERIC(14, 2)   NOT NULL DEFAULT 0,
    effective_from DATE           NOT NULL DEFAULT '2025-04-01',
    created_at   TIMESTAMPTZ      DEFAULT NOW(),
    updated_at   TIMESTAMPTZ      DEFAULT NOW()
);

-- Seed with IRD rates effective 01.04.2025
INSERT INTO apit_tax_bands (sort_order, band_label, min_income, max_income, rate, deduction) VALUES
    (1, 'Up to 150,000',        0,      150000, 0.00,  0),
    (2, '150,001 – 233,333',    150001, 233333, 0.06,  9000),
    (3, '233,334 – 275,000',    233334, 275000, 0.18,  37000),
    (4, '275,001 – 316,667',    275001, 316667, 0.24,  53500),
    (5, '316,668 – 358,333',    316668, 358333, 0.30,  72500),
    (6, 'Above 358,333',        358334, NULL,   0.36,  94000)
ON CONFLICT DO NOTHING;

-- Store a full calculation snapshot on each processed payroll record
-- so changing rates/salary later never alters historical figures.
ALTER TABLE payroll_records
    ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB;
