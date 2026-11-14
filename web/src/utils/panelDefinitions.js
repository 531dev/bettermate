/**
 * The tiles of the Customize dashboard, which the user orders and hides in Dashboard Settings.
 * The ids are those of the earlier panels, so a stored arrangement keeps its meaning:
 *
 *   mode       the Dial tile. The mode controls themselves are the one floating mode bar.
 *   action     the ActionBanner
 *   metrics    the readings chosen in utils/metricDefinitions.js, as StatTiles
 *   favorites  favourite profiles and the targets
 *   profile    the profile curve
 *   watertank  the water tank reading on a row of its own
 *
 * Fields:
 *   id         stored in localStorage to represent order and visibility
 *   label      the tile's name in Dashboard Settings
 *   required   always shown: it can be moved, never hidden. Each of these holds controls that
 *              have no other home (flush, start and stop, the targets).
 *   available  (ds) => bool, with ds from useDashboardState(): false keeps the tile off the dashboard
 *   availableInSettings  (status) => bool, the same question asked of the raw machine status
 */
export const PANEL_DEFINITIONS = [
  { id: 'mode', label: 'Machine dial', required: true, available: () => true },
  { id: 'action', label: 'Action', required: true, available: () => true },
  { id: 'metrics', label: 'Readings', required: false, available: () => true },
  { id: 'favorites', label: 'Profile and targets', required: true, available: () => true },
  { id: 'profile', label: 'Profile curve', required: false, available: ds => ds.mode !== 4 },
  {
    id: 'watertank',
    label: 'Water tank',
    required: false,
    available: ds => ds.waterLevelPercent !== null,
    availableInSettings: status => !!status.tofDistance,
  },
];

const byId = id => PANEL_DEFINITIONS.find(panel => panel.id === id);

/**
 * A stored order as it is used: ids that are no longer tiles are dropped, and a required tile
 * the order does not name goes at the end.
 */
export function panelIds(order) {
  const known = [...new Set(order)].filter(byId);
  const missing = PANEL_DEFINITIONS.filter(panel => panel.required && !known.includes(panel.id));
  return [...known, ...missing.map(panel => panel.id)];
}
