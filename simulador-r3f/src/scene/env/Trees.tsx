// Árboles y arbustos procedurales instanciados: un draw call para troncos y uno
// para todas las masas de copa (Poly Haven no tiene árboles dentro de presupuesto).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { treeGeometry, type TreeSpot } from './layout';

export function Trees({ trees, bushes, seed = 7 }: { trees: readonly TreeSpot[]; bushes: readonly TreeSpot[]; seed?: number }) {
  const { trunks, blobs } = useMemo(() => treeGeometry(trees, bushes, seed), [trees, bushes, seed]);
  const trunkRef = useRef<InstancedMesh>(null);
  const blobRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3();
    const tr = trunkRef.current;
    if (tr) {
      trunks.forEach((t, i) => {
        // Cilindro unitario (alto 1, radio 1): se escala al tronco.
        tr.setMatrixAt(i, m.compose(p.set(t.x, t.h / 2, t.z), q.identity(), s.set(t.r, t.h, t.r)));
      });
      tr.instanceMatrix.needsUpdate = true;
      tr.computeBoundingSphere();
    }
    const bl = blobRef.current;
    if (bl) {
      const c = new Color();
      blobs.forEach((b, i) => {
        // Achatadas en Y para que la copa no parezca una pila de esferas.
        q.setFromAxisAngle(p.set(0, 1, 0), (i * 1.7) % (Math.PI * 2));
        bl.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q, s.set(b.r, b.r * 0.82, b.r)));
        bl.setColorAt(i, c.set(b.color));
      });
      bl.instanceMatrix.needsUpdate = true;
      if (bl.instanceColor) bl.instanceColor.needsUpdate = true;
      bl.computeBoundingSphere();
    }
  }, [trunks, blobs]);

  return (
    <group>
      {trunks.length > 0 && (
        <instancedMesh ref={trunkRef} args={[undefined, undefined, trunks.length]} castShadow receiveShadow>
          <cylinderGeometry args={[0.7, 1, 1, 9]} />
          <meshStandardMaterial color="#4a3423" roughness={0.95} />
        </instancedMesh>
      )}
      {blobs.length > 0 && (
        <instancedMesh ref={blobRef} args={[undefined, undefined, blobs.length]} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.92} flatShading />
        </instancedMesh>
      )}
    </group>
  );
}
