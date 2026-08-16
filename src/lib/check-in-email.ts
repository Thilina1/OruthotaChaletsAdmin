import nodemailer from 'nodemailer';

type CheckInEmail = {
    to: string;
    guestName: string;
    bookingRef: string;
    roomNumber: string;
    qrCode: Buffer;
};

export async function sendCheckInEmail(details: CheckInEmail) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass || !from) {
        return { sent: false, reason: 'SMTP is not configured' };
    }

    const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass }
    });

    await transporter.sendMail({
        from,
        to: details.to,
        subject: `Oruthota Chalets check-in – ${details.bookingRef}`,
        text: `Welcome ${details.guestName}. Booking number: ${details.bookingRef}. Assigned room: ${details.roomNumber}.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
                <h2 style="color:#166534">Welcome to Oruthota Chalets</h2>
                <p>Hello ${escapeHtml(details.guestName)}, your check-in is complete.</p>
                <p><strong>Booking number:</strong> ${escapeHtml(details.bookingRef)}<br>
                <strong>Assigned room:</strong> ${escapeHtml(details.roomNumber)}</p>
                <p>Please keep this QR code with you during your stay.</p>
                <img src="cid:check-in-qr" width="220" height="220" alt="Booking QR code">
                <p style="font-size:12px;color:#6b7280">The QR code contains your booking number.</p>
            </div>`,
        attachments: [{ filename: `${details.bookingRef}.png`, content: details.qrCode, cid: 'check-in-qr' }]
    });

    return { sent: true };
}

function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character] || character);
}
