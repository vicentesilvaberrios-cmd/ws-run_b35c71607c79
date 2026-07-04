import { formatTime, formatDate } from '@/lib/format';

interface ConfirmationEmailParams {
  to: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  confirmUrl?: string;
}

export async function sendConfirmationEmail({
  to,
  businessName,
  serviceName,
  startsAt,
  confirmUrl,
}: ConfirmationEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada; no se envía email de confirmación.');
    return;
  }

  const time = formatTime(startsAt);
  const date = formatDate(startsAt.slice(0, 10));

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Confirmación de reserva</h2>
      <p>Tu reserva en <strong>${businessName}</strong> ha sido confirmada.</p>
      <ul>
        <li><strong>Servicio:</strong> ${serviceName}</li>
        <li><strong>Fecha:</strong> ${date}</li>
        <li><strong>Hora:</strong> ${time}</li>
      </ul>
      ${confirmUrl ? `<p style="margin-top:16px"><a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Confirma o cancela tu cita aquí</a></p>` : ''}
      <p>¡Te esperamos!</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'Confirmaciones <no-reply@resend.dev>',
        to,
        subject: `Confirmación de reserva - ${businessName}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[email] Resend respondió ${res.status}: ${text}`);
    }
  } catch (err) {
    console.warn('[email] Error al enviar email de confirmación:', err);
  }
}

interface ReminderEmailParams {
  to: string;
  businessName: string;
  serviceName: string;
  startsAt: string;
  confirmUrl?: string;
}

export async function sendReminderEmail({
  to,
  businessName,
  serviceName,
  startsAt,
  confirmUrl,
}: ReminderEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada; no se envía email de recordatorio.');
    return;
  }

  const time = formatTime(startsAt);
  const date = formatDate(startsAt.slice(0, 10));

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Recordatorio de tu cita</h2>
      <p>Te recordamos tu próxima cita en <strong>${businessName}</strong>.</p>
      <ul>
        <li><strong>Servicio:</strong> ${serviceName}</li>
        <li><strong>Fecha:</strong> ${date}</li>
        <li><strong>Hora:</strong> ${time}</li>
      </ul>
      ${confirmUrl ? `<p style="margin-top:16px"><a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Confirma o cancela tu cita aquí</a></p>` : ''}
      <p>¡Te esperamos!</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'Recordatorios <no-reply@resend.dev>',
        to,
        subject: `Recordatorio de cita - ${businessName}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[email] Resend respondió ${res.status}: ${text}`);
    }
  } catch (err) {
    console.warn('[email] Error al enviar email de recordatorio:', err);
  }
}
