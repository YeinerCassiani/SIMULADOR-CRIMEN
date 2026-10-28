import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Outlines, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { EvidenceItem } from '../types';
import type { QualityTier } from './contracts';
import { resolveKind } from './forensic/kinds';
import { rngFor } from './forensic/random';
import { paperTexture } from './forensic/textures';
import { ACCENT, NEGATIVE } from './forensic/presentation';

interface Props {
  item: EvidenceItem;
  selected: boolean;
  hovered: boolean;
  contaminated: boolean;
  /** Calidad efectiva: el vidrio usa transmisión real solo en 'alta'. */
  tier?: QualityTier;
}

/*
 * Props 3D de los EMP/EF a nivel maqueta: primitivas con bisel, materiales PBR
 * y medidas en metros. Los objetos diminutos (vainilla, celular) se exageran
 * entre 1.5x y 5x para que se lean desde la cámara orbital; el resto va a escala
 * real. La huella clicable (item.w × item.d) la pone Evidence.tsx con una caja
 * invisible, así el modelo puede ser más pequeño que su huella.
 *
 * Halo de selección: drei <Outlines> (NUNCA screenspace) dentro de la malla
 * principal de cada prop. Los props planos (prenda, mancha, papel) no llevan
 * contorno: su halo es el anillo del piso en Evidence.tsx.
 */
export function EvidenceModel({ item, selected, hovered, contaminated, tier = 'media' }: Props) {
  const kind = resolveKind(item);
  const halo = selected || hovered;
  const haloColor = contaminated ? NEGATIVE : ACCENT;
  const outline = halo ? <Outlines thickness={selected ? 0.02 : 0.012} color={haloColor} /> : null;

  switch (kind) {
    case 'shell': return <Shell outline={outline} />;
    case 'phone': return <Phone outline={outline} />;
    case 'camera': return <CctvCamera h={item.h} outline={outline} />;
    case 'garment': return <Garment item={item} />;
    case 'stain': return <BloodPool item={item} />;
    case 'document':
      return /cuaderno|libreta/i.test(item.name) ? <Notebook outline={outline} /> : <FoldedPaper />;
    case 'glass': return <Shards item={item} tier={tier} outline={outline} />;
    case 'bag': return <Handbag outline={outline} />;
    case 'blunt': return <Pipe outline={outline} />;
    case 'autopart': return <BumperFragment outline={outline} />;
    default:
      return (
        <RoundedBox args={[item.w, item.h, item.d]} radius={Math.min(item.w, item.d, item.h) * 0.2} smoothness={3} position={[0, item.h / 2, 0]} castShadow>
          <meshStandardMaterial color={contaminated ? NEGATIVE : '#7d8188'} roughness={0.6} />
          {outline}
        </RoundedBox>
      );
  }
}

type WithOutline = { outline: ReactNode };

// ------------------------------------------------------------- Materiales base
const BRASS = { color: '#d8b462', metalness: 1, roughness: 0.35 } as const;
const STEEL = { color: '#9aa0a7', metalness: 1, roughness: 0.42 } as const;
const BLACK_PLASTIC = { color: '#17181b', metalness: 0, roughness: 0.55 } as const;

/** Vainilla 9 mm (×5): cuerpo, ranura de extracción, culote con fulminante. */
function Shell({ outline }: WithOutline) {
  const r = 0.026, L = 0.11;
  return (
    <group position={[0, r, 0]} rotation={[0, 0.5, 0]}>
      <group rotation={[0, 0, Math.PI / 2]}>
        {/* Cuerpo (boca abierta hacia +X) */}
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[r * 0.97, r, L * 0.78, 28, 1, true]} />
          <meshStandardMaterial {...BRASS} side={THREE.DoubleSide} />
          {outline}
        </mesh>
        {/* Interior oscuro de la boca */}
        <mesh position={[0, 0.01 + L * 0.37, 0]}>
          <cylinderGeometry args={[r * 0.88, r * 0.88, 0.004, 24]} />
          <meshStandardMaterial color="#2a2112" metalness={0.6} roughness={0.7} />
        </mesh>
        {/* Ranura de extracción y culote */}
        <mesh position={[0, -L * 0.36, 0]} castShadow>
          <cylinderGeometry args={[r * 0.8, r * 0.8, L * 0.06, 24]} />
          <meshStandardMaterial {...BRASS} roughness={0.45} />
        </mesh>
        <mesh position={[0, -L * 0.43, 0]} castShadow>
          <cylinderGeometry args={[r * 1.02, r * 1.02, L * 0.08, 28]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        {/* Fulminante (níquel) */}
        <mesh position={[0, -L * 0.472, 0]}>
          <cylinderGeometry args={[r * 0.32, r * 0.32, 0.003, 18]} />
          <meshStandardMaterial color="#c9c9c4" metalness={1} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/** Celular (×1.5) boca arriba con pantalla encendida (emisiva, alcanza el bloom). */
function Phone({ outline }: WithOutline) {
  const W = 0.115, D = 0.24, H = 0.013;
  return (
    <group rotation={[0, 0.35, 0]}>
      <RoundedBox args={[W, H, D]} radius={0.006} smoothness={4} position={[0, H / 2, 0]} castShadow>
        <meshStandardMaterial color="#2b2e35" metalness={0.9} roughness={0.32} />
        {outline}
      </RoundedBox>
      {/* Vidrio frontal negro y pantalla de bloqueo */}
      <mesh position={[0, H + 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.94, D * 0.96]} />
        <meshStandardMaterial color="#050608" roughness={0.08} metalness={0.2} />
      </mesh>
      <mesh position={[0, H + 0.0012, 0.002]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.86, D * 0.86]} />
        <meshStandardMaterial color="#0b1a33" emissive="#4b86e8" emissiveIntensity={1.6} roughness={0.15} toneMapped={false} />
      </mesh>
      {/* Reloj de la pantalla de bloqueo */}
      <mesh position={[0, H + 0.0018, -D * 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.5, 0.022]} />
        <meshBasicMaterial color="#dfe9ff" toneMapped={false} />
      </mesh>
      {/* Cámara frontal */}
      <mesh position={[0, H + 0.0018, -D * 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.004, 12]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}

/** Cámara de vigilancia tipo bala sobre poste, con LED de grabación. */
function CctvCamera({ h, outline }: { h: number } & WithOutline) {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.03, 20]} />
        <meshStandardMaterial color="#3a3d43" metalness={0.8} roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.045, h, 16]} />
        <meshStandardMaterial color="#6d737b" metalness={0.9} roughness={0.45} />
      </mesh>
      {/* Brazo y rótula */}
      <mesh position={[0, h - 0.02, 0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.14, 10]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <group position={[0, h + 0.03, 0.16]} rotation={[0.28, 0, 0]}>
        {/* Carcasa */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.28, 24]} />
          <meshStandardMaterial color="#e7e8e6" roughness={0.4} metalness={0.05} />
          {outline}
        </mesh>
        {/* Visera */}
        <mesh position={[0, 0.03, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.078, 0.078, 0.3, 24, 1, true, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#d9dad7" roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        {/* Lente */}
        <mesh position={[0, 0, 0.141]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.004, 24]} />
          <meshPhysicalMaterial color="#05070c" roughness={0.05} metalness={0.3} clearcoat={1} />
        </mesh>
        <mesh position={[0.035, -0.035, 0.142]}>
          <sphereGeometry args={[0.006, 10, 10]} />
          <meshStandardMaterial color="#ff2a2a" emissive="#ff2020" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Altura de la tela arrugada en (u,v) ∈ [-0.5,0.5]²: pliegues que caen al borde. */
function clothGeometry(id: string, W: number, D: number) {
  const rnd = rngFor(`cloth:${id}`);
  const folds = Array.from({ length: 6 }, () => ({
    x: (rnd() - 0.5) * 0.7, z: (rnd() - 0.5) * 0.7, a: 0.018 + rnd() * 0.035, s: 0.09 + rnd() * 0.16,
  }));
  const ridges = Array.from({ length: 3 }, () => ({ ang: rnd() * Math.PI, f: 9 + rnd() * 8, a: 0.004 + rnd() * 0.006 }));
  const stain = Array.from({ length: 5 }, (_, i) => ({ x: 0.06 + (rnd() - 0.5) * 0.22, z: 0.04 + (rnd() - 0.5) * 0.2, r: (i ? 0.06 : 0.13) + rnd() * 0.05 }));
  const g = new THREE.PlaneGeometry(W, D, 40, 28);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const fabric = new THREE.Color('#8e9bb0'), blood = new THREE.Color('#3f0d09'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / W, v = pos.getZ(i) / D;
    const edge = Math.min(0.5 - Math.abs(u), 0.5 - Math.abs(v)) * 2; // 0 en el borde, 1 al centro
    const fall = Math.min(1, edge * 3.2);
    let y = 0.012;
    for (const f of folds) y += f.a * Math.exp(-((u - f.x) ** 2 + (v - f.z) ** 2) / (f.s * f.s));
    for (const r of ridges) y += r.a * Math.sin((u * Math.cos(r.ang) + v * Math.sin(r.ang)) * r.f * Math.PI);
    pos.setY(i, Math.max(0.003, y * fall + 0.003));
    // Mancha: suma de manchas gaussianas con borde irregular; más oscura al centro.
    let k = 0;
    for (const s of stain) k = Math.max(k, Math.exp(-((u - s.x) ** 2 + (v - s.z) ** 2) / (s.r * s.r)));
    const m = THREE.MathUtils.smoothstep(k + Math.sin(u * 47) * Math.sin(v * 39) * 0.08, 0.35, 0.6);
    const shade = 0.86 + 0.14 * Math.min(1, y / 0.05); // pliegues altos más claros
    tmp.copy(fabric).multiplyScalar(shade).lerp(blood, m * 0.92);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Prenda de tela arrugada con mancha hemática teñida en la propia tela (sin z-fighting). */
function Garment({ item }: { item: EvidenceItem }) {
  const W = Math.min(item.w, 0.95), D = Math.min(item.d, 0.62);
  const geo = useMemo(() => clothGeometry(item.id, W, D), [item.id, W, D]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, 0.036, 0]} rotation={[0, 0.25, 0]} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.96} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Charco de sangre irregular sobre el piso, aún húmedo (roughness bajo), con gotas satélite. */
function BloodPool({ item }: { item: EvidenceItem }) {
  const { shape, drops } = useMemo(() => {
    const rnd = rngFor(`pool:${item.id}`);
    const R = Math.min(item.w, item.d) * 0.42;
    const sh = new THREE.Shape();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = R * (0.78 + 0.22 * Math.sin(a * 3 + 1.3) * 0.6 + rnd() * 0.18) * (Math.abs(Math.cos(a)) * 0.25 + 1);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.82;
      if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
    }
    const ds = Array.from({ length: 7 }, () => {
      const a = rnd() * Math.PI * 2, d = R * (1.15 + rnd() * 0.6);
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.012 + rnd() * 0.03 };
    });
    return { shape: sh, drops: ds };
  }, [item.id, item.w, item.d]);
  const mat = <meshStandardMaterial color="#3a0705" roughness={0.22} metalness={0} polygonOffset polygonOffsetFactor={-5} polygonOffsetUnits={-5} />;
  return (
    <group position={[0, 0.047, 0]} rotation={[-Math.PI / 2, 0, 0.4]}>
      <mesh receiveShadow>
        <shapeGeometry args={[shape, 1]} />
        {mat}
      </mesh>
      {drops.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, 0]} receiveShadow>
          <circleGeometry args={[d.r, 14]} />
          {mat}
        </mesh>
      ))}
    </group>
  );
}

/** Hoja A4 (×1.4) doblada por la mitad y entreabierta, con renglones impresos. */
function FoldedPaper() {
  const W = 0.29, D = 0.21, open = 0.32;
  const map = paperTexture();
  const half = (side: 1 | -1) => (
    <mesh position={[0, 0, side * (D / 4) * Math.cos(open)]} rotation={[-Math.PI / 2 + side * open, 0, 0]} castShadow receiveShadow>
      <planeGeometry args={[W, D / 2]} />
      <meshStandardMaterial map={map} roughness={0.88} side={THREE.DoubleSide} />
    </mesh>
  );
  return (
    <group position={[0, 0.036 + (D / 4) * Math.sin(open), 0]} rotation={[0, 0.25, 0]}>
      {half(1)}
      {half(-1)}
    </group>
  );
}

/** Cuaderno escolar con tapa de color, borde de hojas y espiral metálica. */
function Notebook({ outline }: WithOutline) {
  const W = 0.24, D = 0.32, H = 0.016;
  return (
    <group position={[0, 0.036, 0]} rotation={[0, -0.3, 0]}>
      <RoundedBox args={[W, H, D]} radius={0.003} smoothness={2} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1eee4" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, H + 0.0015, 0]} castShadow>
        <boxGeometry args={[W, 0.003, D]} />
        <meshStandardMaterial color="#2f5d8c" roughness={0.6} />
        {outline}
      </mesh>
      <mesh position={[0.02, H + 0.0035, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.12, 0.05]} />
        <meshStandardMaterial color="#f4f1e8" roughness={0.85} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position={[-W / 2, H / 2 + 0.002, -D / 2 + 0.02 + i * ((D - 0.04) / 12)]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.012, 0.0018, 6, 14]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
    </group>
  );
}

/** Esquirlas de vidrio (y plástico ámbar si es de farola). Transmisión solo en 'alta'. */
function Shards({ item, tier, outline }: { item: EvidenceItem; tier: QualityTier } & WithOutline) {
  const amber = /farol|faro/i.test(item.name);
  const pieces = useMemo(() => {
    const rnd = rngFor(`shards:${item.id}`);
    return Array.from({ length: 7 }, (_, i) => ({
      x: (rnd() - 0.5) * item.w * 0.75, z: (rnd() - 0.5) * item.d * 0.75,
      s: (i === 0 ? 0.09 : 0.03 + rnd() * 0.05), ry: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.4,
      amber: amber && i % 3 === 1,
    }));
  }, [item.id, item.w, item.d, amber]);
  const glass = (tint: string) =>
    tier === 'alta' ? (
      <meshPhysicalMaterial color={tint} transmission={1} thickness={0.01} roughness={0.06} ior={1.5} metalness={0} />
    ) : (
      <meshStandardMaterial color={tint} transparent opacity={0.5} roughness={0.06} metalness={0.1} depthWrite={false} />
    );
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={[p.x, 0.04, p.z]} rotation={[p.tilt, p.ry, 0]} scale={[p.s, 0.012, p.s * 0.7]} castShadow>
          <cylinderGeometry args={[1, 1, 1, 3]} />
          {glass(p.amber ? '#f2a64a' : '#d6edf5')}
          {i === 0 ? outline : null}
        </mesh>
      ))}
    </group>
  );
}

/** Bolso de cuero con solapa, hebilla metálica, asa y papeles asomando. */
function Handbag({ outline }: WithOutline) {
  const W = 0.42, H = 0.3, D = 0.16;
  const leather = { color: '#5b3a22', roughness: 0.62, metalness: 0 } as const;
  return (
    <group rotation={[0, 0.3, 0]}>
      <RoundedBox args={[W, H, D]} radius={0.035} smoothness={4} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...leather} />
        {outline}
      </RoundedBox>
      <RoundedBox args={[W * 1.01, H * 0.42, 0.02]} radius={0.008} smoothness={3} position={[0, H * 0.76, D / 2 + 0.006]} castShadow>
        <meshStandardMaterial {...leather} color="#4a2f1b" />
      </RoundedBox>
      <mesh position={[0, H * 0.58, D / 2 + 0.018]} castShadow>
        <boxGeometry args={[0.05, 0.035, 0.008]} />
        <meshStandardMaterial {...BRASS} roughness={0.3} />
      </mesh>
      <mesh position={[0, H, 0]} castShadow>
        <torusGeometry args={[W * 0.27, 0.012, 10, 28, Math.PI]} />
        <meshStandardMaterial {...leather} color="#3d2716" />
      </mesh>
      {/* Documentos ficticios asomando */}
      <mesh position={[0.08, H + 0.03, -0.02]} rotation={[0.1, 0.2, 0.08]}>
        <boxGeometry args={[0.15, 0.08, 0.002]} />
        <meshStandardMaterial map={paperTexture()} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Tubo de acero con empuñadura de cinta negra (objeto contundente). */
function Pipe({ outline }: WithOutline) {
  const L = 0.62, r = 0.026;
  return (
    <group position={[0, r, 0]} rotation={[0, 0.35, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r, r, L, 20]} />
        <meshStandardMaterial {...STEEL} roughness={0.5} />
        {outline}
      </mesh>
      <mesh position={[-L / 2 + 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r * 1.12, r * 1.12, 0.19, 20]} />
        <meshStandardMaterial {...BLACK_PLASTIC} roughness={0.85} />
      </mesh>
      {/* Extremo abierto oscuro */}
      <mesh position={[L / 2 + 0.0005, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[r * 0.75, r, 20]} />
        <meshStandardMaterial {...STEEL} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[L / 2 - 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[r * 0.75, 20]} />
        <meshStandardMaterial color="#0d0d0e" />
      </mesh>
    </group>
  );
}

/** Fragmento de parachoques pintado (curvo) con rejilla de plástico negro. */
function BumperFragment({ outline }: WithOutline) {
  return (
    <group rotation={[0, -0.4, 0]}>
      <mesh position={[0, 0.11, -0.75]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.2, 24, 1, true, -0.42, 0.84]} />
        <meshStandardMaterial color="#7c1b1b" metalness={0.45} roughness={0.3} side={THREE.DoubleSide} />
        {outline}
      </mesh>
      <mesh position={[0.05, 0.05, 0.16]} rotation={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.36, 0.06, 0.04]} />
        <meshStandardMaterial {...BLACK_PLASTIC} />
      </mesh>
      {/* Esquirlas de pintura */}
      {[[-0.2, 0.3], [0.25, 0.32], [0.05, 0.42]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, i]}>
          <circleGeometry args={[0.02 + i * 0.006, 3]} />
          <meshStandardMaterial color="#7c1b1b" metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}
