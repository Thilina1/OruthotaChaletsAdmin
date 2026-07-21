-- Separate "the bill is paid" from "the guest has checked out": front desk
-- needs to mark a stay's room/chalet charge as paid without immediately
-- ending the stay, and only allow Check Out once nothing is outstanding.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid'));

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid'));
