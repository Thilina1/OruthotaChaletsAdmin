-- A daily roster controls which casual workers appear in Attendance & Pay for
-- each specific date. A worker can be assigned to any number of separate dates.
CREATE TABLE IF NOT EXISTS public.casual_worker_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.casual_workers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, work_date)
);

ALTER TABLE public.casual_worker_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_casual_worker_assignments" ON public.casual_worker_assignments;
CREATE POLICY "allow_all_casual_worker_assignments"
  ON public.casual_worker_assignments
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS casual_worker_assignments_date_idx
  ON public.casual_worker_assignments (work_date);

CREATE INDEX IF NOT EXISTS casual_worker_assignments_worker_idx
  ON public.casual_worker_assignments (worker_id);

COMMENT ON TABLE public.casual_worker_assignments IS
  'Per-date roster of casual workers shown in Attendance & Pay.';
