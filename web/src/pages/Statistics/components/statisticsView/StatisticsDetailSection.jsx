// The detail section of a statistics run: its tabs and the panel of the selected one (metric
// averages, trends, shot charts, per-profile and per-phase statistics).
import TabBar from '../../../../components/TabBar.jsx';
import { StatisticsShotCompareSection } from '../StatisticsShotCompareSection';
import { MetricsTable } from '../MetricsTable';
import { ProfileGroupTable } from '../ProfileGroupTable';
import { PhaseStatistics } from '../PhaseStatistics';
import { TrendChart } from '../TrendChart';
import { ActivityHeatmap } from '../ActivityHeatmap';

function StatisticsDetailHeader({
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  setStatisticsDetailSection,
}) {
  const availableTabs = [
    hasMetricStatistics ? { id: 'metrics', label: 'Averages' } : null,
    hasTrendStatistics ? { id: 'trends', label: 'Trends' } : null,
    hasCompareStatistics ? { id: 'compare', label: 'Shot charts' } : null,
    hasProfileGroupStatistics ? { id: 'profile', label: 'Profiles' } : null,
    hasPhaseStatistics ? { id: 'phase', label: 'Phases' } : null,
  ].filter(Boolean);

  if (availableTabs.length > 1) {
    return (
      <TabBar
        tabs={availableTabs}
        activeTab={resolvedStatisticsDetailSection}
        onTabChange={setStatisticsDetailSection}
      />
    );
  }

  return <h2 className='bm-sub px-1'>{availableTabs[0]?.label || 'Statistics'}</h2>;
}

export function StatisticsDetailSectionPanel({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  result,
  setStatisticsDetailSection,
  hidePhaseExitReasons = false,
  chartRunKey = 'idle',
}) {
  const hasCompareStatistics = Array.isArray(compareEntries) && compareEntries.length > 0;

  if (
    !hasCompareStatistics &&
    !hasMetricStatistics &&
    !hasTrendStatistics &&
    !hasProfileGroupStatistics &&
    !hasPhaseStatistics
  ) {
    return null;
  }

  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      <StatisticsDetailHeader
        hasCompareStatistics={hasCompareStatistics}
        hasMetricStatistics={hasMetricStatistics}
        hasTrendStatistics={hasTrendStatistics}
        hasPhaseStatistics={hasPhaseStatistics}
        hasProfileGroupStatistics={hasProfileGroupStatistics}
        resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
        setStatisticsDetailSection={setStatisticsDetailSection}
      />

      <div
        role='tabpanel'
        id={`panel-${resolvedStatisticsDetailSection}`}
        className='flex flex-col gap-2 lg:gap-3'
      >
        {hasCompareStatistics && resolvedStatisticsDetailSection === 'compare' && (
          <StatisticsShotCompareSection
            key={`statistics-shot-charts-${chartRunKey}`}
            compareEntries={compareEntries}
            compareTargetDisplayMode={compareTargetDisplayMode}
            onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
            showTitle={false}
          />
        )}

        {hasMetricStatistics && resolvedStatisticsDetailSection === 'metrics' && (
          <MetricsTable metrics={result.metrics} />
        )}

        {hasTrendStatistics && resolvedStatisticsDetailSection === 'trends' && (
          <>
            <TrendChart key={`statistics-trends-${chartRunKey}`} trends={result.trends} />
            <ActivityHeatmap trends={result.trends} />
          </>
        )}

        {hasProfileGroupStatistics && resolvedStatisticsDetailSection === 'profile' && (
          <ProfileGroupTable profileGroups={result.profileGroups} showTitle={false} />
        )}

        {hasPhaseStatistics && resolvedStatisticsDetailSection === 'phase' && (
          <PhaseStatistics
            phaseStats={result.phaseStats}
            showTitle={false}
            hideExitReasons={hidePhaseExitReasons}
          />
        )}
      </div>
    </div>
  );
}
