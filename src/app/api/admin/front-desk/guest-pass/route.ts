import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
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
