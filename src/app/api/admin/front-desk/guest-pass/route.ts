import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

type InHouseGuest = {
  key: string;
  room: string;
  guest_name: string;
  phone: string | null;
  customer: { id: string; name: string; phone?: string | null; current_room: string } | null;
};

// Checked-in guests, one entry per room (hotel reservations and chalet
// bookings), so a guest can be attached to an order by room number.
async function inHouseGuests(): Promise<InHouseGuest[]> {
  const [reservationsRes, chaletRes] = await Promise.all([
    supabase.from('reservations').select('id, customer_id, guest_name, room:rooms(room_number,title)').eq('status', 'checked-in'),
    supabase.from('chalet_bookings').select('id, customer_name, customer_phone, customer_nic, room_id, room_ids, room_allocations').eq('status', 'checked_in'),
  ]);
  if (reservationsRes.error) throw reservationsRes.error;
  if (chaletRes.error) throw chaletRes.error;
  const reservations = reservationsRes.data || [];
  const chaletBookings = chaletRes.data || [];

  const customerIds = reservations.map((r: any) => r.customer_id).filter(Boolean);
  const { data: customersById } = customerIds.length
    ? await supabase.from('customers').select('id, name, phone').in('id', customerIds)
    : { data: [] as any[] };
  const byId = new Map((customersById || []).map((c: any) => [c.id, c]));

  // Chalet bookings don't store a customer id: match by ID number, then name.
  const nics = chaletBookings.map((b: any) => b.customer_nic?.trim()).filter(Boolean);
  const { data: customersByNic } = nics.length
    ? await supabase.from('customers').select('id, name, phone, id_number').in('id_number', nics)
    : { data: [] as any[] };
  const findChaletCustomer = async (booking: any) => {
    const nic = booking.customer_nic?.trim();
    const viaNic = nic ? (customersByNic || []).find((c: any) => c.id_number === nic) : null;
    if (viaNic) return viaNic;
    const name = String(booking.customer_name || '').trim();
    if (!name) return null;
    const { data } = await supabase.from('customers').select('id, name, phone').ilike('name', name).limit(1).maybeSingle();
    return data;
  };

  const chaletRoomIds = (booking: any): string[] => {
    const fromAllocations = Array.isArray(booking.room_allocations)
      ? booking.room_allocations.map((a: any) => a?.roomId ?? a?.room_id).filter(Boolean)
      : [];
    const ids = [...fromAllocations, ...(Array.isArray(booking.room_ids) ? booking.room_ids : []), booking.room_id].filter(Boolean);
    return Array.from(new Set(ids));
  };
  const allChaletRoomIds = Array.from(new Set(chaletBookings.flatMap(chaletRoomIds)));
  const { data: chaletRooms } = allChaletRoomIds.length
    ? await supabase.from('chalet_rooms').select('id, room_number').in('id', allChaletRoomIds)
    : { data: [] as any[] };
  const chaletRoomNumber = new Map((chaletRooms || []).map((r: any) => [r.id, r.room_number]));

  const guests: InHouseGuest[] = [];
  for (const reservation of reservations as any[]) {
    const room = Array.isArray(reservation.room) ? reservation.room[0] : reservation.room;
    const roomLabel = room?.room_number || room?.title || 'Room';
    const customer = reservation.customer_id ? byId.get(reservation.customer_id) : null;
    guests.push({
      key: `res-${reservation.id}`,
      room: String(roomLabel),
      guest_name: customer?.name || reservation.guest_name || 'Guest',
      phone: customer?.phone || null,
      customer: customer ? { ...customer, current_room: String(roomLabel) } : null,
    });
  }
  for (const booking of chaletBookings as any[]) {
    const customer = await findChaletCustomer(booking);
    const roomIds = chaletRoomIds(booking);
    const labels = roomIds.length
      ? roomIds.map(id => chaletRoomNumber.get(id)).filter(Boolean).map(n => `Chalet ${n}`)
      : [];
    (labels.length ? labels : ['Chalet (unassigned)']).forEach((label, index) => {
      guests.push({
        key: `chalet-${booking.id}-${index}`,
        room: label,
        guest_name: customer?.name || booking.customer_name || 'Guest',
        phone: customer?.phone || booking.customer_phone || null,
        customer: customer ? { ...customer, phone: customer.phone || booking.customer_phone || null, current_room: label } : null,
      });
    });
  }
  return guests.sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }));
}

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get('in_house') === '1') return NextResponse.json({ guests: await inHouseGuests() });
    const rawCode = searchParams.get('code')?.trim();
    const customerId = searchParams.get('customer_id')?.trim();
    if (!rawCode && !customerId) return NextResponse.json({ error: 'QR code is required' }, { status: 400 });

    if (customerId) {
      const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
      if (!customer) return NextResponse.json({ error: 'Customer was not found' }, { status: 404 });
      const { data: reservation } = await supabase.from('reservations').select('room:rooms(room_number,title)').eq('customer_id', customerId).eq('status', 'checked-in').limit(1).maybeSingle();
      const reservationRoom = Array.isArray(reservation?.room) ? reservation.room[0] : reservation?.room;
      if (reservation) return NextResponse.json({ customer: { ...customer, current_room: reservationRoom?.room_number || reservationRoom?.title || null } });
      const { data: chalet } = await supabase.from('chalet_bookings').select('chalet_rooms(room_number)').ilike('customer_name', customer.name.trim()).eq('status', 'checked_in').limit(1).maybeSingle();
      const chaletRoom = Array.isArray(chalet?.chalet_rooms) ? chalet.chalet_rooms[0] : chalet?.chalet_rooms;
      if (chalet) return NextResponse.json({ customer: { ...customer, current_room: chaletRoom?.room_number ? `Chalet ${chaletRoom.room_number}` : null } });
      return NextResponse.json({ error: 'This customer is no longer checked in' }, { status: 409 });
    }
    const code = rawCode!;

    if (searchParams.get('format') === 'png') {
      const png = await QRCode.toBuffer(code, { width: 320, margin: 2 });
      return new NextResponse(new Uint8Array(png), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' },
      });
    }

    if (code.startsWith('RES:')) {
      const reservationId = code.slice(4);
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('customer_id, guest_name, room:rooms(room_number,title)')
        .eq('id', reservationId)
        .eq('status', 'checked-in')
        .maybeSingle();
      if (error) throw error;
      if (!reservation) return NextResponse.json({ error: 'No checked-in guest matches this QR pass' }, { status: 404 });

      const { data: customer } = reservation.customer_id
        ? await supabase.from('customers').select('*').eq('id', reservation.customer_id).maybeSingle()
        : await supabase.from('customers').select('*').ilike('name', reservation.guest_name.trim()).limit(1).maybeSingle();
      if (!customer) return NextResponse.json({ error: 'The guest customer record was not found' }, { status: 404 });
      const room = Array.isArray(reservation.room) ? reservation.room[0] : reservation.room;
      return NextResponse.json({ customer: { ...customer, current_room: room?.room_number || room?.title || null } });
    }

    const bookingRef = code.startsWith('CHALET:') ? code.slice(8) : code;
    const { data: booking, error } = await supabase
      .from('chalet_bookings')
      .select('customer_name, chalet_rooms(room_number)')
      .eq('booking_ref', bookingRef)
      .eq('status', 'checked_in')
      .maybeSingle();
    if (error) throw error;
    if (!booking) return NextResponse.json({ error: 'No checked-in guest matches this QR pass' }, { status: 404 });

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', booking.customer_name.trim())
      .limit(1)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: 'The guest customer record was not found' }, { status: 404 });
    const chaletRoom = Array.isArray(booking.chalet_rooms) ? booking.chalet_rooms[0] : booking.chalet_rooms;
    return NextResponse.json({ customer: { ...customer, current_room: chaletRoom?.room_number ? `Chalet ${chaletRoom.room_number}` : null } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
