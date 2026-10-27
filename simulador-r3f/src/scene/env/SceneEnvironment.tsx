// Punto de entrada del ambiente 3D (contrato: EnvironmentProps).
// Stub inicial: delega en Room. El agente de ambientes lo reemplaza.
import type { EnvironmentProps } from '../contracts';
import { Room } from '../Room';

export function SceneEnvironment({ scenario }: EnvironmentProps) {
  return <Room scenario={scenario} />;
}
