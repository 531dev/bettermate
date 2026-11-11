// The colors along a gauge, bottom to top. The upright gauges and the dial's rim share them.
const SCALES = {
  // Cold to hot.
  temp: [
    [0, '#8db4f6'],
    [0.38, '#a9c6ee'],
    [0.62, '#e8dcb0'],
    [0.82, '#f0c48e'],
    [1, '#ef7f45'],
  ],
  pressure: [
    [0, '#b4b6fb'],
    [1, '#3b49f5'],
  ],
  // A level that is only a problem when it runs low.
  level: [
    [0, '#e8745a'],
    [0.25, '#d9a0a8'],
    [0.45, '#b4b6fb'],
    [1, '#b4b6fb'],
  ],
  // Rising from nothing towards full.
  fill: [
    [0, '#6db77f'],
    [0.2, '#8fc78a'],
    [0.45, '#d6d48c'],
    [0.65, '#edc26f'],
    [1, '#ef7f45'],
  ],
};

export const gaugeGradient = name => {
  const scale = SCALES[name];
  if (!scale) return undefined;
  const stops = scale.map(([at, color]) => `${color} ${at * 100}%`).join(', ');
  return `linear-gradient(to top, ${stops})`;
};

const channels = hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));

export function gaugeColor(name, position) {
  const scale = SCALES[name];
  const upper = scale.findIndex(([at]) => at >= position);
  if (upper <= 0) return scale[0][1];
  const [lowAt, low] = scale[upper - 1];
  const [highAt, high] = scale[upper];
  const mix = (position - lowAt) / (highAt - lowAt);
  const [a, b] = [channels(low), channels(high)];
  const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * mix));
  return `rgb(${mixed.join(' ')})`;
}
