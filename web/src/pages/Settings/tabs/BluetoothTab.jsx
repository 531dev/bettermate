import { useState, useEffect, useCallback } from 'preact/hooks';
import { computed } from '@preact/signals';
import { useQuery } from 'preact-fetching';
import { machine } from '../../../services/ApiService.js';
import { Button } from '../../../components/Button.jsx';
import { Chip } from '../../../components/Chip.jsx';
import { cx } from '../../../components/cx.js';
import { Icon } from '../../../components/Icon.jsx';
import { List, ListRow } from '../../../components/ListRow.jsx';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { Spinner } from '../../../components/Spinner.jsx';
import { Tile } from '../../../components/Tile.jsx';

const machineMode = computed(() => machine.value.status.mode);

// A battery at or under these levels is worth a line of its own.
const BATTERY_LOW = 29;
const BATTERY_EMPTY = 9;

export function BluetoothTab() {
  const [key, setKey] = useState(0);
  const [scaleData, setScaleData] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const mode = machineMode.value;

  useEffect(() => {
    const intervalHandle = setInterval(() => {
      setKey(Date.now().valueOf());
    }, 10000);

    return () => clearInterval(intervalHandle);
  }, []);

  const {
    isLoading,
    isError,
    data: fetchedScales = [],
  } = useQuery(`scales-${key}`, async () => {
    const response = await fetch(`/api/scales/list`);
    const data = await response.json();
    return data;
  });

  const { data: connectedScale = [] } = useQuery(`scale-info-${key}`, async () => {
    const response = await fetch(`/api/scales/info`);
    const data = await response.json();
    return data;
  });

  useEffect(() => {
    if (!connectedScale || fetchedScales.length === 0) {
      return;
    }
    const scales = connectedScale.connected ? [connectedScale] : fetchedScales;
    setScaleData(scales);
  }, [connectedScale, fetchedScales]);

  const onScan = useCallback(async () => {
    setIsScanning(true);
    try {
      await fetch('/api/scales/scan', {
        method: 'post',
      });
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  }, [setIsScanning]);

  const onConnect = useCallback(async uuid => {
    try {
      const data = new FormData();
      data.append('uuid', uuid);
      await fetch('/api/scales/connect', {
        method: 'post',
        body: data,
      });
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, []);

  const awake = mode > 0;
  // The list refreshes every ten seconds behind what it already shows; only the first look and a
  // scan count as waiting.
  const waiting = isScanning || (isLoading && scaleData.length === 0);

  return (
    <Tile
      title='Bluetooth devices'
      end={
        <Button size='sm' onClick={onScan} disabled={isScanning || !awake}>
          {awake && waiting ? <Spinner size={4} /> : <Icon name='search' size={18} />}
          {awake && waiting ? 'Scanning' : 'Scan'}
        </Button>
      }
    >
      <p className='bm-help'>Scan for nearby Bluetooth scales to connect them to BetterMate.</p>

      {!awake && (
        <p className='bm-notice'>The machine is in standby. Wake it up to use Bluetooth scales.</p>
      )}
      {awake && (
        <>
          <ScaleList
            waiting={waiting}
            failed={isError}
            scaleData={scaleData}
            onConnect={onConnect}
          />
          <p className='bm-notice'>
            Scales are refreshed every 10 seconds. Use Scan to discover new devices.
          </p>
        </>
      )}
    </Tile>
  );
}

function batteryNotice(scale) {
  if (!scale.connected || !scale.hasBattery || typeof scale.battery !== 'number') return null;
  if (scale.battery > BATTERY_LOW) return null;
  const empty = scale.battery <= BATTERY_EMPTY;
  return (
    <p
      key={scale.uuid}
      className={cx('bm-notice', empty ? 'bm-notice--danger' : 'bm-notice--warning')}
    >
      {empty
        ? `The battery of ${scale.name || 'the scale'} is almost empty (${scale.battery}%).`
        : `The battery of ${scale.name || 'the scale'} is low (${scale.battery}%).`}
    </p>
  );
}

function ScaleList({ waiting, failed, scaleData, onConnect }) {
  if (failed) {
    return (
      <p role='alert' className='bm-notice bm-notice--danger'>
        The devices could not be loaded. Scan again.
      </p>
    );
  }
  if (waiting) {
    return (
      <div aria-hidden='true' className='bm-list'>
        {[0, 1].map(row => (
          <div key={row} className='bm-item'>
            <SkeletonBlock className='rounded-pill size-10 shrink-0' />
            <div className='flex flex-1 flex-col gap-2'>
              <SkeletonBlock className='h-4 w-28' />
              <SkeletonBlock className='h-3 w-40' />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (scaleData.length === 0) {
    return (
      <p className='bm-help'>No scales found. Use Scan to discover Bluetooth scales nearby.</p>
    );
  }
  return (
    <>
      <List>
        {scaleData.map(scale => {
          const hasBattery =
            scale.connected && scale.hasBattery && typeof scale.battery === 'number';
          return (
            <ListRow
              key={scale.uuid}
              icon='scale'
              current={!!scale.connected}
              title={scale.name || 'Unknown scale'}
              meta={
                // The battery follows the address on one line where the row has the width, and
                // takes a line of its own on a phone, where the row would cut it off.
                <>
                  {scale.uuid}
                  {hasBattery && (
                    <span className='block sm:inline'>
                      <span className='hidden sm:inline'> · </span>
                      Battery {scale.battery}%
                    </span>
                  )}
                </>
              }
              end={
                scale.connected ? (
                  <Chip tone='success' dot>
                    Connected
                  </Chip>
                ) : (
                  <Button size='sm' onClick={() => onConnect(scale.uuid)}>
                    Connect
                  </Button>
                )
              }
            />
          );
        })}
      </List>
      {scaleData.map(batteryNotice)}
    </>
  );
}
