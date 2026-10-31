import { escapeHtml, getMailTransport, isValidEmail } from '@/lib/mailer';
import { buffetInvoiceLines, buffetInvoiceNumber, formatBookingDate, formatLkr } from '@/lib/buffet-invoice';
import { PROPERTY_INFO } from '@/lib/property-info';
import type { TableBooking } from '@/lib/types';

// Emails the buffet booking invoice to the customer. Never throws: the
// caller reports the result but the booking itself is already saved.
export async function sendBuffetBookingEmail(booking: TableBooking): Promise<{ sent: boolean; reason?: string }> {
    if (!isValidEmail(booking.email)) return { sent: false, reason: 'Email address is not valid' };

    const mail = getMailTransport();
    if (!mail) return { sent: false, reason: 'SMTP is not configured' };

    const invoiceNo = buffetInvoiceNumber(booking);
    const { lines, guests, meal, total } = buffetInvoiceLines(booking);
    const date = formatBookingDate(booking.date);
    const name = escapeHtml(booking.name);
    const status = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);

    const lineRows = lines.map(line => `
        <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5eadf;font-size:14px;">
                <strong>${escapeHtml(line.description)}</strong>
                ${line.quantity ? `<br><span style="font-size:12px;color:#6b7280;">${escapeHtml(line.detail || '')} · ${line.quantity} × ${formatLkr(line.rate || 0)}</span>` : ''}
            </td>
            <td align="right" style="padding:10px 0;border-bottom:1px solid #e5eadf;font-size:14px;white-space:nowrap;">${formatLkr(line.amount)}</td>
        </tr>`).join('');

    const chargesBlock = lines.length > 0 ? `
        <tr>
            <td style="padding:8px 32px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding:8px 0;border-bottom:2px solid #1f2937;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Description</td>
                        <td align="right" style="padding:8px 0;border-bottom:2px solid #1f2937;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Amount</td>
                    </tr>
                    ${lineRows}
                    <tr>
                        <td style="padding:14px 0;font-size:16px;font-weight:700;color:#166534;">Total</td>
                        <td align="right" style="padding:14px 0;font-size:18px;font-weight:700;color:#166534;white-space:nowrap;">${formatLkr(total)}</td>
                    </tr>
                </table>
            </td>
        </tr>` : `
        <tr>
            <td style="padding:8px 32px 0;font-size:14px;line-height:1.7;color:#4b5563;">Our team will confirm the buffet package and charges with you shortly.</td>
        </tr>`;

    const detail = (label: string, value: string) => `
        <td width="50%" style="padding:12px 16px;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">${label}</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#1f2937;">${value}</p>
        </td>`;

    try {
        await mail.transporter.sendMail({
            from: mail.from,
            replyTo: mail.replyTo,
            to: booking.email.trim(),
            subject: `Your buffet booking at ${PROPERTY_INFO.name} - ${invoiceNo}`,
            text: [
                `Dear ${booking.name},`,
                '',
                `Thank you for your buffet booking at ${PROPERTY_INFO.name}.`,
                `Invoice no: ${invoiceNo}`,
                `Date: ${date}`,
                `Meal: ${meal}`,
                `Guests: ${guests}`,
                `Status: ${status}`,
                ...lines.map(line => `${line.description}: ${formatLkr(line.amount)}`),
                ...(lines.length > 0 ? [`Total: ${formatLkr(total)}`] : []),
                '',
                `Questions? Call ${PROPERTY_INFO.phones[0]} or reply to this email.`,
                PROPERTY_INFO.name,
            ].join('\n'),
            html: `
            <!doctype html>
            <html>
            <body style="margin:0;padding:0;background:#f4f7f1;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f1;padding:28px 12px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe7d2;">
                                <tr>
                                    <td style="background:#166534;padding:28px 32px;color:#ffffff;">
                                        <p style="margin:0 0 8px;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#d9f99d;">Buffet Booking · ${escapeHtml(status)}</p>
                                        <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:700;">${PROPERTY_INFO.name}</h1>
                                        <p style="margin:8px 0 0;font-size:13px;color:#dcfce7;">Invoice ${invoiceNo}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:28px 32px 8px;">
                                        <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">Dear <strong>${name}</strong>,</p>
                                        <p style="margin:0;font-size:15px;line-height:1.7;">Thank you for choosing ${PROPERTY_INFO.name}. Here are the details of your buffet booking.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:16px 32px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5eadf;border-radius:14px;background:#fbfdf8;">
                                            <tr>${detail('Date', escapeHtml(date))}${detail('Meal', escapeHtml(meal))}</tr>
                                            <tr>${detail('Guests', String(guests))}${detail('Package', escapeHtml(booking.buffet_packages?.name || 'To be confirmed'))}</tr>
                                        </table>
                                    </td>
                                </tr>
                                ${chargesBlock}
                                <tr>
                                    <td style="padding:20px 32px 28px;">
                                        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#4b5563;">If anything needs to change, reply to this email or call us on ${PROPERTY_INFO.phones.join(' / ')}.</p>
                                        <p style="margin:0;font-size:16px;font-weight:700;color:#166534;">${PROPERTY_INFO.name}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background:#eef6e8;padding:16px 32px;text-align:center;">
                                        <p style="margin:0;font-size:12px;line-height:1.5;color:#647056;">${PROPERTY_INFO.address} · ${PROPERTY_INFO.email} · ${PROPERTY_INFO.website}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`,
        });
        return { sent: true };
    } catch (error: any) {
        console.error('Buffet booking email failed:', error);
        return { sent: false, reason: error?.message || 'Email could not be sent' };
    }
}
