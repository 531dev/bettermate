/** Orchestrates the single- and compare-shot analysis table layouts. */

import { Fragment } from 'preact';
import { useRef } from 'preact/hooks';
import { Tile } from '../../../../components/Tile.jsx';
import { cleanName, columnConfig } from '../../utils/analyzerUtils';
import { ShotBadge } from '../../ui/ShotBadge.jsx';
import './analysisTable.css';
import { ColumnControls } from './ColumnControls';
import {
  AnalysisTableHeader,
  AnalysisTableToolbarActions,
  StatusBadge,
} from './AnalysisTableChrome';
import { CellContent, ComparePhaseLabel } from './AnalysisTableCells';
import {
  buildAnalysisWarningBadges,
  getMaxComparePhaseCount,
  hasAnalysisProfilePhaseStops,
} from './analysisTableModel';
import {
  getAnalysisTouchInteractionStyle,
  scrollAnalysisTable,
  scrollAnalysisTableToBound,
  useTouchOptimizedPointer,
  useVerticalWheelForwarding,
} from './useAnalysisTableInteraction';

export function AnalysisTable({
  results,
  compareEntries = [],
  isCompareActive = false,
  activeColumns,
  onColumnsChange,
}) {
  const compareMode = isCompareActive && Array.isArray(compareEntries) && compareEntries.length > 1;

  const isTouchOptimized = useTouchOptimizedPointer();

  const tableContainerRef = useRef(null);
  const visibleColumns = columnConfig.filter(col => activeColumns.has(col.id));
  const compareTableColumnCount = visibleColumns.length + 2;
  const maxComparePhaseCount = getMaxComparePhaseCount(compareMode, compareEntries);
  const hasProfilePhaseStops = hasAnalysisProfilePhaseStops(results);

  const scrollTable = amount => scrollAnalysisTable(tableContainerRef, amount);
  const scrollToBound = direction => scrollAnalysisTableToBound(tableContainerRef, direction);

  useVerticalWheelForwarding(tableContainerRef);

  if (!results?.phases && !compareMode) return null;

  const touchInteractionStyle = getAnalysisTouchInteractionStyle(isTouchOptimized);
  const analysisWarningBadges = buildAnalysisWarningBadges(results);

  const compareShotCell = (entry, compareIndex, withProfile) => (
    <td className='whitespace-nowrap'>
      <span className='flex min-w-0 items-center gap-2'>
        <ShotBadge number={compareIndex + 1} />
        <span className='bm-label min-w-0 truncate'>{entry.label}</span>
      </span>
      {withProfile && entry.profileName && entry.profileName !== 'No Profile Loaded' ? (
        <span className='bm-tick block'>{cleanName(entry.profileName)}</span>
      ) : null}
    </td>
  );

  return (
    <Tile data-analysis-table>
      <div className='bm-tile__head flex-wrap'>
        <span className='bm-eyebrow'>Phase analysis</span>
        {analysisWarningBadges.length > 0 && (
          <div className='flex flex-wrap items-center gap-1.5'>
            {analysisWarningBadges.map(badge => (
              <StatusBadge
                key={badge.key}
                label={badge.label}
                tone={badge.tone}
                details={badge.details}
              />
            ))}
          </div>
        )}
      </div>

      <ColumnControls
        activeColumns={activeColumns}
        onColumnsChange={onColumnsChange}
        headerChildren={
          <AnalysisTableToolbarActions
            onScrollTable={scrollTable}
            onScrollToBound={scrollToBound}
          />
        }
      />

      <div
        ref={tableContainerRef}
        // no overscroll containment here: it would latch the page's own scroll
        className='an-scroll--none w-full overflow-x-auto overflow-y-hidden'
        style={{ scrollBehavior: 'smooth', ...touchInteractionStyle }}
      >
        <table className='bm-table an-table'>
          <AnalysisTableHeader
            compareMode={compareMode}
            hasProfilePhaseStops={hasProfilePhaseStops}
            visibleColumns={visibleColumns}
          />

          {compareMode ? (
            <tbody>
              {Array.from({ length: maxComparePhaseCount }, (_, phaseIndex) => (
                <Fragment key={`phase-group-${phaseIndex}`}>
                  <tr className='an-table__group'>
                    <td colSpan={compareTableColumnCount}>Phase {phaseIndex + 1}</td>
                  </tr>
                  {compareEntries.map((entry, compareIndex) => {
                    const phase = entry?.results?.phases?.[phaseIndex] || null;

                    return (
                      <tr key={`${entry.key}-phase-${phaseIndex}`} className='an-table__row'>
                        {compareShotCell(entry, compareIndex, true)}
                        <td className='whitespace-nowrap'>
                          <ComparePhaseLabel
                            phase={phase}
                            phaseIndex={phaseIndex}
                            results={entry.results}
                          />
                        </td>
                        {visibleColumns.map(col => (
                          <td
                            key={`${entry.key}-${phaseIndex}-${col.id}`}
                            className='text-right whitespace-nowrap'
                          >
                            <CellContent phase={phase} col={col} results={entry.results} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}

              <tr className='an-table__group'>
                <td colSpan={compareTableColumnCount}>Totals</td>
              </tr>
              {compareEntries.map((entry, compareIndex) => (
                <tr key={`${entry.key}-total`} className='an-table__row an-table__total'>
                  {compareShotCell(entry, compareIndex, false)}
                  <td className='whitespace-nowrap'>Total</td>
                  {visibleColumns.map(col => (
                    <td
                      key={`${entry.key}-total-${col.id}`}
                      className='text-right whitespace-nowrap'
                    >
                      <CellContent phase={null} col={col} results={entry.results} isTotal={true} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : (
            <>
              <tbody>
                {results.phases.map((phase, idx) => (
                  <tr
                    key={
                      phase.key ||
                      [
                        phase.number,
                        phase.displayName || phase.name,
                        phase.start,
                        phase.end,
                        phase.exit?.reason,
                      ]
                        .filter(value => value !== null && value !== undefined && value !== '')
                        .join('-')
                    }
                    className='an-table__row'
                  >
                    <td className='an-table__index'>{idx + 1}</td>
                    <td className='whitespace-nowrap'>
                      <ComparePhaseLabel phase={phase} phaseIndex={idx} results={results} />
                    </td>
                    {visibleColumns.map(col => (
                      <td key={col.id} className='text-right whitespace-nowrap'>
                        <CellContent phase={phase} col={col} results={results} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className='an-table__total'>
                  <td />
                  <td>Total</td>
                  {visibleColumns.map(col => (
                    <td key={col.id} className='text-right whitespace-nowrap'>
                      <CellContent phase={null} col={col} results={results} isTotal={true} />
                    </td>
                  ))}
                </tr>
              </tfoot>
            </>
          )}
        </table>
      </div>

      <p className='bm-caption flex flex-wrap gap-x-4 gap-y-1'>
        <span>Avg: time-weighted average</span>
        <span>S/E: start and end</span>
        <span>Min/max: lowest and highest</span>
      </p>
    </Tile>
  );
}
