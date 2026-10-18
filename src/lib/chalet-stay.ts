// Stay hours and maintenance overlap. A stay runs from the standard check-in
// time on the arrival day to the standard check-out time on the departure
// day (app setting 'chalet_stay_times'). A maintenance block runs from its
// start date/time to its end date/time. They clash only if those overlap.

export type StayTimes = { check_in: string; check_out: string };
export const DEFAULT_STAY_TIMES: StayTimes = { check_in: '14:00', check_out: '11:00' };

export type MaintenanceBlock = {
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
};

// "9:5", "09:05:00" → "09:05"
export function hhmm(value: string | null | undefined, fallback: string) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return fallback;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

// "14:00" → "2:00 PM"
export function formatClock(value: string | null | undefined) {
    const [hours, minutes] = hhmm(value, '00:00').split(':').map(Number);
    return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function stayWindow(checkIn: string, checkOut: string, times: StayTimes = DEFAULT_STAY_TIMES) {
    return {
        start: `${checkIn}T${hhmm(times.check_in, DEFAULT_STAY_TIMES.check_in)}`,
        end: `${checkOut}T${hhmm(times.check_out, DEFAULT_STAY_TIMES.check_out)}`,
    };
}

export function blockWindow(block: MaintenanceBlock) {
    return {
        start: `${block.start_date}T${hhmm(block.start_time, '00:00')}`,
        end: `${block.end_date}T${hhmm(block.end_time, '23:59')}`,
    };
}

// True when the maintenance hours overlap the guest's stay hours.
export function blockOverlapsStay(block: MaintenanceBlock, checkIn: string, checkOut: string, times: StayTimes = DEFAULT_STAY_TIMES) {
    if (!checkIn || !checkOut) return false;
    const stay = stayWindow(checkIn, checkOut, times);
    const window = blockWindow(block);
    return window.start < stay.end && window.end > stay.start;
}

// e.g. "15 Oct 9:00 AM – 15 Oct 1:00 PM" (or dates only for whole days)
export function describeBlock(block: MaintenanceBlock, formatDate: (date: string) => string = date => date) {
    const start = hhmm(block.start_time, '00:00');
    const end = hhmm(block.end_time, '23:59');
    const wholeDays = start === '00:00' && end === '23:59';
    if (wholeDays) {
        return block.start_date === block.end_date ? formatDate(block.start_date) : `${formatDate(block.start_date)} – ${formatDate(block.end_date)}`;
    }
    return `${formatDate(block.start_date)} ${formatClock(start)} – ${formatDate(block.end_date)} ${formatClock(end)}`;
}

export async function loadStayTimes(client: any): Promise<StayTimes> {
    const { data } = await client.from('app_settings').select('value').eq('key', 'chalet_stay_times').maybeSingle();
    const value = data?.value && typeof data.value === 'object' ? data.value : {};
    return { ...DEFAULT_STAY_TIMES, ...value };
}
