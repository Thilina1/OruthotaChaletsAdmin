// Per-room guest details the website writes into a chalet booking's special
// requests, e.g.
//   Room 2: Superior Duplex King / Room Only
//   Bedding: 1 King
//   Adults: 3
//   Children: 2
//   Child ages: 2, 1
//   Estimated arrival time: 02:00 pm
export type ChaletRoomTextDetails = {
    roomNumber: string;
    roomType: string;
    packageName: string;
    bedding: string;
    adults: string;
    children: string;
    childAges: string;
    arrivalTime: string;
    useForAllRooms: boolean;
};

// Lines after the last room that apply to the whole booking, not to a room.
const BOOKING_LEVEL_LINE = /(?:^|\s)(?:Booking for someone else\.|Payment option:)/i;

export function parseRoomTextDetails(text?: string | null): ChaletRoomTextDetails[] {
    if (!text) return [];
    const bookingLevelIndex = text.search(BOOKING_LEVEL_LINE);
    const roomsText = bookingLevelIndex >= 0 ? text.slice(0, bookingLevelIndex) : text;
    const roomChunks = roomsText.match(/Room\s+\d+:[\s\S]*?(?=Room\s+\d+:|$)/gi) || [];
    return roomChunks.map(chunk => {
        const headerMatch = chunk.match(/Room\s+(\d+):\s*([\s\S]*?)(?=\s+Bedding:|\s+Adults:|\s+Children:|$)/i);
        const [roomType, packageName] = (headerMatch?.[2] || '').split('/').map(value => value.trim());
        return {
            roomNumber: headerMatch?.[1] || '',
            roomType: roomType || '',
            packageName: packageName || '',
            bedding: chunk.match(/Bedding:\s*([\s\S]*?)(?=\s+Adults:|\s+Children:|\s+Child ages:|\s+Estimated arrival time:|\s+Use these guest details|$)/i)?.[1]?.trim() || '',
            adults: chunk.match(/Adults:\s*(\d+)/i)?.[1] || '',
            children: chunk.match(/Children:\s*(\d+)/i)?.[1] || '',
            childAges: chunk.match(/Child ages:\s*([\s\S]*?)(?=\s+Estimated arrival time:|\s+Use these guest details|$)/i)?.[1]?.trim() || '',
            arrivalTime: chunk.match(/Estimated arrival time:\s*([\s\S]*?)(?=\s+Special request:|\s+Use these guest details|$)/i)?.[1]?.trim() || '',
            useForAllRooms: /Use these guest details for all rooms/i.test(chunk),
        };
    });
}

// Details for the room at this position (0 = "Room 1"). A single entry marked
// "Use these guest details for all rooms" applies to every room.
export function roomTextDetailsAt(details: ChaletRoomTextDetails[], index: number) {
    const byNumber = details.find(detail => Number(detail.roomNumber) === index + 1);
    if (byNumber) return byNumber;
    return details.length === 1 && details[0].useForAllRooms ? details[0] : undefined;
}

// Payment option the guest chose on the website ("Half payment" / "Full payment").
// It applies to the whole booking.
export function parseBookingPaymentOption(text?: string | null) {
    return text?.match(/Payment option:\s*(Half payment|Full payment)/i)?.[1] || '';
}
