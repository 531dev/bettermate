import { groupColors } from '../../utils/analyzerUtils';

const GROUP_ICON_BY_KEY = {
  basics: 'clock',
  pressure: 'gauge',
  target_pressure: 'sliders-horizontal',
  flow: 'droplet',
  target_flow: 'sliders-horizontal',
  puckflow: 'sliders-horizontal',
  puckresistance: 'gauge',
  liquidresistance: 'gauge',
  temp: 'thermometer',
  target_temp: 'sliders-horizontal',
  weight: 'scale',
  weightflow: 'scale',
  system: 'settings',
};

const WATER_ICON_COLOR = 'var(--analyzer-water)';

export function getAnalyzerGroupVisual(groupKey) {
  const colors = groupColors[groupKey] || groupColors.basics;
  return {
    icon: GROUP_ICON_BY_KEY[groupKey] || 'clock',
    color: colors.anchor,
  };
}

export function getAnalyzerColumnVisual(column) {
  if (column?.id === 'duration') {
    return {
      icon: 'clock',
      color: groupColors.basics.anchor,
    };
  }

  if (column?.id === 'water') {
    return {
      icon: 'droplet',
      color: WATER_ICON_COLOR,
    };
  }

  return getAnalyzerGroupVisual(column?.group);
}

export function getAnalyzerGroupCardVisuals(groupKey) {
  if (groupKey === 'basics') {
    return [
      { icon: 'clock', color: groupColors.basics.anchor },
      { icon: 'droplet', color: WATER_ICON_COLOR },
    ];
  }

  return [getAnalyzerGroupVisual(groupKey)];
}
