/** BetterMate v2 bundle: `window.BetterMate`. Plain functions that return SVG or HTML strings; no framework. */
export type Tone = 'heat' | 'primary' | 'ink' | 'faint';
/** [value 0..1, target 0..1 or -1 for none, tone] */
export type Arc = [number, number, Tone];
export interface TickRingProps { left?: Arc; right?: Arc; full?: Arc }
export interface IconProps { name: string; size?: number }
export interface SegmentBarProps { on: number; total: number; target?: number }
export interface DisplayStandbyProps { s: 'standby'; time: string; date?: string; line?: string; temp?: number; busy?: boolean; rest?: boolean; exception?: 'warning' | 'update' }
export interface DisplayBrewProps { s: 'brew'; state: 'heating' | 'ready'; temp: string; target: number; tempF: number; targetF: number; pressureF?: number; profile: string; scale?: string; exception?: 'warning' | 'update' }
export interface DisplayShotProps { s: 'shot'; phase: string; time: string; tempF: number; targetF: number; pressureF: number; pTargetF: number; phases: [number, number][]; a: [string, string]; b: [string, string]; done?: boolean }
export interface DisplayModesProps { s: 'mode' | 'grind'; name?: string; live?: string; target: string; unit?: string; tempF?: number; targetF?: number; progress?: number; by?: 'time' | 'weight'; running?: boolean; action?: [string, 'primary' | 'ink']; note?: string }
export interface DisplayMenuProps { s: 'menu' | 'profiles' | 'adjust' | 'sheet' | 'warnings' | 'info'; [key: string]: unknown }
export declare function icon(name: string, size?: number, className?: string): string;
export declare function ring(props: TickRingProps): string;
export declare function face(props: DisplayStandbyProps | DisplayBrewProps | DisplayShotProps | DisplayModesProps | DisplayMenuProps): string;
export declare function segbar(on: number, total: number, target?: number): string;
/** Fills data-icon, data-segbar, data-dots, data-ring and data-face hooks under root (default: document). */
export declare function hydrate(root?: ParentNode): void;
export declare const icons: string[];
export declare const geometry: { centre: 240; inner: 212; outer: 234; notch: 204; arcs: Record<'left' | 'right' | 'full', { start: number; sweep: number; n: number }>; tickAngles(arc: 'left' | 'right' | 'full'): number[]; litCount(fraction: number, n: number): number; notchIndex(fraction: number, n: number): number };
