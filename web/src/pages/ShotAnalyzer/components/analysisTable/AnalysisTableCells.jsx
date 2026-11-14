import { Icon } from '../../../../components/Icon.jsx';
import { cx } from '../../../../components/cx.js';
import { getDisplayStopReasonParts } from '../../utils/analyzerUtils';
import { isSafetyExitReason } from '../../services/analyzer/exitReasons.js';

export function ComparePhaseLabel({ phase, results }) {
  if (!phase) {
    return <span className='text-(--ink-muted)'>—</span>;
  }

  const { skipNotice, stopReason } = getDisplayStopReasonParts(phase.exit?.reason);
  const safetyStop = isSafetyExitReason(phase.exit?.code);

  return (
    <>
      <span className='an-label block'>{phase.displayName}</span>
      {skipNotice ? <span className='an-tick block'>{skipNotice}</span> : null}
      {/* A stop reason is a fact, set in ink. A safety stop is a warning. */}
      {stopReason ? (
        <span className={cx('an-table__stop', safetyStop && 'an-table__warn')}>{stopReason}</span>
      ) : null}
      {phase.isFinalExecuted && (
        <span
          className={cx('an-tick block', results?.completionTone === 'warning' && 'an-table__warn')}
        >
          {results?.completionLabel || results?.brewModeLabel}
        </span>
      )}
    </>
  );
}

// A missing value, as the design writes it.
const MISSING = '—';

const DIRECT_CELL_FIELDS = {
  duration: { path: 'duration', unit: 's' },
  water: { path: 'water', unit: 'ml' },
  weight: { path: 'weight', unit: 'g' },
};

const CELL_METRIC_UNITS = {
  p: 'bar',
  tp: 'bar',
  f: 'ml/s',
  tf: 'ml/s',
  pf: 'ml/s',
  pr: 's·√bar/mL',
  lr: 'bar·s/mL',
  t: '°C',
  tt: '°C',
  w: 'g',
  wf: 'g/s',
};

const CELL_METRIC_PARTS = {
  se: ['start', 'end'],
  mm: ['min', 'max'],
  avg: ['avg'],
};

const BOOLEAN_CELL_FIELDS = {
  sys_shot_vol: 'sys_shot_vol',
  sys_curr_vol: 'sys_curr_vol',
  sys_scale: 'sys_scale',
  sys_vol_avail: 'sys_vol_avail',
  sys_ext: 'sys_ext',
};

const SYSTEM_VALUE_CELL_FIELDS = {
  sys_brew_mode: { unit: '' },
  sys_recorded_stop_reason: { unit: '' },
  sys_scale_delay: { unit: 'ms' },
};

function formatCellNumber(value, digits = 1) {
  const numericValue = Number(value);
  return value != null && Number.isFinite(numericValue) ? numericValue.toFixed(digits) : MISSING;
}

function renderCellBoolean(value) {
  if (value === true) return <Icon name='check' size={16} title='Yes' />;
  if (value === false) return <Icon name='x' size={16} title='No' className='text-(--ink-muted)' />;
  return <span className='text-(--ink-muted)'>{MISSING}</span>;
}

function formatSystemCellValue(colId, value) {
  if (colId === 'sys_scale_delay') {
    return formatCellNumber(value, 0);
  }
  if (value == null || value === '') {
    return MISSING;
  }
  return String(value);
}

function getMetricCellValue(stats, metricKey, partKey) {
  const metric = stats?.[metricKey];
  const parts = CELL_METRIC_PARTS[partKey];
  if (!parts) return MISSING;

  const formatPart = part => {
    const value = metric?.[part];
    return metricKey === 'wf' ? formatCellNumber(Math.max(0, value ?? 0)) : formatCellNumber(value);
  };

  return parts.length === 1
    ? formatPart(parts[0])
    : `${formatPart(parts[0])}/${formatPart(parts[1])}`;
}

function resolveCellValue({ data, stats, col, isSkipped = false }) {
  if (
    isSkipped &&
    col.id !== 'sys_raw' &&
    !BOOLEAN_CELL_FIELDS[col.id] &&
    !SYSTEM_VALUE_CELL_FIELDS[col.id]
  ) {
    const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
    return {
      mainValue: MISSING,
      unit: metricMatch
        ? CELL_METRIC_UNITS[metricMatch[1]] || ''
        : DIRECT_CELL_FIELDS[col.id]?.unit || '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const directField = DIRECT_CELL_FIELDS[col.id];
  if (directField) {
    return {
      mainValue: formatCellNumber(data?.[directField.path]),
      unit: directField.unit,
      isBoolean: false,
      booleanContent: null,
    };
  }

  if (col.id === 'sys_raw') {
    return {
      mainValue: stats?.sys_raw ?? MISSING,
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const systemValueField = SYSTEM_VALUE_CELL_FIELDS[col.id];
  if (systemValueField) {
    const value = stats?.[col.id];
    return {
      mainValue: formatSystemCellValue(col.id, value),
      unit: systemValueField.unit,
      isBoolean: false,
      booleanContent: null,
    };
  }

  const booleanField = BOOLEAN_CELL_FIELDS[col.id];
  if (booleanField) {
    return {
      mainValue: MISSING,
      unit: '',
      isBoolean: true,
      booleanContent: renderCellBoolean(stats?.[booleanField]),
    };
  }

  const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
  if (!metricMatch) {
    return {
      mainValue: MISSING,
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const [, metricKey, partKey] = metricMatch;
  return {
    mainValue: getMetricCellValue(stats, metricKey, partKey),
    unit: CELL_METRIC_UNITS[metricKey] || '',
    isBoolean: false,
    booleanContent: null,
  };
}

function TargetDeltaDisplay({ targetVal, unit }) {
  return (
    <span className='an-tick block whitespace-nowrap'>
      Target {targetVal} {unit}
    </span>
  );
}

function findPhaseTarget(phase, col) {
  const targets = Array.isArray(phase?.profilePhase?.targets) ? phase.profilePhase.targets : [];
  return targets.find(target => {
    if (col.id === 'weight') return target.type === 'weight' || target.type === 'volumetric';
    return target.type === col.targetType;
  });
}

function getTargetDisplay({ phase, col, unit }) {
  if (col.id === 'duration' && phase?.profilePhase?.duration > 0) {
    return <TargetDeltaDisplay targetVal={phase.profilePhase.duration} unit={unit} />;
  }

  if (!col.targetType) return null;

  const target = findPhaseTarget(phase, col);
  if (!target) return null;

  return <TargetDeltaDisplay targetVal={target.value} unit={unit} />;
}

function getTargetCalcEntry(phase, col) {
  if (!col.targetType || !phase?.targetCalcValues) return null;
  return col.id === 'weight'
    ? phase.targetCalcValues.volumetric || phase.targetCalcValues.weight
    : phase.targetCalcValues[col.targetType];
}

function replaceCellValueWithCalc({ mainValue, calcEntry, col }) {
  if (!calcEntry) return mainValue;

  const calcValue = formatCellNumber(calcEntry.value);
  if (
    typeof mainValue === 'string' &&
    mainValue.includes('/') &&
    (col.type === 'se' || col.type === 'mm')
  ) {
    const parts = mainValue.split('/');
    return `${parts.slice(0, -1).join('/')}/${calcValue}`;
  }

  return calcValue;
}

function CellWarning({ children }) {
  return (
    <span className='an-table__warn an-tick flex items-center justify-end gap-1'>
      <Icon name='triangle-alert' size={14} />
      {children}
    </span>
  );
}

function getWeightWarnings({ phase, isWeightCol }) {
  if (!isWeightCol) return [];

  const warnings = [];
  if (phase.scaleLost) {
    warnings.push(<CellWarning key='scale-lost-warning'>Scale lost</CellWarning>);
  }

  if (phase.highScaleDelay) {
    warnings.push(
      <CellWarning key='high-scale-delay-warning'>
        High scale delay
        {phase.estimatedScaleDelayMs ? ` (${phase.estimatedScaleDelayMs} ms)` : ''}
      </CellWarning>,
    );
  }

  return warnings;
}

function renderTotalCellContent({ isBoolean, booleanContent, mainValue, unit, warning = false }) {
  if (isBoolean) return <span className='flex justify-end'>{booleanContent}</span>;
  return (
    <span className={warning ? 'an-table__warn' : undefined}>
      {mainValue} {unit}
    </span>
  );
}

function getCellHitState({ phase, col }) {
  if (col.id === 'weight') {
    return phase.exit?.type === 'weight' || phase.exit?.type === 'volumetric';
  }
  if (!col.targetType) return false;
  return phase.exit?.type === col.targetType;
}

function renderBooleanCellContent({ booleanContent, booleanAnomaly }) {
  return (
    <>
      <span className='flex justify-end'>{booleanContent}</span>
      {booleanAnomaly && (
        <span
          className='an-tick block text-right'
          title={`Sample ${booleanAnomaly.sampleInPhase}: ${String(booleanAnomaly.value)}`}
        >
          Sample {booleanAnomaly.sampleInPhase}
          {Number.isFinite(booleanAnomaly.sampleCountInPhase)
            ? ` (${booleanAnomaly.sampleCountInPhase})`
            : ''}
          <span className='block'>{String(booleanAnomaly.value)}</span>
        </span>
      )}
    </>
  );
}

// The value a phase stopped on is the fact of the row: it is set in ink at weight 600.
function renderMetricCellValue({
  isHit,
  calcIsStopReason,
  mainValue,
  unit,
  mainValueIsCalculated,
  warning = false,
}) {
  const isStopValue = mainValueIsCalculated ? calcIsStopReason : isHit && !calcIsStopReason;

  return (
    <span className={cx(warning && 'an-table__warn', !warning && isStopValue && 'an-table__stop')}>
      {mainValue} {unit}
    </span>
  );
}

export function CellContent({ phase, col, results, isTotal = false }) {
  const data = isTotal ? results?.total : phase;
  const stats = isTotal ? results?.total : phase?.stats;

  if (!data) return <span>{MISSING}</span>;

  const { mainValue, unit, isBoolean, booleanContent } = resolveCellValue({
    data,
    stats,
    col,
    isSkipped: Boolean(phase?.skipped),
  });
  const safetyStopReason =
    col.id === 'sys_recorded_stop_reason' &&
    isSafetyExitReason(isTotal ? results?.finalExitReasonCode : phase?.exit?.code);

  if (isTotal) {
    return renderTotalCellContent({
      isBoolean,
      booleanContent,
      mainValue,
      unit,
      warning: safetyStopReason,
    });
  }

  const isWeightCol = col.id === 'weight';
  const isHit = getCellHitState({ phase, col });

  const booleanAnomaly = isBoolean ? stats?.sys_anomalies?.[col.id] : null;
  const calcEntry = getTargetCalcEntry(phase, col);
  const displayMainValue = isBoolean
    ? mainValue
    : replaceCellValueWithCalc({ mainValue, calcEntry, col });
  const mainValueIsCalculated = !isBoolean && Boolean(calcEntry);
  const targetDisplay = getTargetDisplay({ phase, col, unit });
  const calcIsStopReason = Boolean(calcEntry?.isStopReason);
  const warningDisplays = getWeightWarnings({ phase, isWeightCol });

  return (
    <>
      {isBoolean
        ? renderBooleanCellContent({ booleanContent, booleanAnomaly })
        : renderMetricCellValue({
            isHit,
            calcIsStopReason,
            mainValue: displayMainValue,
            unit,
            mainValueIsCalculated,
            warning: safetyStopReason,
          })}
      {targetDisplay}
      {warningDisplays}
    </>
  );
}
