/// <reference types="node" />
// Gate de la integración (ola 3): fija las decisiones que resolvieron conflictos
// entre dueños (luces duplicadas, tone mapping, carga de modelos, contrato).
// Lee el código fuente donde la decisión es estructural (qué monta quién).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WitnessesProps } from '../scene/contracts';
import { DEFAULT_VIEW } from '../scene/contracts';
import { nightPreset } from '../scene/render/presets';
import { workLightSettings } from '../scene/forensic/presentation';
import { PENDANT_CD, STREET_LAMP_CD, practicalIntensity } from '../scene/env/layout';

const SRC = join(__dirname, '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
/** Código sin comentarios (los comentarios pueden nombrar lo que ya no se usa). */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('reparto de luces entre render, forensic y env', () => {
  it('render no monta focos de trabajo: el trípode (luz incluida) es de forensic', () => {
    const lighting = code('scene/render/Lighting.tsx');
    expect(lighting).not.toMatch(/forensic\/workLights/);
    expect(lighting).not.toMatch(/workLightPlacements/);
    expect(code('scene/forensic/ForensicLayer.tsx')).toMatch(/<SpotLight/);
  });

  it('la única luz de cada trípode alumbra lo que antes sumaban los dos spot', () => {
    for (const tier of ['alta', 'media', 'baja'] as const) {
      expect(workLightSettings(tier, false).intensity).toBeGreaterThanOrEqual(40);
      // El modo forense atenúa, no apaga (la cantidad de luces no cambia).
      const dim = workLightSettings(tier, true).intensity;
      expect(dim).toBeGreaterThan(0);
      expect(dim).toBeLessThan(workLightSettings(tier, false).intensity * 0.2);
    }
  });

  it('el relleno de techo y el baño de muros de render son solo de interior', () => {
    const int = nightPreset('cerrado');
    expect(int.ceiling).not.toBeNull();
    expect(int.wallWash).not.toBeNull();
    for (const env of ['abierto', 'vial'] as const) expect(nightPreset(env).wallWash).toBeNull();
  });

  it('las luces prácticas de env dejan charco (calibradas contra la eval visual)', () => {
    // A ~3.9 m, 48 cd daban ~3 lux en el piso: el farol no se notaba.
    expect(STREET_LAMP_CD / 3.9 ** 2).toBeGreaterThan(10);
    expect(PENDANT_CD.vivienda).toBeGreaterThan(PENDANT_CD.apartamento);
    expect(practicalIntensity(STREET_LAMP_CD, true)).toBeLessThan(STREET_LAMP_CD * 0.2);
  });

  it('las colgantes no se dibujan (sin techo flotaban): solo su luz', () => {
    expect(code('scene/env/Interior.tsx')).toMatch(/p\.model !== 'modern_ceiling_lamp_01'/);
  });
});

describe('un solo tone mapping (restricción §3.8)', () => {
  it('Canvas sin tone mapping y un único <ToneMapping> ACES en el composer', () => {
    expect(code('scene/Scene.tsx')).toMatch(/toneMapping: NoToneMapping/);
    const post = code('scene/render/PostFx.tsx');
    expect(post.match(/<ToneMapping\b/g)).toHaveLength(1);
    expect(post).toMatch(/TONE_MAPPING_ACES = 6/);
  });

  it('exposición por ambiente dentro de un rango sano (ni noche negra ni día)', () => {
    for (const env of ['cerrado', 'abierto', 'vial'] as const) {
      const e = nightPreset(env).exposure;
      expect(e).toBeGreaterThanOrEqual(1);
      expect(e).toBeLessThanOrEqual(3);
    }
  });
});

describe('carga de modelos', () => {
  it('mientras carga no se dibuja el respaldo; el procedural queda para el fallo', () => {
    const g = code('scene/GltfProp.tsx');
    expect(g).toMatch(/<Suspense fallback=\{null\}>/);
    expect(g).toMatch(/<AssetBoundary fallback=\{fallback\}>/);
    // Restricción §3.7: sin Draco (useGLTF(url, true) baja el decodificador de un CDN).
    expect(g).not.toMatch(/useGLTF\([^)]*,\s*true/);
  });
});

describe('contrato', () => {
  it('WitnessesProps vive en contracts.ts y Witnesses.tsx lo usa', () => {
    const p: WitnessesProps = { state: {} as WitnessesProps['state'], dispatch: () => {}, view: DEFAULT_VIEW, tier: 'media' };
    expect(p.tier).toBe('media');
    expect(code('scene/Witnesses.tsx')).toMatch(/type WitnessesProps \} from '\.\/contracts'/);
    expect(code('scene/Witnesses.tsx')).not.toMatch(/export interface WitnessesProps/);
  });
});
