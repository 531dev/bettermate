import { cx } from '../../../../../components/cx.js';
import { Icon } from '../../../../../components/Icon.jsx';
import { LEGEND_DASHED_LABELS, LEGEND_ORDER, VISIBILITY_KEY_BY_LABEL } from '../constants';
import { getShotChartDisplayLabel } from '../labelVisuals';
import '../../../ui/tool.css';

export const SHOT_CHART_PRIMARY_LEGEND_LABELS = ['Phases', 'Stops'];
export const SHOT_CHART_SERIES_LEGEND_LABELS = LEGEND_ORDER.filter(
  label => !SHOT_CHART_PRIMARY_LEGEND_LABELS.includes(label),
);

function getRenderableLegendLabels({
  labels,
  hiddenLegendLabels,
  hasWeightData,
  hasWeightFlowData,
}) {
  return labels.filter(label => {
    if (hiddenLegendLabels.includes(label)) return false;
    if (label === 'Weight' && !hasWeightData) return false;
    if (label === 'Weight Flow' && !hasWeightFlowData) return false;
    return true;
  });
}

/**
 * The legend of a shot chart: neutral chips, each with the mark of its series (a dot, or a short
 * dashed stroke for a series that draws dashed) and the series name. Pressing a chip shows or
 * hides its series; a hidden series keeps its word and loses its fill.
 *   legendColorByLabel  the series colour of each label as a CSS value (`var(--token)`)
 */
export function ShotChartLegendToggles({
  labels = LEGEND_ORDER,
  hiddenLegendLabels = [],
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  legendColorByLabel,
  onLegendToggle,
  visibility,
  className = 'an-legend min-w-0',
}) {
  const renderableLabels = getRenderableLegendLabels({
    labels,
    hiddenLegendLabels,
    hasWeightData,
    hasWeightFlowData,
  });

  if (renderableLabels.length === 0) return null;

  return (
    <div className={className}>
      {renderableLabels.map(label => {
        const key = VISIBILITY_KEY_BY_LABEL[label];
        const isVisible = key ? Boolean(visibility[key]) : false;

        return (
          <button
            key={label}
            type='button'
            onClick={() => onLegendToggle(label)}
            aria-pressed={isVisible}
            disabled={isControlsLocked}
            className='bm-chip an-chipbtn'
          >
            <i
              className={cx(
                'an-legend__dot',
                LEGEND_DASHED_LABELS.has(label) && 'an-legend__dot--dashed',
              )}
              style={{ '--an-series': legendColorByLabel[label] }}
            />
            {getShotChartDisplayLabel(label)}
          </button>
        );
      })}
    </div>
  );
}

/** On a phone the series chips fold away behind this chip-shaped disclosure. */
export function LegendDisclosure({ expanded, onToggle }) {
  return (
    <button
      type='button'
      className='bm-chip an-chipbtn'
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {expanded ? 'Fewer series' : 'All series'}
      <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
    </button>
  );
}

export function ChartLegendArea({
  hiddenLegendLabels,
  hiddenMobileLegendLabels,
  hasWeightData,
  hasWeightFlowData,
  isControlsLocked,
  isMobile,
  legendColorByLabel,
  onLegendToggle,
  showMobileLegend,
  visibleMobileLegendLabels,
  visibleTopLegendLabels,
  visibility,
}) {
  if (isMobile && !showMobileLegend) return <div className='min-w-0 flex-1' />;

  return (
    <ShotChartLegendToggles
      labels={isMobile ? visibleMobileLegendLabels : visibleTopLegendLabels}
      hiddenLegendLabels={
        isMobile ? [...hiddenLegendLabels, ...hiddenMobileLegendLabels] : hiddenLegendLabels
      }
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      isControlsLocked={isControlsLocked}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={onLegendToggle}
      visibility={visibility}
      className='an-legend min-w-0 flex-1'
    />
  );
}
