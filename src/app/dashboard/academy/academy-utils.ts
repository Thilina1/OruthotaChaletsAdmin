export function progressStorageKey(userId: string) {
  return `oruthota-academy:v2:${userId}:completed`;
}

export function parseProgress(raw: string | null, lessonIds: readonly string[]): string[] {
  try {
    const value: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(value)) return [];
    const validIds = new Set(lessonIds);
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && validIds.has(id)))];
  } catch {
    return [];
  }
}

export function keepReferencePage(screenMatches: boolean, controlCount: number, kind: string) {
  // A type filter must not retain empty screens just because the query is empty.
  return controlCount > 0 || (kind === 'all' && screenMatches);
}

export function readableScreenTitle(title: string): string {
  return title.replace(/\[.*?\]/g, 'Details').replace(/-/g, ' ').split(' / ').map(part =>
    part.split(' ').map(word => /^(hrms|grn|po|mrn|ot|apit|pos)$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  ).join(' · ');
}

export function referenceDepartment(route: string): string {
  const section = route.split('/')[2] || '';
  if (section === 'hrms') return 'Staff & Payroll';
  if (section === 'kitchen') return 'Kitchen';
  if (section.startsWith('inventory')) return 'Inventory';
  if (section === 'event-management') return 'Events';
  if (section === 'chalet' || ['bookings', 'reservations', 'room-management', 'front-desk', 'customers', 'inquiries', 'experience-inquiries'].includes(section)) return 'Reception & Bookings';
  if (section === 'services') return 'Services';
  if (['accounting', 'expenses', 'other-incomes', 'reports'].includes(section)) return 'Accounting';
  if (section === 'purchase-orders') return 'Purchasing';
  if (['', 'restaurant-analytics', 'restaurant-account', 'restaurant-settings', 'billing', 'pos', 'tables', 'table-management', 'menu-management', 'menu-settings', 'orders', 'buffet-packages', 'buffet-bookings', 'loyalty', 'loyalty-discounts'].includes(section)) return 'Restaurant';
  if (['blogs', 'activities', 'experiences'].includes(section)) return 'Website Content';
  return 'Profile & Settings';
}
