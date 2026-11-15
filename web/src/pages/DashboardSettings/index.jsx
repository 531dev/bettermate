import { useEffect, useState } from 'preact/hooks';
import { Field, Select, Setting, Switch } from '../../components/Field.jsx';
import { hidesModeBar } from '../../components/ModeNav.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import { PinnedAction } from '../../components/PinnedAction.jsx';
import { Segmented } from '../../components/Segmented.jsx';
import { SortableConfigurator } from '../../components/SettingsFormField.jsx';
import { Stepper } from '../../components/Stepper.jsx';
import { Tile } from '../../components/Tile.jsx';
import { machine } from '../../services/ApiService.js';
import {
  DASHBOARD_LAYOUTS,
  DASHBOARD_MODES,
  PROFILE_CHART_HEIGHT,
  RECENT_SHOT_COUNT,
  getDashboardLayout,
  getMetricOrder,
  getPanelOrder,
  getProfileChartHeight,
  getRecentShotCount,
  getShotMetricSlots,
  getShowRecentShots,
  setDashboardLayout,
  setDashboardMode,
  setMetricOrder as persistMetricOrder,
  setPanelOrder as persistPanelOrder,
  setProfileChartHeight,
  setRecentShotCount,
  setShotMetricSlots,
  setShowRecentShots,
} from '../../utils/dashboardManager.js';
import { METRIC_DEFINITIONS, metricById } from '../../utils/metricDefinitions.js';
import { PANEL_DEFINITIONS, panelIds } from '../../utils/panelDefinitions.js';

const LAYOUTS = [
  { value: DASHBOARD_LAYOUTS.ORDER_FIRST, label: 'Controls first' },
  { value: DASHBOARD_LAYOUTS.ORDER_LAST, label: 'Chart first' },
];

// The facts a recent shot's row can carry, by the key the dashboard reads.
const SHOT_FACTS = [
  ['duration', 'Duration'],
  ['weight', 'Weight'],
  ['avgTemp', 'Average temperature'],
  ['maxPressure', 'Max pressure'],
  ['avgFlow', 'Average flow'],
];
const SLOT_NAMES = ['First fact', 'Second fact', 'Third fact'];

// This page keeps the floating mode bar, so its pinned action sits just above the bar, where the
// page's own bottom padding ends.
const ABOVE_MODE_BAR =
  'bottom-[calc(var(--space-16)+24px+env(safe-area-inset-bottom))] lg:bottom-[calc(var(--space-16)+32px+env(safe-area-inset-bottom))]';

/**
 * What the Customize dashboard shows: its tiles and readings, in order, the chart's place and
 * the recent shots. Every change applies at once and is remembered on this device.
 */
export function DashboardSettings() {
  const [layout, setLayout] = useState(() => getDashboardLayout());
  const [curveHeight, setCurveHeight] = useState(() => getProfileChartHeight());
  // Ids that are no longer tiles or readings leave the lists, so every row can be moved.
  const [panelOrder, setPanelOrder] = useState(() => panelIds(getPanelOrder()));
  const [metricOrder, setMetricOrder] = useState(() => getMetricOrder().filter(metricById));
  const [showRecentShots, setShowRecent] = useState(() => getShowRecentShots());
  const [recentShotCount, setRecentCount] = useState(() => getRecentShotCount());
  const [shotFacts, setShotFacts] = useState(() => getShotMetricSlots());

  // Editing here means customizing: leave a fixed view and show the stored values.
  useEffect(() => {
    setDashboardMode(DASHBOARD_MODES.CUSTOM);
  }, []);

  const status = machine.value.status;
  const hiddenPanels = PANEL_DEFINITIONS.filter(
    panel =>
      !panel.required &&
      !panelOrder.includes(panel.id) &&
      (panel.availableInSettings ?? panel.available)(status),
  );
  const hiddenMetrics = METRIC_DEFINITIONS.filter(
    metric => !metricOrder.includes(metric.id) && metric.available(status),
  );

  const changeCurveHeight = height => {
    setCurveHeight(height);
    setProfileChartHeight(height);
  };
  const changeRecentCount = count => {
    setRecentCount(count);
    setRecentShotCount(count);
  };

  return (
    <PageLayout variant='narrow'>
      <PageHeader
        title='Dashboard settings'
        subtitle='What the Customize view shows. Changes apply at once, on this device.'
      />

      <Tile title='Layout'>
        <Field
          as='div'
          label='Show first'
          help='On a wide screen the chart sits beside the controls instead of above or below them.'
        >
          <Segmented
            block
            label='Show first'
            options={LAYOUTS}
            value={layout}
            onChange={next => {
              setLayout(next);
              setDashboardLayout(next);
            }}
          />
        </Field>
        {panelOrder.includes('profile') && (
          <Setting
            label='Profile curve height'
            help='For a profile that sets a pressure or a flow.'
          >
            <Stepper
              value={`${curveHeight} px`}
              onDecrease={() => changeCurveHeight(curveHeight - PROFILE_CHART_HEIGHT.STEP)}
              onIncrease={() => changeCurveHeight(curveHeight + PROFILE_CHART_HEIGHT.STEP)}
              canDecrease={curveHeight > PROFILE_CHART_HEIGHT.MIN}
              canIncrease={curveHeight < PROFILE_CHART_HEIGHT.MAX}
              decreaseLabel='Lower the profile curve'
              increaseLabel='Raise the profile curve'
            />
          </Setting>
        )}
      </Tile>

      <Tile title='Tiles'>
        <SortableConfigurator
          order={panelOrder}
          definitions={PANEL_DEFINITIONS}
          hidden={hiddenPanels}
          onOrderChange={ids => {
            setPanelOrder(ids);
            persistPanelOrder(ids);
          }}
          emptyMessage='Every tile is shown.'
        />
      </Tile>

      <Tile title='Readings'>
        <SortableConfigurator
          order={metricOrder}
          definitions={METRIC_DEFINITIONS}
          hidden={hiddenMetrics}
          onOrderChange={ids => {
            setMetricOrder(ids);
            persistMetricOrder(ids);
          }}
          emptyMessage='Every reading is shown.'
        />
      </Tile>

      <Tile title='Recent shots'>
        <Setting label='Show recent shots' htmlFor='showRecentShots'>
          <Switch
            id='showRecentShots'
            checked={showRecentShots}
            onChange={next => {
              setShowRecent(next);
              setShowRecentShots(next);
            }}
          />
        </Setting>
        {showRecentShots && (
          <>
            <Setting label='Shots to show'>
              <Stepper
                value={`${recentShotCount}`}
                onDecrease={() => changeRecentCount(recentShotCount - 1)}
                onIncrease={() => changeRecentCount(recentShotCount + 1)}
                canDecrease={recentShotCount > RECENT_SHOT_COUNT.MIN}
                canIncrease={recentShotCount < RECENT_SHOT_COUNT.MAX}
                decreaseLabel='Show fewer shots'
                increaseLabel='Show more shots'
              />
            </Setting>
            <Field as='div' label='Facts in each row'>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                {SLOT_NAMES.map((name, i) => (
                  <Select
                    key={name}
                    aria-label={name}
                    value={shotFacts[i]}
                    onChange={e => {
                      const next = [...shotFacts];
                      next[i] = e.target.value;
                      setShotFacts(next);
                      setShotMetricSlots(next);
                    }}
                  >
                    {SHOT_FACTS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
            </Field>
          </>
        )}
      </Tile>

      <PinnedAction href='/' className={!hidesModeBar('/dashboard-settings') && ABOVE_MODE_BAR}>
        Done
      </PinnedAction>
    </PageLayout>
  );
}
