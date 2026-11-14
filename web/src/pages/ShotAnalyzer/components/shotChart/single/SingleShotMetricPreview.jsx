import { ChartMetricValue, MobileMetricPager } from '../MobileMetricPager';
import { SINGLE_METRIC_PAGE_KEYS } from '../constants';

const PAGES = [
  { key: SINGLE_METRIC_PAGE_KEYS.BASICS, label: 'Basics' },
  { key: SINGLE_METRIC_PAGE_KEYS.PRESSURE_FLOW, label: 'Pressure and pump flow' },
  { key: SINGLE_METRIC_PAGE_KEYS.FLOW_VOLUME, label: 'Flow and volume' },
  { key: SINGLE_METRIC_PAGE_KEYS.TEMPERATURE, label: 'Temperature' },
  { key: SINGLE_METRIC_PAGE_KEYS.PUCK_RESISTANCE, label: 'Puck resistance' },
  { key: SINGLE_METRIC_PAGE_KEYS.ALL, label: 'All' },
];

// The shot's summary while nothing is scrubbed: what the details card adds to its three readings.
const SUMMARY_ROWS = [
  { key: 't', label: 'Avg. temperature', unit: '°C', getValue: total => total?.t?.avg },
  { key: 'pPeak', label: 'Peak pressure', unit: 'bar', getValue: total => total?.p?.max },
  { key: 'f', label: 'Avg. pump flow', unit: 'ml/s', getValue: total => total?.f?.avg },
  { key: 'water', label: 'Pumped water', unit: 'ml', getValue: total => total?.water },
];

/**
 * What the phone shows above its chart at rest: four readings of the whole shot, and a pager
 * that swipes between the sets of series the chart can draw.
 */
export function ShotChartStaticMetricPreview({ activePageKey, onPageChange, results }) {
  const activePage = PAGES.find(page => page.key === activePageKey) || PAGES[0];
  const rows = SUMMARY_ROWS.map(row => ({ ...row, value: row.getValue(results?.total) })).filter(
    row => Number.isFinite(Number(row.value)),
  );

  return (
    <div className='shot-chart-static-metric-preview'>
      <div className='shot-chart-static-metric-preview__grid'>
        {rows.map(row => (
          <ChartMetricValue key={row.key} row={row} />
        ))}
      </div>
      <MobileMetricPager
        activePageKey={activePage.key}
        className='shot-chart-mobile-metric-pager--caption'
        onPageChange={onPageChange}
        pages={PAGES}
        renderPage={page => (
          <div className='shot-chart-single-mobile-page-caption'>
            <span className='shot-chart-single-mobile-page-caption__label'>{page.label}</span>
            <span className='shot-chart-single-mobile-page-caption__hint'>Chart and metrics</span>
          </div>
        )}
      />
    </div>
  );
}
