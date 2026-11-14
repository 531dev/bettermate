import { CompareShotCharts } from '../../ShotAnalyzer/components/shotChart/CompareShotCharts';

export function StatisticsShotCompareSection({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  showTitle = true,
}) {
  if (!Array.isArray(compareEntries) || compareEntries.length === 0) return null;

  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      {showTitle && <h2 className='bm-sub px-1'>Shot charts</h2>}
      <CompareShotCharts
        compareEntries={compareEntries}
        compareTargetDisplayMode={compareTargetDisplayMode}
        onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        showPhaseAnnotations={false}
        showStopAnnotations={false}
        showBrewModeAnnotation={false}
        showCompareAnnotationToggle={false}
        enableDualMainChartAnnotations={false}
        showMainChartTitle={false}
        detailChartTitleVariant='legend'
        enableHoverInfo={true}
        compareTooltipMode='compareTitleOnly'
        showCompareShotLegend={false}
        shotStylePreset='statistics'
        showWeightInMainChart={false}
        showWeightFlowInMainChart={false}
      />
    </div>
  );
}
