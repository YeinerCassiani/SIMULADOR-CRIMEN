import type { Scenario } from '../types';

// Escenarios portados desde DEFAULT_SCENARIOS del simulador HTML original.
// Para el vertical slice basta el primer escenario (apartamento cerrado);
// el segundo queda incluido para validar que el render es data-driven.
export const SCENARIOS: Scenario[] = [
  {
    scenarioId: 'SCN-CER-001',
    title: 'Apartamento urbano - posible homicidio simulado',
    environmentType: 'cerrado',
    penalReference: 'Conducta contra la vida e integridad personal (caso académico). Marco procesal: Ley 906/2004 arts. 216, 254 y 255; Manual de Cadena de Custodia FGN.',
    recommendedSearchMethod: 'zonas',
    initialNarrative:
      'Central reporta un posible hecho delictivo en un apartamento. El participante debe actuar asegurando, observando, fijando, recolectando y documentando correctamente.',
    nunc: '470016000000202600001',
    dimensions: { w: 16, d: 12 },
    sceneLocation: 'Apartamento urbano - sala y comedor',
    decor: 'apartamento',
    witnesses: [
      { id: 'T-001', name: 'Vecina del piso', mustBeSeparated: true, hasRelevantInfo: true },
      { id: 'T-002', name: 'Familiar alterado', mustBeSeparated: true, hasRelevantInfo: false },
    ],
    evidenceItems: [
      { id: 'EMP-001', name: 'Vainilla simulada', nature: 'balística', x: 2.2, z: -1.1, w: 0.55, d: 0.35, h: 0.15, correctPackaging: 'caja_rigida', labDestination: 'Balística forense', description: 'Elemento pequeño de color latón sobre el piso de la sala.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-002', name: 'Celular encendido', nature: 'digital', x: -3.5, z: 1.8, w: 0.8, d: 0.45, h: 0.14, correctPackaging: 'bolsa_antiestatica', labDestination: 'Informática forense', description: 'Dispositivo móvil sobre mesa auxiliar.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-003', name: 'Prenda con mancha', nature: 'biológica', x: 4.2, z: 2.8, w: 1.2, d: 0.7, h: 0.08, correctPackaging: 'bolsa_papel', labDestination: 'Biología / genética forense', description: 'Prenda textil con mancha no gráfica.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-004', name: 'Documento doblado', nature: 'documental', x: 1.1, z: 3.7, w: 1.0, d: 0.65, h: 0.04, correctPackaging: 'sobre_papel', labDestination: 'Documentología', description: 'Documento hallado cerca de la entrada.', requiresPhotoBeforeCollection: true },
    ],
  },
  {
    scenarioId: 'SCN-ABI-001',
    title: 'Parque público - posible hurto con lesiones simulado',
    environmentType: 'abierto',
    penalReference: 'Conducta contra el patrimonio y posible lesión personal (caso académico). Marco procesal: Ley 906/2004 arts. 216, 254 y 255; Manual de Cadena de Custodia FGN.',
    recommendedSearchMethod: 'franjas',
    initialNarrative:
      'En zona abierta se reporta un posible hurto con lesión. Hay riesgo de pérdida de EMP/EF por clima y paso de personas.',
    nunc: '470016100000202600002',
    dimensions: { w: 20, d: 16 },
    sceneLocation: 'Parque público - sendero y zona verde',
    witnesses: [
      { id: 'T-003', name: 'Vendedor ambulante', mustBeSeparated: true, hasRelevantInfo: true },
      { id: 'T-004', name: 'Transeúnte', mustBeSeparated: true, hasRelevantInfo: true },
    ],
    evidenceItems: [
      { id: 'EMP-A01', name: 'Objeto contundente simulado', nature: 'física', x: -4.6, z: 1.2, w: 1.25, d: 0.45, h: 0.25, correctPackaging: 'caja_rigida', labDestination: 'Clínica y patología / lofoscopia', description: 'Objeto rígido sobre zona verde.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-A02', name: 'Fragmento de vidrio', nature: 'traza', x: 2.7, z: -2.8, w: 0.55, d: 0.32, h: 0.12, correctPackaging: 'caja_rigida', labDestination: 'Evidencia traza', description: 'Fragmento pequeño sobre sendero.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-A03', name: 'Bolso abandonado', nature: 'física/documental', x: 5.4, z: 3.3, w: 1.2, d: 0.8, h: 0.55, correctPackaging: 'bolsa_papel', labDestination: 'Lofoscopia / análisis documental', description: 'Bolso con documentos ficticios.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-A04', name: 'Dispositivo de video', nature: 'digital', x: -7.4, z: -5.2, w: 0.7, d: 0.35, h: 1.4, correctPackaging: 'bolsa_antiestatica', labDestination: 'Informática forense / video', description: 'Fuente de video simulado en poste.', requiresPhotoBeforeCollection: true },
    ],
  },
  {
    scenarioId: 'SCN-CER-002',
    title: 'Vivienda - violencia intrafamiliar con menor (NNA)',
    environmentType: 'cerrado',
    penalReference: 'Violencia intrafamiliar con NNA presente (caso académico). Marco: Ley 906/2004 arts. 216/254/255; enfoque diferencial NNA (MUPJ-3 pp. 19, 21-23).',
    recommendedSearchMethod: 'cuadricula',
    initialNarrative:
      'Se reporta agresión en una vivienda con un menor de edad presente. Debe garantizarse enfoque diferencial y evitar revictimización mientras se preservan los EMP/EF.',
    nunc: '470016000000202600003',
    dimensions: { w: 16, d: 12 },
    sceneLocation: 'Vivienda - habitación y sala',
    decor: 'vivienda',
    witnesses: [
      { id: 'T-005', name: 'Menor de edad (NNA)', mustBeSeparated: true, hasRelevantInfo: true },
      { id: 'T-006', name: 'Vecino', mustBeSeparated: true, hasRelevantInfo: false },
    ],
    evidenceItems: [
      { id: 'EMP-101', name: 'Prenda con mancha hemática', nature: 'biológica', x: -2.0, z: 2.0, w: 1.0, d: 0.6, h: 0.08, correctPackaging: 'bolsa_papel', labDestination: 'Biología / genética forense', description: 'Prenda con mancha pardo-rojiza sobre el piso.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-102', name: 'Objeto contundente', nature: 'física', x: 3.0, z: -1.5, w: 0.9, d: 0.3, h: 0.3, correctPackaging: 'caja_rigida', labDestination: 'Clínica y patología / lofoscopia', description: 'Elemento rígido posiblemente usado en la agresión.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-103', name: 'Teléfono de la víctima', nature: 'digital', x: -3.8, z: -2.5, w: 0.8, d: 0.45, h: 0.14, correctPackaging: 'bolsa_antiestatica', labDestination: 'Informática forense', description: 'Dispositivo móvil con posibles registros.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-104', name: 'Cuaderno escolar', nature: 'documental', x: 1.5, z: 3.2, w: 1.0, d: 0.7, h: 0.05, correctPackaging: 'sobre_papel', labDestination: 'Documentología', description: 'Documento con anotaciones relevantes.', requiresPhotoBeforeCollection: true },
    ],
  },
  {
    scenarioId: 'SCN-ABI-002',
    title: 'Vía pública - siniestro vial con lesionados',
    environmentType: 'vial',
    penalReference: 'Homicidio/lesiones en accidente de tránsito (caso académico). Competencia especial de autoridad de tránsito (MUPJ-3 pp. 11, 19); Ley 906/2004 arts. 216/254/255.',
    recommendedSearchMethod: 'franjas',
    initialNarrative:
      'Colisión en vía pública con personas lesionadas. Hay riesgo por tráfico y pérdida de EMP/EF; se requiere control del lugar y fijación rápida.',
    nunc: '470016200000202600004',
    dimensions: { w: 20, d: 16 },
    sceneLocation: 'Vía pública - calzada y berma',
    witnesses: [
      { id: 'T-007', name: 'Conductor implicado', mustBeSeparated: true, hasRelevantInfo: true },
      { id: 'T-008', name: 'Peatón testigo', mustBeSeparated: true, hasRelevantInfo: true },
    ],
    evidenceItems: [
      { id: 'EMP-201', name: 'Fragmento de farola', nature: 'traza', x: -5.0, z: 1.0, w: 0.5, d: 0.3, h: 0.12, correctPackaging: 'caja_rigida', labDestination: 'Evidencia traza', description: 'Fragmentos de plástico/vidrio sobre la calzada.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-202', name: 'Autoparte desprendida', nature: 'física', x: 3.5, z: -3.0, w: 1.3, d: 0.6, h: 0.3, correctPackaging: 'caja_rigida', labDestination: 'Automotores', description: 'Pieza del vehículo desprendida por el impacto.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-203', name: 'Mancha hemática en asfalto', nature: 'biológica', x: 5.5, z: 3.0, w: 1.0, d: 0.8, h: 0.02, correctPackaging: 'bolsa_papel', labDestination: 'Biología / genética forense', description: 'Mancha sobre el asfalto cerca del punto de impacto.', requiresPhotoBeforeCollection: true },
      { id: 'EMP-204', name: 'Cámara de fotodetección', nature: 'digital', x: -7.0, z: -5.5, w: 0.7, d: 0.35, h: 1.4, correctPackaging: 'bolsa_antiestatica', labDestination: 'Informática forense / video', description: 'Fuente de video de tránsito en poste.', requiresPhotoBeforeCollection: true },
    ],
  },
];

export const NATURE_COLORS: Record<string, string> = {
  digital: '#2563eb',
  biolog: '#b91c1c',
  bal: '#ca8a04',
  document: '#eab308',
  traza: '#7c3aed',
};

export function colorForNature(nature: string): string {
  const s = (nature || '').toLowerCase();
  if (s.includes('digital')) return NATURE_COLORS.digital;
  if (s.includes('biológ') || s.includes('biolog')) return NATURE_COLORS.biolog;
  if (s.includes('bal')) return NATURE_COLORS.bal;
  if (s.includes('document')) return NATURE_COLORS.document;
  if (s.includes('traza')) return NATURE_COLORS.traza;
  return '#16a34a';
}
