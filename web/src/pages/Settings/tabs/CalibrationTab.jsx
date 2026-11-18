import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService.js';
import { Button } from '../../../components/Button.jsx';
import { Chip } from '../../../components/Chip.jsx';
import { OverviewChart } from '../../../components/OverviewChart.jsx';
import { Loader } from '../../../components/Loader.jsx';
import { Cell, Tile } from '../../../components/Tile.jsx';
import PumpFlowCalibration from '../../../components/PumpFlowCalibration/index.jsx';
import { FormField } from '../../../components/FormField.jsx';
import { Notice } from '../../../components/Notice.jsx';

// What the autotune accepts; outside these it cannot start.
const TIME_RANGE = [30, 300];
const SAMPLES_RANGE = [4, 20];
const WATTAGE_RANGE = [300, 1500];

const outside = (value, [low, high]) => value < low || value > high;
const rangeError = (value, range) =>
  outside(value, range) ? `Enter ${range[0]} to ${range[1]}.` : undefined;

export function CalibrationTab({ formData, setField, onPidTuned }) {
  const apiService = useContext(ApiServiceContext);

  // Autotune state
  const [autotuneActive, setAutotuneActive] = useState(false);
  const [autotuneResult, setAutotuneResult] = useState(null);
  const [autotuneFailed, setAutotuneFailed] = useState(false);
  const [autotuneTime, setAutotuneTime] = useState(120);
  const [autotuneSamples, setAutotuneSamples] = useState(6);
  const [autotuneWattage, setAutotuneWattage] = useState(1360);

  const onStartAutotune = useCallback(() => {
    apiService.send({
      tp: 'req:autotune-start',
      time: autotuneTime,
      samples: autotuneSamples,
      wattage: autotuneWattage,
    });
    setAutotuneFailed(false);
    setAutotuneResult(null);
    setAutotuneActive(true);
  }, [autotuneTime, autotuneSamples, autotuneWattage, apiService]);

  useEffect(() => {
    const resultListener = apiService.on('evt:autotune-result', msg => {
      setAutotuneActive(false);
      setAutotuneFailed(false);
      setAutotuneResult(msg.pid);
      onPidTuned?.(msg.pid);
    });
    const failedListener = apiService.on('evt:autotune-failed', () => {
      setAutotuneActive(false);
      setAutotuneResult(null);
      setAutotuneFailed(true);
    });
    return () => {
      apiService.off('evt:autotune-result', resultListener);
      apiService.off('evt:autotune-failed', failedListener);
    };
  }, [apiService, onPidTuned]);

  const idle = !autotuneActive && !autotuneResult && !autotuneFailed;

  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      <Tile
        title='PID autotune'
        end={
          autotuneActive && (
            <Chip tone='primary' dot>
              Running
            </Chip>
          )
        }
      >
        {autotuneActive && (
          <>
            <div className='flex h-64 w-full'>
              <OverviewChart hour12={false} />
            </div>
            <div className='flex items-center gap-3'>
              <Loader size={24} />
              <span className='bm-field__label'>Autotune in progress</span>
            </div>
            <Notice tone='warning' title='The boiler heats at full power'>
              Until its temperature turns, then the SIMC rule derives the PID gains. This takes 1 to
              3 min depending on the machine.
            </Notice>
          </>
        )}

        {autotuneResult && (
          <>
            <Notice live tone='success' title='Autotune finished'>
              The new PID values are saved.
            </Notice>
            <Cell>
              <span className='bm-eyebrow'>PID values</span>
              <span className='bm-data break-all text-(--ink)'>{autotuneResult}</span>
            </Cell>
            <Button className='self-end' onClick={() => setAutotuneResult(null)}>
              Dismiss
            </Button>
          </>
        )}

        {autotuneFailed && (
          <>
            <Notice live tone='danger' title='Autotune found no gains'>
              The PID values are unchanged. Run it again with a longer test, starting from a cold
              boiler.
            </Notice>
            <Button className='self-end' onClick={() => setAutotuneFailed(false)}>
              Retry
            </Button>
          </>
        )}

        {idle && (
          <>
            <Notice tone='warning' title='Start with a cold boiler'>
              Let it cool below 50° before you start the autotune.
            </Notice>

            <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
              <FormField
                id='testTime'
                label='Test duration'
                unit='s'
                help='Upper bound on the identification test. Most espresso boilers resolve within 60–120 s. Extend if autotune fails before peak slope is detected.'
                type='number'
                min={TIME_RANGE[0]}
                max={TIME_RANGE[1]}
                placeholder='120'
                error={rangeError(autotuneTime, TIME_RANGE)}
                value={autotuneTime}
                onChange={e => setAutotuneTime(Number.parseInt(e.target.value, 10) || 0)}
              />
              <FormField
                id='slopeWindow'
                label='Slope window'
                unit='samples'
                help='Moving-window length used for slope estimation. Larger values smooth MAX31855 quantisation but lag the inflection. 6 is the sweet spot.'
                type='number'
                min={SAMPLES_RANGE[0]}
                max={SAMPLES_RANGE[1]}
                placeholder='6'
                error={rangeError(autotuneSamples, SAMPLES_RANGE)}
                value={autotuneSamples}
                onChange={e => setAutotuneSamples(Number.parseInt(e.target.value, 10) || 4)}
              />
              <FormField
                id='heaterWattage'
                label='Heater wattage'
                unit='W'
                help='For example Gaggia Classic: 1360 W, Rancilio Silvia 120 V: 950 W, Rancilio Silvia 230 V: 1100 W.'
                type='number'
                min={WATTAGE_RANGE[0]}
                max={WATTAGE_RANGE[1]}
                placeholder='1360'
                error={rangeError(autotuneWattage, WATTAGE_RANGE)}
                value={autotuneWattage}
                onChange={e => setAutotuneWattage(Number.parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <Button
              className='self-end'
              onClick={onStartAutotune}
              disabled={
                outside(autotuneTime, TIME_RANGE) ||
                outside(autotuneSamples, SAMPLES_RANGE) ||
                outside(autotuneWattage, WATTAGE_RANGE)
              }
            >
              Start autotune
            </Button>
          </>
        )}
      </Tile>

      <Tile title='Pump flow calibration'>
        <PumpFlowCalibration
          currentCoeffs={formData.pumpModelCoeffs}
          onApplied={coeffs => setField('pumpModelCoeffs', coeffs)}
        />
      </Tile>
    </div>
  );
}
