import { ProfessionalsManager } from './ProfessionalsManager';

export default function ProfesionalesPage() {
  return (
    <div className="stack">
      <div>
        <h1>Profesionales</h1>
        <p className="subtitle">
          Agrega a tu equipo para asignar horarios y citas por persona.
        </p>
      </div>
      <ProfessionalsManager />
    </div>
  );
}
