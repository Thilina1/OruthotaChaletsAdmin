import { NextResponse } from 'next/server';

// Google's public iCal feed for Sri Lanka — no API key required
const LK_ICAL_URL =
    'https://calendar.google.com/calendar/ical/en.lk%23holiday%40group.v.calendar.google.com/public/basic.ics';

// Keyword safety-net: catches mercantile holidays regardless of CATEGORIES field
const MERCANTILE_KEYWORDS = [
    'poya',          // all 12 poya (full-moon) days are mercantile in Sri Lanka
    'new year',      // Sinhala & Tamil New Year (Apr 13–14)
    'independence',  // Independence Day (Feb 4)
    'may day',
    'labour day',
    'christmas',
    'deepavali',
    'diwali',
    'eid',           // Eid al-Fitr, Eid al-Adha
    'milad',         // Milad-un-Nabi
    'good friday',
    'thai pongal',
    'sivarathri',
    'prophet',
];

function isMercantile(title: string, categories: string): boolean {
    // Primary: trust the CATEGORIES field when present
    if (categories) {
        const cats = categories.toLowerCase();
        if (cats.includes('public holiday')) return true;
        if (cats.includes('observance')) return false;
    }
    // Fallback: keyword match
    const lower = title.toLowerCase();
    return MERCANTILE_KEYWORDS.some(kw => lower.includes(kw));
}

function parseICS(raw: string, year: number) {
    // Unfold continuation lines (ICS wraps long lines with a leading space/tab)
    const ics = raw.replace(/\r?\n[ \t]/g, '');

    const holidays: Array<{ date: string; title: string; day_type: 'holiday' }> = [];
    const blocks = ics.split('BEGIN:VEVENT').slice(1);

    for (const block of blocks) {
        const dateMatch = block.match(/DTSTART(?:;[^:\r\n]*)?:(\d{8})/);
        const summaryMatch = block.match(/SUMMARY:([^\r\n]+)/);
        if (!dateMatch || !summaryMatch) continue;

        const raw = dateMatch[1]; // YYYYMMDD
        const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        if (!date.startsWith(String(year))) continue;

        const title = summaryMatch[1]
            .trim()
            .replace(/\\n/g, ' ')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';');

        const catMatch = block.match(/CATEGORIES:([^\r\n]+)/);
        const categories = catMatch ? catMatch[1].trim() : '';

        if (isMercantile(title, categories)) {
            holidays.push({ date, title, day_type: 'holiday' });
        }
    }

    // Deduplicate by date — keep the first matching entry per date
    const seen = new Set<string>();
    const unique = holidays.filter(h => {
        if (seen.has(h.date)) return false;
        seen.add(h.date);
        return true;
    });

    return unique.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ?? String(new Date().getFullYear());

    try {
        const res = await fetch(LK_ICAL_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Google Calendar returned ${res.status}`);

        const ics = await res.text();
        const holidays = parseICS(ics, Number(year));

        return NextResponse.json({ holidays });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
