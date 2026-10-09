import nodemailer from 'nodemailer';

type CheckInEmail = {
    to: string;
    guestName: string;
    bookingRef: string;
    roomNumber: string;
    qrCode: Buffer;
};

export async function sendCheckInEmail(details: CheckInEmail) {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD;
    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || user;
    const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
    const port = Number(process.env.SMTP_PORT || (process.env.GMAIL_USER ? 465 : 587));
    const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : Boolean(process.env.GMAIL_USER);

    if (!host || !user || !pass || !from) {
        return { sent: false, reason: 'SMTP is not configured' };
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    const guestName = escapeHtml(details.guestName);
    const bookingRef = escapeHtml(details.bookingRef);
    const roomNumber = escapeHtml(details.roomNumber);

    await transporter.sendMail({
        from,
        replyTo: process.env.BOOKING_ADMIN_EMAIL || from,
        to: details.to,
        subject: `Welcome to Oruthota Chalets - ${details.bookingRef}`,
        text: [
            `Dear ${details.guestName},`,
            '',
            'Welcome to Oruthota Chalets. Your check-in is complete.',
            `Booking number: ${details.bookingRef}`,
            `Assigned room: ${details.roomNumber}`,
            '',
            'Your QR code is attached to this email. Please keep it with you during your stay.',
            '',
            'We wish you a relaxing and memorable stay.',
            'Oruthota Chalets'
        ].join('\n'),
        html: `
            <!doctype html>
            <html>
            <body style="margin:0;padding:0;background:#f4f7f1;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f1;padding:28px 12px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe7d2;box-shadow:0 12px 30px rgba(22,101,52,0.12);">
                                <tr>
                                    <td style="background:#166534;padding:30px 32px;color:#ffffff;">
                                        <p style="margin:0 0 8px;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#d9f99d;">Check-in Confirmed</p>
                                        <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:700;">Welcome to Oruthota Chalets</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:30px 32px 12px;">
                                        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Dear <strong>${guestName}</strong>,</p>
                                        <p style="margin:0;font-size:16px;line-height:1.7;">We are delighted to welcome you. Your check-in is complete, and your stay details are ready below.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:18px 32px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5eadf;border-radius:14px;background:#fbfdf8;">
                                            <tr>
                                                <td style="padding:18px;border-bottom:1px solid #e5eadf;">
                                                    <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Booking Number</p>
                                                    <p style="margin:0;font-size:22px;font-weight:700;color:#166534;">${bookingRef}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:18px;">
                                                    <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Assigned Room</p>
                                                    <p style="margin:0;font-size:20px;font-weight:700;color:#1f2937;">${roomNumber}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding:12px 32px 24px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #dbe7d2;border-radius:18px;padding:18px;">
                                            <tr>
                                                <td align="center">
                                                    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#166534;">Your Guest QR Code</p>
                                                    <img src="cid:check-in-qr" width="230" height="230" alt="Booking QR code" style="display:block;border:0;width:230px;height:230px;">
                                                    <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">Please keep this QR code with you during your stay.</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:0 32px 30px;">
                                        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">If you need any assistance, simply reply to this email and our team will be happy to help.</p>
                                        <p style="margin:0;font-size:15px;line-height:1.7;">We wish you a relaxing and memorable stay.</p>
                                        <p style="margin:18px 0 0;font-size:16px;font-weight:700;color:#166534;">Oruthota Chalets</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background:#eef6e8;padding:16px 32px;text-align:center;">
                                        <p style="margin:0;font-size:12px;line-height:1.5;color:#647056;">This QR code contains your booking number and is intended for guest identification during your stay.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`,
        attachments: [{ filename: `${details.bookingRef}.png`, content: details.qrCode, cid: 'check-in-qr' }]
    });

    return { sent: true };
}

function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character] || character);
}
