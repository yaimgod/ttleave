import type { NotificationPayload, NotificationProvider } from "./types";

function buildSubject(payload: NotificationPayload): string {
  switch (payload.type) {
    case "date_change":
      return `📅 Date changed: ${payload.eventTitle} — ${payload.groupName}`;
    case "comment":
      return `💬 New comment on ${payload.eventTitle} — ${payload.groupName}`;
    case "member_join":
      return `👋 ${payload.actor.name} joined ${payload.groupName}`;
  }
}

function buildHtml(payload: NotificationPayload): string {
  const eventLink = payload.eventId
    ? `<p><a href="${payload.appUrl}/events/${payload.eventId}">View event →</a></p>`
    : "";

  switch (payload.type) {
    case "date_change":
      return `
        <h2>Date changed for <strong>${payload.eventTitle}</strong></h2>
        <p><strong>${payload.actor.name}</strong> changed the target date in <strong>${payload.groupName}</strong>.</p>
        ${payload.oldDate ? `<p>From: ${payload.oldDate}</p>` : ""}
        ${payload.newDate ? `<p>To: ${payload.newDate}</p>` : ""}
        ${eventLink}
      `.trim();
    case "comment":
      return `
        <h2>New comment on <strong>${payload.eventTitle}</strong></h2>
        <p><strong>${payload.actor.name}</strong> commented in <strong>${payload.groupName}</strong>:</p>
        <blockquote>${payload.commentText ?? ""}</blockquote>
        ${eventLink}
      `.trim();
    case "member_join":
      return `
        <h2>New member in <strong>${payload.groupName}</strong></h2>
        <p><strong>${payload.actor.name}</strong> joined the group.</p>
        <p><a href="${payload.appUrl}/groups">View groups →</a></p>
      `.trim();
  }
}

export class EmailProvider implements NotificationProvider {
  channel = "email" as const;

  isConfigured(): boolean {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
    );
  }

  async send(to: string, payload: NotificationPayload): Promise<void> {
    if (!this.isConfigured()) return;

    // Dynamic import so nodemailer only loads when actually needed (server-side only)
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: buildSubject(payload),
      html: buildHtml(payload),
    });
  }
}
