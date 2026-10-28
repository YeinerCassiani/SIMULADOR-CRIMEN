// Tipos de scripts/visual-eval-lib.mjs para el test de vitest bajo tsc.
export interface LumStats { mean: number; std: number; nearBlackFrac: number; pixels?: number }
export interface Check { id: string; pass: boolean; value?: unknown; threshold?: string }
export interface ScenarioMeasure {
  stats: LumStats; switchBackStats?: LumStats; consoleErrors: number; canvasPct: number;
}
export declare const THRESHOLDS: {
  nearBlackLevel: number; maxNearBlackFrac: number; minStd: number; maxConsoleErrors: number;
  minCanvasPctBefore: number; minCanvasPctAfter: number; contrastGain: number;
};
export declare function decodePng(buf: Uint8Array): { width: number; height: number; data: Uint8Array };
export declare function luma(r: number, g: number, b: number): number;
export declare function luminanceStats(rgba: Uint8Array, opts?: { step?: number; nearBlackLevel?: number }): Required<LumStats>;
export declare function canvasCoveragePct(rect: { x: number; y: number; width: number; height: number }, viewport: { width: number; height: number }): number;
type Rect = { x: number; y: number; width: number; height: number };
export declare function freeSceneRect(canvas: Rect, obstacles?: Rect[]): Rect;
export declare function isNotBlack(stats: LumStats, t?: typeof THRESHOLDS): boolean;
export declare function evaluateScenario(m: ScenarioMeasure, opts?: { label?: string; baseline?: { stats?: LumStats } | null }, t?: typeof THRESHOLDS): Check[];
export declare function aggregate(results: Array<Record<string, unknown>>): {
  scenarios: number; pass: boolean; failedChecks: string[]; meanLuminance: number | null; meanStd: number | null;
  meanNearBlackFrac: number | null; meanCanvasPct: number | null; meanFps: number | null; totalConsoleErrors: number;
};
export declare function fpsFromTimestamps(ts: number[]): number;
export declare function round(v: number, d?: number): number;
