import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type DayValue = 0 | 0.5 | 1;

// Build a per-date working-value function from calendar entries + user overrides.
// Returns: 0 = off, 0.5 = half day, 1 = full working day.
function buildDayValueFn(
    calendarEntries: Array<{ date: string; day_type: string }>,
    userOverrides: Array<{ date: string; day_type: string; action: string }>
): (dateStr: string) => DayValue {
    const calMap = new Map<string, string>();
    for (const e of calendarEntries) calMap.set(e.date, e.day_type);

    const overrideMap = new Map<string, { day_type: string; action: string }>();
    for (const o of userOverrides) overrideMap.set(o.date, o);

    return (dateStr: string): DayValue => {
        const dow = new Date(`${dateStr}T12:00:00`).getDay();
        const isWeekday = dow >= 1 && dow <= 5; // Mon–Fri only; Sat/Sun are off by default
        const override = overrideMap.get(dateStr);
        const calEntry = calMap.get(dateStr);

        let effective: string | undefined;
        if (override) {
            effective = override.action === 'add' ? override.day_type : undefined;
        } else {
            effective = calEntry;
        }

        if (effective === 'holiday') return 0;
        if (effective === 'half_day') return 0.5;
        if (effective === 'working_day') return 1;
        return isWeekday ? 1 : 0;
    };
}

// Iterate [fromStr, toStr] and sum day values.
function countWorkingDays(
    fromStr: string,
    toStr: string,
    dayValue: (d: string) => DayValue
): number {
    let total = 0;
    let [y, m, d] = fromStr.split('-').map(Number);
    while (true) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (ds > toStr) break;
        total += dayValue(ds);
        d++;
        const dim = new Date(y, m, 0).getDate();
        if (d > dim) { d = 1; m++; }
        if (m > 12) { m = 1; y++; }
    }
    return total;
}

// Mark all working days in [from, to] that fall within [windowStart, windowEnd]
// into the given Set.
function markLeaveDays(
    leaveStart: string,
    leaveEnd: string,
    windowStart: string,
    windowEnd: string,
    dayValue: (d: string) => DayValue,
    target: Set<string>
): void {
    const from = leaveStart < windowStart ? windowStart : leaveStart;
    const to = leaveEnd > windowEnd ? windowEnd : leaveEnd;
    if (from > to) return;

    let [y, m, d] = from.split('-').map(Number);
    while (true) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (ds > to) break;
        if (dayValue(ds) > 0) target.add(ds);
        d++;
        const dim = new Date(y, m, 0).getDate();
        if (d > dim) { d = 1; m++; }
        if (m > 12) { m = 1; y++; }
    }
}

function isNopayName(name: string): boolean {
    const n = name.toLowerCase().replace(/[\s\-_]/g, '');
    return n.includes('nopay') || n === 'unpaid' || n === 'leavewithoutpay' || n === 'lwp';
}

// Apply the configured APIT bands (sorted by sort_order ascending).
// Bands are loaded from the DB so admins can update rates without a code deploy.
function calculateAPIT(taxableIncome: number, bands: any[]): number {
    const sorted = [...bands].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    for (const band of sorted) {
        const max = band.max_income !== null ? Number(band.max_income) : Infinity;
        if (taxableIncome >= Number(band.min_income) && taxableIncome <= max) {
            return Math.max(0, taxableIncome * Number(band.rate) - Number(band.deduction));
        }
    }
    return 0;
}

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;
    if (!verifiedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month'); // YYYY-MM
    const overrideStart = searchParams.get('periodStart'); // explicit override YYYY-MM-DD
    const overrideEnd = searchParams.get('periodEnd');     // explicit override YYYY-MM-DD

    if (!userId || !month) {
        return NextResponse.json({ error: 'userId and month are required' }, { status: 400 });
    }

    const [year, mon] = month.split('-').map(Number);

    try {
        // ── 0. Pay period window ────────────────────────────────────────────────
        let monthStart: string;
        let monthEnd: string;

        if (overrideStart && overrideEnd) {
            // Caller (payroll run UI) has specified exact dates for this month
            monthStart = overrideStart;
            monthEnd = overrideEnd;
        } else {
            // Fall back to global config
            const { data: periodSetting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'payroll_period_config')
                .maybeSingle();
            const periodStartDay: number = (periodSetting?.value as any)?.period_start_day ?? 1;

            if (periodStartDay <= 1) {
                monthStart = `${year}-${String(mon).padStart(2, '0')}-01`;
                const lastDay = new Date(year, mon, 0).getDate();
                monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            } else {
                const prevMon = mon === 1 ? 12 : mon - 1;
                const prevYear = mon === 1 ? year - 1 : year;
                const prevLastDay = new Date(prevYear, prevMon, 0).getDate();
                const clampedStart = Math.min(periodStartDay, prevLastDay);
                monthStart = `${prevYear}-${String(prevMon).padStart(2, '0')}-${String(clampedStart).padStart(2, '0')}`;
                const endDay = Math.min(periodStartDay - 1, new Date(year, mon, 0).getDate());
                monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
            }
        }

        // ── 1. Parallel data fetch ──────────────────────────────────────────────
        const [
            { data: salaryData },
            { data: userRecord },
            { data: allApprovedLeaves },
            { data: userOverrides },
            { data: attendanceRecords },
            { data: approvedOtRequests },
            { data: otSettingsData },
        ] = await Promise.all([
            supabase.from('salary_details').select('*').eq('user_id', userId).maybeSingle(),
            supabase.from('users')
                .select('leave_scheme_id, join_date, working_calendar_id')
                .eq('id', userId).maybeSingle(),
            supabase
                .from('leave_requests')
                .select('leave_type_id, start_date, end_date, days_count')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .lte('start_date', monthEnd)
                .gte('end_date', monthStart),
            supabase
                .from('user_calendar_overrides')
                .select('date, day_type, action')
                .eq('user_id', userId)
                .gte('date', monthStart)
                .lte('date', monthEnd),
            supabase
                .from('attendance')
                .select('date, status')
                .eq('user_id', userId)
                .gte('date', monthStart)
                .lte('date', monthEnd),
            // Approved OT for this employee in this month
            supabase
                .from('ot_requests')
                .select('ot_hours, date')
                .eq('user_id', userId)
                .eq('status', 'approved')
                .eq('payroll_month', month),
            supabase.from('ot_settings').select('*').limit(1).maybeSingle(),
        ]);

        // ── 2. APIT bands from DB ───────────────────────────────────────────────
        const { data: apitBands } = await supabase
            .from('apit_tax_bands')
            .select('*')
            .order('sort_order');
        const bands = apitBands ?? [];

        // ── 4. Assigned calendar entries ────────────────────────────────────────
        let calendarEntries: Array<{ date: string; day_type: string }> = [];
        if (userRecord?.working_calendar_id) {
            const { data } = await supabase
                .from('working_calendar_entries')
                .select('date, day_type')
                .eq('calendar_id', userRecord.working_calendar_id)
                .gte('date', monthStart)
                .lte('date', monthEnd);
            calendarEntries = data ?? [];
        }

        // ── 5. No-pay leave type IDs ────────────────────────────────────────────
        const nopayTypeIds = new Set<string>();
        if (userRecord?.leave_scheme_id) {
            const { data: schemeTypes } = await supabase
                .from('leave_scheme_types')
                .select('id, name')
                .eq('scheme_id', userRecord.leave_scheme_id);
            (schemeTypes ?? []).forEach((t: any) => {
                if (isNopayName(t.name ?? '')) nopayTypeIds.add(t.id);
            });
        }

        // ── 4. Build helper structures ──────────────────────────────────────────
        const dayValue = buildDayValueFn(calendarEntries, userOverrides ?? []);

        // Attendance map: date → status
        const attendanceMap = new Map<string, string>();
        for (const a of (attendanceRecords ?? [])) {
            attendanceMap.set(a.date.slice(0, 10), a.status);
        }

        const basic = salaryData?.basic_salary ?? 0;
        const allowances = salaryData?.fixed_allowances ?? 0;
        const allowancesJson = salaryData?.allowances_json ?? [];

        // ── 5. Working days in full month ───────────────────────────────────────
        const workingDays = countWorkingDays(monthStart, monthEnd, dayValue);

        // ── 6. Join-date pro-rating ─────────────────────────────────────────────
        const joinDate: string | null = userRecord?.join_date
            ? userRecord.join_date.slice(0, 10)
            : null;
        const isProrated = !!(joinDate && joinDate > monthStart && joinDate <= monthEnd);
        const effectiveStart = isProrated ? joinDate! : monthStart;
        const daysWorked = countWorkingDays(effectiveStart, monthEnd, dayValue);
        const perDayRate = workingDays > 0 ? basic / workingDays : 0;
        const joiningDeduction = Math.round((workingDays - daysWorked) * perDayRate * 100) / 100;

        // ── 7. Build paid-leave and no-pay-leave date sets ──────────────────────
        const paidLeaveDates = new Set<string>();
        const nopayLeaveDates = new Set<string>();

        for (const leave of (allApprovedLeaves ?? [])) {
            const isPaid = !nopayTypeIds.has(leave.leave_type_id);
            markLeaveDays(
                leave.start_date.slice(0, 10),
                leave.end_date.slice(0, 10),
                effectiveStart,
                monthEnd,
                dayValue,
                isPaid ? paidLeaveDates : nopayLeaveDates
            );
        }

        // ── 8. Calculate no-pay days ────────────────────────────────────────────
        // For each working day in [effectiveStart, monthEnd]:
        //   - Paid leave day              → no deduction
        //   - No-pay leave day            → deduct full day value
        //   - Attendance present          → no deduction
        //   - Attendance half-day         → deduct 0.5 day
        //   - Attendance absent           → deduct full day
        //   - No record, past day         → treated as absent (deduct full day)
        //   - No record, today/future     → skip (day not yet done)
        const today = new Date().toISOString().slice(0, 10);
        let nopayDays = 0;
        let [y2, m2, d2] = effectiveStart.split('-').map(Number);
        while (true) {
            const ds = `${y2}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
            if (ds > monthEnd) break;

            const dv = dayValue(ds);
            if (dv > 0) {
                if (paidLeaveDates.has(ds)) {
                    // Paid leave — no deduction
                } else if (nopayLeaveDates.has(ds)) {
                    nopayDays += dv;
                } else {
                    const attStatus = attendanceMap.get(ds);
                    if (attStatus === 'present') {
                        // worked — no deduction
                    } else if (attStatus === 'half-day') {
                        nopayDays += dv * 0.5;
                    } else if (attStatus === 'absent' || (!attStatus && ds < today)) {
                        // explicitly absent OR no record for a past working day
                        nopayDays += dv;
                    }
                }
            }

            d2++;
            const dim = new Date(y2, m2, 0).getDate();
            if (d2 > dim) { d2 = 1; m2++; }
            if (m2 > 12) { m2 = 1; y2++; }
        }

        // Round to 2 decimal places (handles half days)
        nopayDays = Math.round(nopayDays * 100) / 100;

        // ── 9. Final figures ────────────────────────────────────────────────────
        const leaveDeduction = Math.round(nopayDays * perDayRate * 100) / 100;
        const totalDeduction = joiningDeduction + leaveDeduction;
        const effectiveBasic = Math.round((basic - totalDeduction) * 100) / 100;
        const epfEmployee = Math.round(effectiveBasic * 0.08 * 100) / 100;
        const epfEmployer = Math.round(effectiveBasic * 0.12 * 100) / 100;
        const etfEmployer = Math.round(effectiveBasic * 0.03 * 100) / 100;
        const grossSalary = basic + allowances;

        // ── 10. OT Calculation ──────────────────────────────────────────────────
        const otSettings = otSettingsData ?? {
            calculation_method: 'multiplier',
            ot_multiplier: 1.5,
            flat_rate_per_hour: 0,
            standard_hours_per_day: 8,
        };
        const totalOtHours = (approvedOtRequests ?? []).reduce((s: number, r: any) => s + Number(r.ot_hours), 0);
        let otPay = 0;
        if (totalOtHours > 0) {
            if (otSettings.calculation_method === 'flat_rate') {
                otPay = Number(otSettings.flat_rate_per_hour) * totalOtHours;
            } else {
                const hoursPerDay = Number(otSettings.standard_hours_per_day) || 8;
                const hourlyRate = workingDays > 0 ? effectiveBasic / workingDays / hoursPerDay : 0;
                otPay = hourlyRate * Number(otSettings.ot_multiplier) * totalOtHours;
            }
        }
        otPay = Math.round(otPay * 100) / 100;

        // ── 11. APIT (OT is taxable employment income) ──────────────────────────
        const taxableIncome = Math.round((effectiveBasic + allowances + otPay - epfEmployee) * 100) / 100;
        const apitTax = Math.round(Math.max(0, calculateAPIT(taxableIncome, bands)) * 100) / 100;

        const netSalary = Math.round((grossSalary + otPay - epfEmployee - totalDeduction - apitTax) * 100) / 100;

        return NextResponse.json({
            calculation: {
                user_id: userId,
                month,
                period_start: monthStart,
                period_end: monthEnd,
                basic_salary: basic,
                allowances,
                allowances_json: allowancesJson,
                working_days: workingDays,
                per_day_rate: Math.round(perDayRate * 100) / 100,
                is_prorated: isProrated,
                join_date: joinDate,
                days_worked: daysWorked,
                joining_deduction: joiningDeduction,
                nopay_days: nopayDays,
                leave_deduction: leaveDeduction,
                total_deduction: totalDeduction,
                effective_basic: effectiveBasic,
                gross_salary: grossSalary,
                ot_hours: totalOtHours,
                ot_pay: otPay,
                epf_employee_8: epfEmployee,
                epf_employer_12: epfEmployer,
                etf_employer_3: etfEmployer,
                taxable_income: taxableIncome,
                apit_tax: apitTax,
                net_salary: netSalary,
            },
        });
    } catch (error: any) {
        console.error('Error calculating salary:', error);
        return NextResponse.json({ error: error.message ?? 'Calculation failed' }, { status: 500 });
    }
}
