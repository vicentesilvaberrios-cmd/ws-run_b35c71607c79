/**
 * Availability calculation helper.
 * This mirrors the server-side RPC `public_availability` for client-side use.
 * The RPC is the source of truth; this is a convenience for building UI.
 */

export interface Slot {
  starts_at: string;
  ends_at: string;
}

export interface BusinessHourBlock {
  start_time: string;
  end_time: string;
}

export interface BreakBlock {
  start_time: string;
  end_time: string;
}

export interface AppointmentBlock {
  starts_at: string;
  ends_at: string;
}

/**
 * Calculates available slots for a given date, service duration, business hours, breaks, and existing appointments.
 * All time strings are ISO or 'HH:MM:SS' format.
 */
export function calculateSlots(
  date: string, // YYYY-MM-DD
  durationMin: number,
  businessHours: BusinessHourBlock[],
  breaks: BreakBlock[],
  appointments: AppointmentBlock[],
  weekday: number,
  now: Date = new Date()
): Slot[] {
  const slots: Slot[] = [];

  // Filter business hours for the weekday (already filtered by caller typically)
  const blocks = businessHours;

  for (const block of blocks) {
    const [bhH, bhM, bhS] = block.start_time.split(':').map(Number);
    const [beH, beM, beS] = block.end_time.split(':').map(Number);

    const blockStart = new Date(date);
    blockStart.setHours(bhH || 0, bhM || 0, bhS || 0, 0);

    const blockEnd = new Date(date);
    blockEnd.setHours(beH || 0, beM || 0, beS || 0, 0);

    // Skip blocks entirely in the past
    if (blockEnd <= now) continue;

    // Adjust start if in the past
    let slotStart = new Date(blockStart);
    if (slotStart < now) {
      slotStart = new Date(now);
      slotStart.setSeconds(0, 0);
    }

    while (true) {
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);

      if (slotEnd > blockEnd) break;

      // Check overlap with breaks
      const overlapsBreak = breaks.some((br) => {
        const [brSH, brSM, brSS] = br.start_time.split(':').map(Number);
        const [brEH, brEM, brES] = br.end_time.split(':').map(Number);
        const brStart = new Date(date);
        brStart.setHours(brSH || 0, brSM || 0, brSS || 0, 0);
        const brEnd = new Date(date);
        brEnd.setHours(brEH || 0, brEM || 0, brES || 0, 0);
        return slotStart < brEnd && brStart < slotEnd;
      });

      if (!overlapsBreak) {
        // Check overlap with existing appointments
        const overlapsApt = appointments.some((apt) => {
          const aptStart = new Date(apt.starts_at);
          const aptEnd = new Date(apt.ends_at);
          return slotStart < aptEnd && aptStart < slotEnd;
        });

        if (!overlapsApt) {
          slots.push({
            starts_at: slotStart.toISOString(),
            ends_at: slotEnd.toISOString(),
          });
        }
      }

      slotStart = slotEnd;
    }
  }

  return slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
