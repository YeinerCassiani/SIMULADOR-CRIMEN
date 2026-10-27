// Capa forense de escena (contrato: ForensicLayerProps): cordón, ruta de
// ingreso/salida y manchas latentes del modo luz forense.
// Stub inicial con el cordón y la ruta actuales. El agente forense lo reemplaza.
import { Line } from '@react-three/drei';
import type { ForensicLayerProps } from '../contracts';

function Cordon({ w, d }: { w: number; d: number }) {
  const mx = w / 2 + 0.7, mz = d / 2 + 0.7, y = 0.06;
  const pts: [number, number, number][] = [
    [-mx, y, -mz], [mx, y, -mz], [mx, y, mz], [-mx, y, mz], [-mx, y, -mz],
  ];
  return <Line points={pts} color="#f59e0b" lineWidth={2} dashed dashSize={0.5} gapSize={0.3} />;
}

function Route({ open }: { open: boolean }) {
  const y = 0.08;
  const pts: [number, number, number][] = open
    ? [[-9, y, -7], [-6, y, -4], [-2, y, -2], [2, y, 0], [5, y, 3]]
    : [[-6, y, -4], [-3, y, -1], [-1, y, 0], [2, y, 2.2]];
  return <Line points={pts} color="#4ec1ff" lineWidth={2} dashed dashSize={0.3} gapSize={0.25} />;
}

export function ForensicLayer({ state }: ForensicLayerProps) {
  const { scenario, globals } = state;
  return (
    <>
      {globals.cordon && <Cordon w={scenario.dimensions.w} d={scenario.dimensions.d} />}
      {globals.route && <Route open={scenario.environmentType !== 'cerrado'} />}
    </>
  );
}
