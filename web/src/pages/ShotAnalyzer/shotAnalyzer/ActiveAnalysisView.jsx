/** Renders the responsive chart, details, and analysis-table composition. */

/* global globalThis */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from '../../../components/cx.js';
import { Icon } from '../../../components/Icon.jsx';
import { List, ListRow } from '../../../components/ListRow.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { AnalysisTable } from '../components/AnalysisTable';
import { ShotChart } from '../components/ShotChart';
import { ShotDetailsPanel, ShotMobilePrimaryCards } from '../components/ShotDetailsPanel';
import { IconButton } from '../../../components/IconButton.jsx';

export function buildShotDetailsEntries({
  isCompareActive,
  compareCollection,
  referenceCompareEntry,
}) {
  if (isCompareActive) return compareCollection;
  return referenceCompareEntry ? [referenceCompareEntry] : [];
}

export function resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight) {
  setDesktopSingleDetailsHeight(prev => (prev === 0 ? prev : 0));
}

export function getDesktopSingleChartStyle(singleDesktopDetailsHeight) {
  if (!singleDesktopDetailsHeight) return undefined;
  return { height: `${singleDesktopDetailsHeight}px` };
}

// On a phone the summary, the chart and the details stack, each above the one before it, so a
// reading that overflows a tile is covered by the next one (chartLayout.css).
function getActiveAnalysisViewClasses(isCompareActive) {
  return {
    desktopStickyDetailsClass: isCompareActive ? 'analyzer-shot-details-sticky' : '',
    // A single shot's chart is one tile. In a comparison every chart is a tile of its own.
    chartShellClass: isCompareActive
      ? 'shot-chart-card-shell--compare'
      : 'bm-tile analyzer-mobile-stack-layer analyzer-mobile-stack-layer--chart lg:h-full',
    mobilePrimaryShellClass: 'analyzer-mobile-stack-layer analyzer-mobile-stack-layer--primary',
    mobileDetailsShellClass: isCompareActive
      ? 'max-lg:hidden'
      : 'analyzer-mobile-stack-layer analyzer-mobile-stack-layer--details',
  };
}

export function getCompareDetailsKey(isCompareActive, shotDetailsEntries) {
  if (!isCompareActive) return '';
  return shotDetailsEntries
    .map((entry, index) => entry?.key || entry?.shot?.id || entry?.shotName || index)
    .join('|');
}

/** The head of a page a phone opens from the analyzer: the way back, and what the page is. */
function MobileAnalyzerSubpageHeader({ onBack, subtitle, title }) {
  return (
    <div className='flex items-center gap-2'>
      <IconButton icon='arrow-left' iconSize={22} label='Back to the analyzer' onClick={onBack} />
      <div className='min-w-0'>
        <h2 className='bm-sub truncate'>{title}</h2>
        <p className='bm-help truncate'>{subtitle}</p>
      </div>
    </div>
  );
}

/** What a phone opens on a page of its own, as the rows of one tile. */
function MobileAnalyzerSubpageLinks({ links }) {
  if (links.length === 0) return null;

  return (
    <Tile className='analyzer-mobile-stack-layer analyzer-mobile-stack-layer--analysis lg:hidden'>
      <List>
        {links.map(link => (
          <ListRow
            key={link.page}
            icon={link.icon}
            title={link.title}
            meta={link.meta}
            end={<Icon name='chevron-right' size={20} />}
            onClick={link.onOpen}
          />
        ))}
      </List>
    </Tile>
  );
}

function getMobileAnalyzerSubpageMeta({ isCompareActive, showMobileAnalysisPage }) {
  if (!showMobileAnalysisPage) {
    return { subtitle: 'Details of the compared shots', title: 'Notes' };
  }
  return {
    subtitle: isCompareActive ? 'Both shots, phase by phase' : 'The shot, phase by phase',
    title: 'Analysis table',
  };
}

function getVerticalScrollContainer(element) {
  const browserWindow = globalThis.window;
  if (!browserWindow || !element) return null;

  let currentElement = element.parentElement;
  while (currentElement) {
    const overflowY = browserWindow.getComputedStyle(currentElement).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return currentElement;
    }
    currentElement = currentElement.parentElement;
  }

  return browserWindow.document.scrollingElement;
}

function scheduleAfterLayout(callback) {
  const browserWindow = globalThis.window;
  if (!browserWindow) {
    callback();
    return () => {};
  }

  const frameId = browserWindow.requestAnimationFrame(callback);
  return () => browserWindow.cancelAnimationFrame(frameId);
}

function scheduleAcrossLayoutFrames(callback) {
  let cancelFinalFrame = () => {};
  const cancelInitialFrame = scheduleAfterLayout(() => {
    callback();
    cancelFinalFrame = scheduleAfterLayout(callback);
  });

  return () => {
    cancelInitialFrame();
    cancelFinalFrame();
  };
}

function AnalyzerTable({
  activeColumns,
  analysisResults,
  compareCollection,
  isCompareActive,
  setActiveColumns,
}) {
  return (
    <AnalysisTable
      results={analysisResults}
      compareEntries={compareCollection}
      isCompareActive={isCompareActive}
      activeColumns={activeColumns}
      onColumnsChange={setActiveColumns}
    />
  );
}

export function ActiveAnalysisView({
  activeColumns,
  analysisResults,
  analysisSectionRef,
  chartMountKey,
  compareCollection,
  compareTargetDisplayMode,
  currentShot,
  currentProfile,
  handleSwapCompareSlots,
  isCompareActive,
  mobileSubpageNavigation,
  setActiveColumns,
  setCompareTargetDisplayMode,
  shotDetailsColumnRef,
  shotDetailsEntries,
  singleDesktopChartStyle,
  singleDesktopDetailsHeight,
}) {
  const {
    desktopStickyDetailsClass,
    chartShellClass,
    mobilePrimaryShellClass,
    mobileDetailsShellClass,
  } = getActiveAnalysisViewClasses(isCompareActive);
  const [activeCompareDetailsIndex, setActiveCompareDetailsIndex] = useState(0);
  const mobileSubpageRef = useRef(null);
  const mobileSubpageReturnScrollRef = useRef(null);
  const wasMobileSubpageOpenRef = useRef(false);
  const compareDetailsKey = getCompareDetailsKey(isCompareActive, shotDetailsEntries);
  const { closeMobileSubpage, mobileSubpage, openMobileSubpage } = mobileSubpageNavigation;
  const showCompareMobileDetailsPage = isCompareActive && mobileSubpage === 'notes';
  const showMobileAnalysisPage = mobileSubpage === 'analysis' && Boolean(analysisResults);
  const showMobileSubpage = showCompareMobileDetailsPage || showMobileAnalysisPage;
  const mobileSubpageMeta = getMobileAnalyzerSubpageMeta({
    isCompareActive,
    showMobileAnalysisPage,
  });

  useEffect(() => {
    setActiveCompareDetailsIndex(0);
  }, [compareDetailsKey, isCompareActive]);

  useLayoutEffect(() => {
    if (showMobileSubpage) {
      wasMobileSubpageOpenRef.current = true;
      return scheduleAcrossLayoutFrames(() => {
        mobileSubpageRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }

    if (!wasMobileSubpageOpenRef.current) return undefined;
    wasMobileSubpageOpenRef.current = false;
    const savedScroll = mobileSubpageReturnScrollRef.current;
    if (!savedScroll?.container) return undefined;

    return scheduleAcrossLayoutFrames(() => {
      savedScroll.container.scrollTop = savedScroll.top;
    });
  }, [showMobileSubpage]);

  const handleOpenMobileSubpage = useCallback(
    page => {
      const scrollContainer = getVerticalScrollContainer(analysisSectionRef.current);
      mobileSubpageReturnScrollRef.current = scrollContainer
        ? { container: scrollContainer, top: scrollContainer.scrollTop }
        : null;
      openMobileSubpage(page);
    },
    [analysisSectionRef, openMobileSubpage],
  );

  const mobileSubpageLinks = [
    isCompareActive && {
      page: 'notes',
      icon: 'square-pen',
      title: 'Notes',
      meta: 'Details of both shots',
      onOpen: () => handleOpenMobileSubpage('notes'),
    },
    analysisResults && {
      page: 'analysis',
      icon: 'list',
      title: 'Analysis table',
      meta: 'Phase by phase',
      onOpen: () => handleOpenMobileSubpage('analysis'),
    },
  ].filter(Boolean);

  const analysisTable = (
    <AnalyzerTable
      activeColumns={activeColumns}
      analysisResults={analysisResults}
      compareCollection={compareCollection}
      isCompareActive={isCompareActive}
      setActiveColumns={setActiveColumns}
    />
  );
  const shotDetailsPanel = (
    <ShotDetailsPanel
      entries={shotDetailsEntries}
      isCompareActive={isCompareActive}
      activeCompareIndex={activeCompareDetailsIndex}
      onActiveCompareIndexChange={setActiveCompareDetailsIndex}
    />
  );

  return (
    <div
      ref={analysisSectionRef}
      className='analyzer-mobile-scroll-target flex flex-col gap-2 lg:gap-3'
    >
      {showMobileSubpage ? (
        <div
          ref={mobileSubpageRef}
          className='analyzer-mobile-scroll-target flex flex-col gap-2 lg:hidden'
        >
          <MobileAnalyzerSubpageHeader
            onBack={closeMobileSubpage}
            title={mobileSubpageMeta.title}
            subtitle={mobileSubpageMeta.subtitle}
          />
          {showCompareMobileDetailsPage ? shotDetailsPanel : null}
          {showMobileAnalysisPage ? analysisTable : null}
        </div>
      ) : null}

      <div className={cx('flex flex-col gap-2 lg:gap-3', showMobileSubpage && 'max-lg:hidden')}>
        <div className='grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(14.5rem,17rem)] lg:items-start lg:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]'>
          <div className='flex min-w-0 flex-col gap-2 lg:gap-3'>
            {!isCompareActive && shotDetailsEntries[0]?.shot ? (
              <div className={mobilePrimaryShellClass}>
                <ShotMobilePrimaryCards entry={shotDetailsEntries[0]} />
              </div>
            ) : null}
            <div
              key={chartMountKey}
              className={cx('shot-chart-card-shell', chartShellClass)}
              style={singleDesktopChartStyle}
            >
              <ShotChart
                shotData={currentShot}
                profileData={currentProfile}
                results={analysisResults}
                compareEntries={compareCollection}
                isCompareActive={isCompareActive}
                desktopCardHeight={singleDesktopDetailsHeight}
                onCompareSwap={handleSwapCompareSlots}
                compareTargetDisplayMode={compareTargetDisplayMode}
                onCompareTargetDisplayModeChange={setCompareTargetDisplayMode}
              />
            </div>
          </div>
          <div
            ref={shotDetailsColumnRef}
            className={cx('min-w-0', desktopStickyDetailsClass, mobileDetailsShellClass)}
          >
            {shotDetailsPanel}
          </div>
        </div>

        <MobileAnalyzerSubpageLinks links={mobileSubpageLinks} />

        {analysisResults ? <div className='max-lg:hidden'>{analysisTable}</div> : null}
      </div>
    </div>
  );
}
