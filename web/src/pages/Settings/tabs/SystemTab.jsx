import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import { downloadJson } from '../../../utils/download.js';
import { Button } from '../../../components/Button.jsx';
import { Chip } from '../../../components/Chip.jsx';
import { SegmentBar } from '../../../components/SegmentBar.jsx';
import { SystemTabSkeleton } from '../../../components/skeletons/SettingsSkeletons.jsx';
import { Spinner } from '../../../components/Spinner.jsx';
import { Stat } from '../../../components/StatTile.jsx';
import { Cell, Tile } from '../../../components/Tile.jsx';
import { SegmentedField, TILE_GRID } from '../fields.jsx';

const imageUrlToBase64 = async blob => {
  return new Promise((onSuccess, onError) => {
    try {
      const reader = new FileReader();
      reader.onload = function () {
        onSuccess(this.result);
      };
      reader.onerror = function () {
        onError(new Error('FileReader failed to read image blob.'));
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
    }
  });
};

const link = computed(() => {
  const { rssi, lat, rtx } = machine.value.status;
  return { rssi, lat, rtx };
});

const CHANNELS = [
  { value: 'latest', label: 'Stable' },
  { value: 'nightly', label: 'Nightly' },
];

// The controller link by signal strength: only a weak one is worth a word.
const signalChip = rssi => {
  if (rssi < -90) {
    return (
      <Chip tone='danger' className='self-start'>
        Poor signal
      </Chip>
    );
  }
  if (rssi < -80) {
    return (
      <Chip tone='warning' className='self-start'>
        Weak signal
      </Chip>
    );
  }
  return null;
};

const percent = (part, total) => (total > 0 ? (part / total) * 100 : 0);

function OtaProgressView({ phase, progress }) {
  const finished = phase === 4;
  const failed = phase === 5;
  const shown = finished ? 100 : progress;
  const getOtaPhaseText = p => {
    switch (p) {
      case 1:
        return 'Updating display firmware';
      case 2:
        return 'Updating display filesystem';
      case 3:
        return 'Updating controller firmware';
      case 5:
        return 'Update failed';
      default:
        return 'Finished';
    }
  };

  return (
    <Tile>
      <div className='flex flex-col items-center gap-4 py-8 text-center'>
        {!failed && !finished && <Spinner size={8} />}
        <h2 className='bm-heading'>{getOtaPhaseText(phase)}</h2>
        {failed ? (
          <p role='alert' className='bm-notice bm-notice--danger max-w-md text-left'>
            The update could not be completed and the device kept its current firmware. Check the
            network connection and start the update again.
          </p>
        ) : (
          <div className='flex w-full max-w-xs flex-col gap-2'>
            <div className='bm-stat__row justify-center'>
              <span className='bm-stat__value'>{shown}</span>
              <span className='bm-stat__unit'>%</span>
            </div>
            <SegmentBar value={shown / 100} total={24} />
          </div>
        )}
        {(finished || failed) && <Button href='/'>Back</Button>}
      </div>
    </Tile>
  );
}

function VersionCell({
  label,
  version,
  updateAvailable,
  latestVersion,
  disabled,
  onUpdate,
  action,
}) {
  return (
    <Cell>
      <span className='bm-eyebrow'>{label}</span>
      <span className='bm-data break-all text-(--ink)'>{version || '—'}</span>
      {updateAvailable && <span className='bm-data'>Update available: {latestVersion}</span>}
      <Button
        variant='outline'
        size='sm'
        className='mt-1 self-start'
        disabled={disabled}
        onClick={onUpdate}
      >
        {action}
      </Button>
    </Cell>
  );
}

function StorageAndMemorySection({ formData }) {
  const heapUsed = formData.heapTotal - formData.heapFree;
  const heapUsedPct = percent(heapUsed, formData.heapTotal);
  const heapFragmentation =
    formData.heapFree > 0 ? 100 - (formData.heapLargest * 100) / formData.heapFree : 0;

  return (
    <Tile title='Storage & memory' className='@container'>
      <div className='grid grid-cols-1 gap-2 @md:grid-cols-2'>
        {formData.spiffsTotal !== undefined && (
          <Cell>
            <Stat
              size='sm'
              label='Storage (LittleFS)'
              value={formData.spiffsUsedPct ?? 0}
              unit='%'
              bar={{ value: (formData.spiffsUsedPct || 0) / 100 }}
            >
              <span className='bm-data'>
                {((formData.spiffsUsed || 0) / 1024).toFixed(1)} KB /{' '}
                {(formData.spiffsTotal / 1024).toFixed(1)} KB
              </span>
            </Stat>
          </Cell>
        )}

        {formData.sdTotal !== undefined && (
          <Cell>
            <Stat
              size='sm'
              label='Storage (SD card)'
              value={formData.sdUsedPct ?? 0}
              unit='%'
              bar={{ value: (formData.sdUsedPct || 0) / 100 }}
            >
              <span className='bm-data'>
                {((formData.sdUsed || 0) / 1024 / 1024).toFixed(1)} MB /{' '}
                {(formData.sdTotal / 1024 / 1024).toFixed(1)} MB
              </span>
            </Stat>
          </Cell>
        )}

        {formData.heapTotal !== undefined && (
          <Cell>
            <Stat
              size='sm'
              label='Memory in use (heap)'
              value={heapUsedPct.toFixed(0)}
              unit='%'
              bar={{ value: heapUsedPct / 100 }}
            >
              <span className='bm-data'>
                {((heapUsed || 0) / 1024).toFixed(1)} kB / {(formData.heapTotal / 1024).toFixed(1)}{' '}
                kB · {heapFragmentation.toFixed(2)}% fragmented
              </span>
            </Stat>
          </Cell>
        )}
      </div>
    </Tile>
  );
}

function MaintenanceSection({
  downloadSupportData,
  onHistoryRebuild,
  rebuilding,
  rebuilt,
  rebuildProgress,
}) {
  const scanning =
    rebuildProgress.status === 'starting' ||
    rebuildProgress.status === 'scanning' ||
    rebuildProgress.total === 0;
  const failed = !rebuilding && rebuildProgress.status === 'error';

  let chip = null;
  if (rebuilding) {
    chip = (
      <Chip tone='primary' dot>
        Rebuilding
      </Chip>
    );
  } else if (rebuilt) {
    chip = <Chip tone='success'>History rebuilt</Chip>;
  } else if (failed) {
    chip = <Chip tone='danger'>Rebuild failed</Chip>;
  }

  return (
    <Tile title='Maintenance & support' end={chip}>
      <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap'>
        <Button onClick={downloadSupportData}>Download support data</Button>
        <Button onClick={onHistoryRebuild} disabled={rebuilding}>
          {rebuilding && <Spinner size={4} />}
          Rebuild shot history
        </Button>
      </div>

      {rebuilding && (
        <div className='flex flex-col gap-2'>
          <span className='bm-help'>
            {scanning
              ? 'Scanning shot history files'
              : `Processing shot history files (${rebuildProgress.current}/${rebuildProgress.total})`}
          </span>
          <SegmentBar
            value={rebuildProgress.total > 0 ? rebuildProgress.current / rebuildProgress.total : 0}
            total={24}
          />
        </div>
      )}

      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        <span className='bm-help'>GaggiMate project</span>
        <a
          href='https://github.com/jniebuhr/gaggimate'
          target='_blank'
          rel='noopener noreferrer'
          className='bm-link'
        >
          GitHub
        </a>
        <a
          href='https://discord.gaggimate.eu/'
          target='_blank'
          rel='noopener noreferrer'
          className='bm-link'
        >
          Discord
        </a>
      </div>
    </Tile>
  );
}

export function SystemTab() {
  const apiService = useContext(ApiServiceContext);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  // The channel picked but not saved yet; the saved one comes with the versions.
  const [pickedChannel, setPickedChannel] = useState(null);
  const savingChannel = useRef(false);
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const { rssi, lat, rtx } = link.value;

  const downloadSupportData = useCallback(async () => {
    try {
      const settingsResponse = await fetch(`/api/settings`);
      const data = await settingsResponse.json();
      delete data.wifiPassword;
      delete data.haPassword;
      const coredumpBlob = await fetch(`/api/core-dump`).then(r => r.blob());
      let coredump = await imageUrlToBase64(coredumpBlob);
      coredump = coredump.substring(coredump.indexOf('base64,') + 7);
      const supportFile = {
        settings: data,
        versions: formData,
        coredump,
      };
      const ts = Date.now();
      downloadJson(supportFile, `support-${ts}.dat`);
    } catch (e) {
      console.error('Error downloading support data:', e);
    }
  }, [formData]);

  useEffect(() => {
    const listenerId = apiService.on('res:ota-settings', msg => {
      setFormData(msg);
      setIsLoading(false);
      setSubmitting(false);
      if (savingChannel.current) {
        savingChannel.current = false;
        setPickedChannel(null);
      }
    });
    return () => {
      apiService.off('res:ota-settings', listenerId);
    };
  }, [apiService]);

  useEffect(() => {
    const listenerId = apiService.on('evt:ota-progress', msg => {
      setProgress(msg.progress);
      setPhase(msg.phase);
    });
    return () => {
      apiService.off('evt:ota-progress', listenerId);
    };
  }, [apiService]);

  useEffect(() => {
    const listenerId = apiService.on('evt:history-rebuild-progress', msg => {
      setRebuildProgress({
        total: msg.total || 0,
        current: msg.current || 0,
        status: msg.status || '',
      });

      if (msg.status === 'completed' || msg.status === 'error') {
        setRebuilding(false);
        setRebuilt(msg.status === 'completed');
      }
    });
    return () => {
      apiService.off('evt:history-rebuild-progress', listenerId);
    };
  }, [apiService]);

  useEffect(() => {
    setTimeout(() => {
      apiService.send({ tp: 'req:ota-settings' });
    }, 500);
  }, [apiService]);

  const channel = pickedChannel ?? (formData.channel === 'nightly' ? 'nightly' : 'latest');

  const onSubmit = useCallback(
    async e => {
      e.preventDefault();
      setSubmitting(true);
      savingChannel.current = true;
      apiService.send({ tp: 'req:ota-settings', update: true, channel });
    },
    [apiService, channel],
  );

  const onUpdate = useCallback(
    component => {
      apiService.send({ tp: 'req:ota-start', cp: component });
    },
    [apiService],
  );

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuilt, setRebuilt] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState({ total: 0, current: 0, status: '' });

  const onHistoryRebuild = useCallback(async () => {
    setRebuilt(false);
    setRebuilding(true);
    setRebuildProgress({ total: 0, current: 0, status: 'starting' });
    apiService.send({ tp: 'req:history:rebuild' });
  }, [apiService]);

  if (phase > 0) {
    return <OtaProgressView phase={phase} progress={progress} />;
  }

  if (isLoading) {
    return <SystemTabSkeleton />;
  }

  return (
    <div className={TILE_GRID}>
      {/* An update is named in its version cell; a Chip beside this title would wrap it on a phone. */}
      <Tile title='System version & updates' className='@container md:row-span-2'>
        <form onSubmit={onSubmit} className='flex flex-col gap-3'>
          <SegmentedField
            label='Update channel'
            options={CHANNELS}
            value={channel}
            onChange={setPickedChannel}
          />
          <Button type='submit' className='self-start' disabled={submitting}>
            {submitting && <Spinner size={4} />}
            Save channel & refresh
          </Button>
        </form>

        <div className='grid grid-cols-1 gap-2 @md:grid-cols-2'>
          <Cell>
            <span className='bm-eyebrow'>Hardware</span>
            <span>{formData.hardware || '—'}</span>
          </Cell>
          <Cell>
            <Stat size='sm' label='Controller signal strength' value={rssi ?? '—'} unit='dB'>
              <span className='bm-data'>
                Roundtrip {lat ?? '—'} ms · {rtx ?? '—'} resends
              </span>
              {rssi !== undefined && signalChip(rssi)}
            </Stat>
          </Cell>
          <VersionCell
            label='Controller version'
            version={formData.controllerVersion}
            updateAvailable={formData.controllerUpdateAvailable}
            latestVersion={formData.latestVersion}
            disabled={!formData.controllerUpdateAvailable || submitting}
            onUpdate={() => onUpdate('controller')}
            action='Update controller'
          />
          <VersionCell
            label='Display version'
            version={formData.displayVersion}
            updateAvailable={formData.displayUpdateAvailable}
            latestVersion={formData.latestVersion}
            disabled={!formData.displayUpdateAvailable || submitting}
            onUpdate={() => onUpdate('display')}
            action='Update display'
          />
        </div>

        <p className='bm-notice bm-notice--warning'>
          Make sure to back up your profiles from the Profiles page before updating the display.
        </p>
      </Tile>

      <StorageAndMemorySection formData={formData} />

      <MaintenanceSection
        downloadSupportData={downloadSupportData}
        onHistoryRebuild={onHistoryRebuild}
        rebuilding={rebuilding}
        rebuilt={rebuilt}
        rebuildProgress={rebuildProgress}
      />
    </div>
  );
}
