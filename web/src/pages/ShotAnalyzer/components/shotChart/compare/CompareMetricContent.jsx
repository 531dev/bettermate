import { Icon } from '../../../../../components/Icon.jsx';
import { IconButton } from '../../../ui/IconButton.jsx';
import { ShotBadge } from '../../../ui/ShotBadge.jsx';
import {
  CompareSelect,
  CompareTargetSelect,
  LegendDisclosure,
  SHOT_CHART_PRIMARY_LEGEND_LABELS,
  ShotChartLegendToggles,
} from '../ShotChartControls';
import { COMPARE_DETAIL_METRIC_PAGE_KEYS, UNIT_BY_LABEL } from '../constants';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from '../labelVisuals';
import {
  ChartMetricValue,
  MobileMetricGrid,
  MobileMetricPager,
  MobileMetricValue,
} from '../MobileMetricPager';
import {
  MOBILE_COMPARE_CONTEXT_LABEL_SET,
  MOBILE_COMPARE_FIXED_SERIES_LABELS,
} from './compareConstants';

export function getMainChartTitleContent({
  legendColorByLabel,
  shotStylePreset,
  showMainChartTitle,
}) {
  if (shotStylePreset === 'statistics') {
    return (
      <CompareChartTitle
        title='Pressure and pump flow'
        variant='statisticsMain'
        icons={[
          {
            key: 'pressure',
            icon: getShotChartLabelIcon('Pressure'),
            color: legendColorByLabel.Pressure || null,
          },
          {
            key: 'flow',
            icon: getShotChartLabelIcon('Pump Flow'),
            color: legendColorByLabel['Pump Flow'] || null,
          },
        ]}
      />
    );
  }

  if (showMainChartTitle) return <CompareChartTitle title='Compare overlay' />;
  return null;
}

export function getMainEmptyStaticTooltipContent({
  compareEntries,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
}) {
  if (shouldUseStatisticsMobileCompactLayout) {
    return <StatisticsChartMetricSummary compareEntries={compareEntries} variant='mobileCompact' />;
  }
  if (shouldUseAnalyzerMobileCompareLayout) {
    return <CompareMobileMetricPreview compareEntries={compareEntries} />;
  }
  return null;
}

export function getDetailEmptyStaticTooltipContent({
  activeMetricPageKey = null,
  chart,
  compareEntries,
  onMetricPageChange = null,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
}) {
  const metricLabel = chart.tooltipBaseLabel || chart.title;

  if (shouldUseStatisticsMobileCompactLayout) {
    return (
      <StatisticsChartMetricSummary
        compareEntries={compareEntries}
        metricLabel={metricLabel}
        variant='mobileCompact'
      />
    );
  }
  if (shouldUseAnalyzerMobileCompareLayout) {
    return (
      <CompareMobileMetricPreview
        activePageKey={activeMetricPageKey}
        compareEntries={compareEntries}
        metricLabel={metricLabel}
        onPageChange={onMetricPageChange}
      />
    );
  }
  return null;
}

export function CompareMobileLegend({
  hiddenLegendLabels,
  isExpanded,
  hasWeightData,
  hasWeightFlowData,
  legendColorByLabel,
  onLegendToggle,
  onToggleExpanded,
  visibility,
}) {
  const handleMobileLegendToggle = label => {
    if (
      MOBILE_COMPARE_CONTEXT_LABEL_SET.has(label) ||
      label === 'Puck Resistance' ||
      label === 'Liquid Resistance'
    ) {
      onLegendToggle(label);
    }
  };

  return (
    <div className='shot-chart-scrubber-legend shot-chart-scrubber-legend--mobile'>
      <ShotChartLegendToggles
        labels={SHOT_CHART_PRIMARY_LEGEND_LABELS}
        hiddenLegendLabels={hiddenLegendLabels}
        hasWeightData={hasWeightData}
        hasWeightFlowData={hasWeightFlowData}
        isControlsLocked={false}
        legendColorByLabel={legendColorByLabel}
        onLegendToggle={handleMobileLegendToggle}
        visibility={visibility}
        className='contents'
      />
      <LegendDisclosure expanded={isExpanded} onToggle={onToggleExpanded} />
      {isExpanded ? (
        <ShotChartLegendToggles
          labels={MOBILE_COMPARE_FIXED_SERIES_LABELS}
          hiddenLegendLabels={hiddenLegendLabels}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={false}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={handleMobileLegendToggle}
          visibility={visibility}
          className='contents'
        />
      ) : null}
    </div>
  );
}

export function CompareMobileShotSwitcher({ compareShotLegendItems, onCompareSwap }) {
  if (!Array.isArray(compareShotLegendItems) || compareShotLegendItems.length === 0) return null;

  const shotItems = compareShotLegendItems.slice(0, 2);

  return (
    <div className='shot-chart-compare-mobile-shot-switcher' aria-label='Compare shots'>
      <div className='shot-chart-compare-mobile-shot-switcher__slot'>
        <CompareMobileShotSwitcherItem item={shotItems[0]} />
      </div>
      <div className='shot-chart-compare-mobile-shot-switcher__swap-slot'>
        {shotItems.length > 1 && onCompareSwap ? (
          <IconButton
            icon='refresh-cw'
            label='Swap shot 1 and shot 2'
            size='sm'
            onClick={onCompareSwap}
          />
        ) : null}
      </div>
      <div className='shot-chart-compare-mobile-shot-switcher__slot'>
        <CompareMobileShotSwitcherItem item={shotItems[1]} />
      </div>
    </div>
  );
}

function CompareMobileShotSwitcherItem({ item }) {
  if (!item) return null;

  const label = item.label || `Shot ${item.shotNumber || ''}`.trim();

  return (
    <div className='shot-chart-compare-mobile-shot-switcher__item' title={label}>
      <ShotBadge number={item.shotNumber} />
      <span className='shot-chart-compare-mobile-shot-switcher__label'>{label}</span>
    </div>
  );
}

export function CompareMobileChartControls({
  compareAlignmentMode,
  compareAlignmentOptions,
  compareTargetDisplayMode,
  onCompareAlignmentModeChange,
  onCompareTargetDisplayModeChange,
}) {
  const shouldShowAlignment =
    onCompareAlignmentModeChange &&
    Array.isArray(compareAlignmentOptions) &&
    compareAlignmentOptions.length > 0;
  const shouldShowTargets = Boolean(onCompareTargetDisplayModeChange);

  if (!shouldShowAlignment && !shouldShowTargets) return null;

  return (
    <div className='shot-chart-compare-mobile-chart-controls'>
      {shouldShowAlignment ? (
        <CompareSelect
          onChange={onCompareAlignmentModeChange}
          options={compareAlignmentOptions}
          title='Compare alignment'
          value={compareAlignmentMode}
          widthClass='w-36'
        />
      ) : null}
      {shouldShowTargets ? (
        <CompareTargetSelect
          compareTargetDisplayMode={compareTargetDisplayMode}
          onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        />
      ) : null}
    </div>
  );
}

export function getDetailChartUnitLabel(chart) {
  return UNIT_BY_LABEL[chart.tooltipBaseLabel] || UNIT_BY_LABEL[chart.title] || '';
}

function formatCompareChartTitle(title) {
  if (typeof title !== 'string' || title.length === 0) return '';
  if (title.includes(' ')) return title;
  return `${title.charAt(0).toUpperCase()}${title.slice(1).toLowerCase()}`;
}

function getCompareChartLegendTitleData({ iconColor, icons, labelKey, title, variant }) {
  if (variant === 'statisticsMain') {
    return {
      displayLabel: title,
      titleIcons: Array.isArray(icons) ? icons : [],
    };
  }

  const resolvedLabelKey = labelKey || title;
  const icon = getShotChartLabelIcon(resolvedLabelKey);
  return {
    displayLabel: formatCompareChartTitle(getShotChartDisplayLabel(resolvedLabelKey)),
    titleIcons: icon ? [{ key: resolvedLabelKey, icon, color: iconColor }] : [],
  };
}

export function CompareChartTitle({
  title,
  labelKey,
  variant = 'default',
  iconColor = null,
  icons = null,
}) {
  if (!title) return null;

  if (variant === 'legend' || variant === 'statisticsMain') {
    const { displayLabel, titleIcons } = getCompareChartLegendTitleData({
      iconColor,
      icons,
      labelKey,
      title,
      variant,
    });

    return (
      <div className='shot-chart-statistics-chart-title'>
        {titleIcons.map(item => (
          <Icon
            key={item.key || item.label}
            name={item.icon}
            size={18}
            style={item.color ? { color: item.color } : undefined}
          />
        ))}
        <span className='bm-eyebrow'>{displayLabel}</span>
      </div>
    );
  }

  return <div className='bm-eyebrow'>{title}</div>;
}

function CompareMobileTooltipPlaceholder() {
  return null;
}

function CompareMobileTitleOnlyPlaceholder() {
  return null;
}

function averageFiniteValues(values) {
  const finiteValues = values.map(Number).filter(Number.isFinite);
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function getStatisticsMetricDefinitions(metricLabel = null) {
  const metricDefinitionsByLabel = {
    Pressure: [
      {
        key: 'peakPressure',
        label: 'Avg. peak pressure',
        unit: 'bar',
        getValue: total => total?.p?.max,
      },
    ],
    'Pump Flow': [
      {
        key: 'flow',
        label: 'Avg. pump flow',
        unit: 'ml/s',
        getValue: total => total?.f?.avg,
      },
    ],
    'Puck Flow': [
      {
        key: 'puckFlow',
        label: 'Avg. puck flow',
        unit: 'ml/s',
        getValue: total => total?.pf?.avg,
      },
    ],
    'Puck Resistance': [
      {
        key: 'puckResistance',
        label: 'Avg. puck resistance',
        unit: 's·√bar/mL',
        getValue: total => total?.pr?.avg,
      },
    ],
    'Liquid Resistance': [
      {
        key: 'liquidResistance',
        label: 'Avg. liquid resistance',
        unit: 'bar·s/mL',
        getValue: total => total?.lr?.avg,
      },
    ],
    Weight: [
      {
        key: 'weight',
        label: 'Weight',
        unit: 'g',
        getValue: total => total?.weight,
      },
    ],
    'Weight Flow': [
      {
        key: 'weightFlow',
        label: 'Avg. weight flow',
        unit: 'g/s',
        getValue: total => total?.wf?.avg,
      },
    ],
    Temp: [
      {
        key: 'temperature',
        label: 'Avg. temperature',
        unit: '\u2103',
        getValue: total => total?.t?.avg,
      },
    ],
  };

  if (metricLabel) return metricDefinitionsByLabel[metricLabel] || [];

  return [
    {
      key: 'peakPressure',
      label: 'Peak pressure',
      unit: 'bar',
      getValue: total => total?.p?.max,
    },
    {
      key: 'flow',
      label: 'Pump flow',
      unit: 'ml/s',
      getValue: total => total?.f?.avg,
    },
  ];
}

function getStatisticsMetricSummaryRows(compareEntries, metricLabel = null) {
  const totals = compareEntries.map(entry => entry?.results?.total).filter(Boolean);
  if (totals.length === 0) return [];

  return getStatisticsMetricDefinitions(metricLabel)
    .map(definition => ({
      ...definition,
      value: averageFiniteValues(totals.map(total => definition.getValue(total))),
    }))
    .filter(row => Number.isFinite(Number(row.value)));
}

export function StatisticsChartMetricSummary({
  compareEntries,
  metricLabel = null,
  variant = 'desktop',
}) {
  const rows = getStatisticsMetricSummaryRows(compareEntries, metricLabel);
  if (rows.length === 0) {
    return variant === 'mobileCompact' ? <CompareMobileTitleOnlyPlaceholder /> : null;
  }
  const isMobileCompact = variant === 'mobileCompact';

  return (
    <div
      className={[
        'shot-chart-statistics-metric-summary',
        isMobileCompact ? 'shot-chart-statistics-metric-summary--mobile' : '',
        isMobileCompact ? 'shot-chart-statistics-metric-summary--mobile-compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label='Statistics chart averages'
    >
      {rows.map(row =>
        isMobileCompact ? (
          <MobileMetricValue key={row.key} row={row} />
        ) : (
          <ChartMetricValue
            key={row.key}
            className='shot-chart-statistics-metric-summary__item'
            row={row}
          />
        ),
      )}
    </div>
  );
}

function getCompareMobileMetricRows(entry) {
  const total = entry?.results?.total;
  return [
    {
      key: 'duration',
      label: 'Duration',
      unit: 's',
      getValue: nextTotal => nextTotal?.duration,
    },
    {
      key: 'weight',
      label: 'Weight',
      unit: 'g',
      getValue: nextTotal => nextTotal?.weight,
    },
    {
      key: 'targetTemperature',
      label: 'Temp',
      unit: '\u2103',
      getValue: nextTotal => nextTotal?.tt?.avg,
    },
  ]
    .map(row => ({
      ...row,
      value: row.getValue(total),
    }))
    .filter(row => Number.isFinite(Number(row.value)));
}

function resolveCompareMobileMetricRow(entry, row) {
  const value = row.getValue(entry?.results?.total);
  return Number.isFinite(Number(value)) ? { ...row, value } : null;
}

function getCompareMobileDetailMetricDefinitions(labelKey, pageKey = null) {
  if (labelKey === 'Pump Flow') {
    const pumpFlowRow = {
      key: 'flow',
      label: 'Avg. pump flow',
      unit: 'ml/s',
      getValue: total => total?.f?.avg,
    };
    const pumpedWaterRow = {
      key: 'pumpedWater',
      label: 'Pumped water',
      unit: 'ml',
      getValue: total => total?.water,
    };

    if (pageKey === COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMPED_WATER) return [pumpedWaterRow];
    return [pumpFlowRow];
  }

  const detailRowsByLabel = {
    Pressure: {
      key: 'pressure',
      label: 'Avg. pressure',
      unit: 'bar',
      getValue: nextTotal => nextTotal?.p?.avg,
    },
    'Puck Flow': {
      key: 'puckFlow',
      label: 'Avg. puck flow',
      unit: 'ml/s',
      getValue: nextTotal => nextTotal?.pf?.avg,
    },
    'Puck Resistance': {
      key: 'puckResistance',
      label: 'Avg. puck resistance',
      unit: 's·√bar/mL',
      getValue: nextTotal => nextTotal?.pr?.avg,
    },
    'Liquid Resistance': {
      key: 'liquidResistance',
      label: 'Avg. liquid resistance',
      unit: 'bar·s/mL',
      getValue: nextTotal => nextTotal?.lr?.avg,
    },
    Weight: {
      key: 'weight',
      label: 'Weight',
      unit: 'g',
      getValue: nextTotal => nextTotal?.weight,
    },
    'Weight Flow': {
      key: 'weightFlow',
      label: 'Avg. weight flow',
      unit: 'g/s',
      getValue: nextTotal => nextTotal?.wf?.avg,
    },
    Temp: {
      key: 'temperature',
      label: 'Avg. temperature',
      unit: '\u2103',
      getValue: nextTotal => nextTotal?.t?.avg,
    },
  };
  const row = detailRowsByLabel[labelKey];
  return row ? [row] : [];
}

function getCompareMobileDetailMetricRows(entry, labelKey, pageKey = null) {
  return getCompareMobileDetailMetricDefinitions(labelKey, pageKey)
    .map(row => resolveCompareMobileMetricRow(entry, row))
    .filter(Boolean);
}

function getCompareMobileDetailMetricPages(compareEntries, metricLabel) {
  if (metricLabel !== 'Pump Flow') return [];

  return [COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMP_FLOW, COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMPED_WATER]
    .map(pageKey => ({
      key: pageKey,
      previewEntries: compareEntries.slice(0, 2).map(entry => ({
        entry,
        rows: getCompareMobileDetailMetricRows(entry, metricLabel, pageKey),
      })),
    }))
    .filter(page => page.previewEntries.some(previewEntry => previewEntry.rows.length > 0));
}

function CompareMobileMetricGrid({ metricLabel = null, previewEntries }) {
  const hasMetrics = previewEntries.some(previewEntry => previewEntry.rows.length > 0);

  if (!hasMetrics) {
    return <CompareMobileTooltipPlaceholder />;
  }

  return (
    <MobileMetricGrid
      ariaLabel='Compare shot metrics'
      className={metricLabel ? 'shot-chart-compare-mobile-metrics--detail' : ''}
      entries={previewEntries.map(({ entry, rows }, index) => ({
        key: entry.key || entry.label || index,
        rows,
      }))}
    />
  );
}

function CompareMobileMetricPreview({
  activePageKey = null,
  compareEntries,
  metricLabel = null,
  onPageChange = null,
}) {
  const metricPages = metricLabel
    ? getCompareMobileDetailMetricPages(compareEntries, metricLabel)
    : [];
  const shouldUsePager = metricPages.length > 1 && typeof onPageChange === 'function';

  if (shouldUsePager) {
    const activePage =
      metricPages.find(page => page.key === activePageKey) || metricPages[0] || null;
    if (!activePage) return <CompareMobileTooltipPlaceholder />;

    return (
      <MobileMetricPager
        activePageKey={activePage.key}
        onPageChange={onPageChange}
        pages={metricPages}
        renderPage={page => (
          <CompareMobileMetricGrid metricLabel={metricLabel} previewEntries={page.previewEntries} />
        )}
      />
    );
  }

  const previewEntries = compareEntries.slice(0, 2).map(entry => ({
    entry,
    rows: metricLabel
      ? getCompareMobileDetailMetricRows(entry, metricLabel, metricPages[0]?.key || activePageKey)
      : getCompareMobileMetricRows(entry),
  }));

  return <CompareMobileMetricGrid metricLabel={metricLabel} previewEntries={previewEntries} />;
}
