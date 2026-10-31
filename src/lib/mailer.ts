import nodemailer from 'nodemailer';

// Outbound mail settings from the environment: Gmail (app password) first,
// then a generic SMTP server. Returns null when mail is not configured.
export function getMailTransport() {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD;
    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || user;
    const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
    const port = Number(process.env.SMTP_PORT || (process.env.GMAIL_USER ? 465 : 587));
    const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : Boolean(process.env.GMAIL_USER);

    if (!host || !user || !pass || !from) return null;

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    return { transporter, from, replyTo: process.env.BOOKING_ADMIN_EMAIL || from };
}

export function isValidEmail(value?: string | null) {
    return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character] || character);
}
