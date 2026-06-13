CREATE TABLE IF NOT EXISTS user_calendar_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    day_type TEXT NOT NULL DEFAULT 'holiday' CHECK (day_type IN ('holiday', 'half_day', 'working_day')),
    action TEXT NOT NULL DEFAULT 'add' CHECK (action IN ('add', 'remove')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
