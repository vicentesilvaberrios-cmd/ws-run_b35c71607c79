/**
 * Shared formatting helpers used across UI components.
 */

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZone: 'America/Santiago',
  });
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

/**
 * Normalizes a Chilean phone number to E.164 format (+569XXXXXXXX).
 * Returns null if the number is not a valid Chilean mobile.
 *
 * Rules:
 *  - Remove spaces, dashes, parentheses
 *  - If starts with +56, keep as-is if valid
 *  - If starts with 56 (without +), prepend +
 *  - If starts with 9 and has 9 digits, prepend +56
 *  - Otherwise invalid
 */
export function normalizePhoneCL(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Already has +56
  if (/^\+569\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  // Starts with 569... (no +)
  if (/^569\d{8}$/.test(cleaned)) {
    return '+' + cleaned;
  }
  // Starts with 9 and has 9 digits total
  if (/^9\d{8}$/.test(cleaned)) {
    return '+56' + cleaned;
  }

  return null;
}
