/** BetterMate v2 bundle: `window.BetterMate`. Plain functions that return SVG or HTML strings; no framework. */
export type Tone = 'heat' | 'primary' | 'ink' | 'faint';
/** [value 0..1, target 0..1 or -1 for none, tone] */
export type Arc = [number, number, Tone];
export interface TickRingProps { left?: Arc; right?: Arc; full?: Arc }
export interface IconProps { name: string; size?: number }
export interface SegmentBarProps { on: number; total: number; target?: number }
export interface LoaderProps { size?: number }
/** Picks a chart line's colour, weight and dash: pressure solid 2.5 px, temperature solid, flow dashed, weight dotted. */
export type SeriesKey = 'pressure' | 'temperature' | 'flow' | 'weight';
/** max: the value at the top of the plot for this series (default: y.max). unit and digits shape the end label: 9.0 + ' bar'. */
export interface ChartSeries { key: SeriesKey; max?: number; unit?: string; digits?: number; points: [number, number][] }
/** w and h in px: the chart is drawn at that size so its type stays at the `data` style. right: px kept for end labels (default 76). */
export interface ChartProps { w?: number; h?: number; label: string; right?: number; x: { max: number; ticks?: number[]; unit?: string }; y: { max: number; ticks?: number[] }; series: ChartSeries[] }
export interface DisplayStandbyProps { s: 'standby'; time: string; date?: string; line?: string; temp?: number; busy?: boolean; rest?: boolean; exception?: 'warning' | 'update' }
export interface DisplayBrewProps { s: 'brew'; state: 'heating' | 'ready'; temp: string; target: number; tempF: number; targetF: number; pressureF?: number; profile: string; scale?: string; exception?: 'warning' | 'update'; pending?: boolean }
export interface DisplayShotProps { s: 'shot'; phase: string; time: string; tempF: number; targetF: number; pressureF: number; pTargetF: number; phases: [number, number][]; a: [string, string]; b: [string, string]; done?: boolean }
export interface DisplayModesProps { s: 'mode' | 'grind'; name?: string; live?: string; target: string; unit?: string; tempF?: number; targetF?: number; progress?: number; by?: 'time' | 'weight'; running?: boolean; action?: [string, 'primary' | 'ink']; note?: string }
export interface DisplayMenuProps { s: 'menu' | 'profiles' | 'adjust' | 'sheet' | 'warnings' | 'info'; [key: string]: unknown }
/** fault: title, up to two lines, an action only when pressing it can help. update: progress 0..1, a line and a note (the version).
    info as Wi-Fi setup: heading, ssid, ip, hint, and action: false for no text button. label names the screen for assistive technology. */
export interface DisplayStatesProps { s: 'fault' | 'update' | 'info'; label?: string; title?: string; lines?: string[]; action?: [string, 'primary' | 'ink'] | string | false; progress?: number; heading?: string; line?: string; note?: string; ssid?: string; ip?: string; hint?: string }
export declare function icon(name: string, size?: number, className?: string): string;
export declare function ring(props: TickRingProps): string;
export declare function face(props: DisplayStandbyProps | DisplayBrewProps | DisplayShotProps | DisplayModesProps | DisplayMenuProps | DisplayStatesProps): string;
export declare function segbar(on: number, total: number, target?: number): string;
/** Twelve ticks, three lit; bundle.css steps the lit group round. Draws in currentColor. */
export declare function loader(size?: number): string;
export declare function chart(props: ChartProps): string;
/** A 20 px sample of one series' line, for a legend Chip. */
export declare function chartKey(key: SeriesKey): string;
/** Fills data-icon, data-segbar, data-dots, data-ring, data-face, data-loader, data-chart and data-chart-key hooks under root (default: document),
    and gives a warning or danger Chip its glyph when it has none. */
export declare function hydrate(root?: ParentNode): void;
export declare const icons: string[];
export declare const geometry: { centre: 240; inner: 212; outer: 234; notch: 204; arcs: Record<'left' | 'right' | 'full', { start: number; sweep: number; n: number }>; tickAngles(arc: 'left' | 'right' | 'full'): number[]; litCount(fraction: number, n: number): number; notchIndex(fraction: number, n: number): number };
