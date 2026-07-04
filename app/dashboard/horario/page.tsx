import { HoursEditor } from './HoursEditor';
import { ScheduleBlocks } from './ScheduleBlocks';

export default function HorarioPage() {
  return (
    <div className="stack">
      <div>
        <h1>Horario de atención</h1>
        <p className="subtitle">
          Elige los días y horarios en que atiendes. Puedes usar el modo simple o, si necesitas algo distinto cada día, usar el modo avanzado.
        </p>
      </div>
      <HoursEditor />
      <ScheduleBlocks />
    </div>
  );
}
