import { useCallback, useContext, useId, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Chip } from '../../components/Chip.jsx';
import { ConfirmButton } from '../../components/ConfirmButton.jsx';
import { ListRow } from '../../components/ListRow.jsx';
import { SkeletonBlock } from '../../components/SkeletonBlock.jsx';
import VisualizerUploadModal from '../../components/VisualizerUploadModal.jsx';
import { ApiServiceContext } from '../../services/ApiService.js';
import { visualizerService } from '../../services/VisualizerService.js';
import { downloadJson } from '../../utils/download.js';
import { HistoryChart } from './HistoryChart.jsx';
import ShotNotes from './ShotNotes.jsx';
import { Notice } from '../../components/Notice.jsx';

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * One shot of the history: a list row, and under it, once opened, the shot itself: its chart,
 * its notes and what can be done with it.
 *   when     what the row shows at its end: the time in a day's tile, the day in any other order
 *   compact  under 600px: `when` moves up beside the profile, so the facts keep the whole line
 */
export function ShotRow({ shot, when, compact, onDelete, onLoad, onNotesChanged }) {
  const apiService = useContext(ApiServiceContext);
  const [shotNotes, setShotNotes] = useState(shot.notes || null);
  const [expanded, setExpanded] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const detailId = useId();

  const onExport = useCallback(() => {
    if (!shot.loaded) return; // Only export loaded data
    const exportData = { ...shot, notes: shotNotes };
    if (Array.isArray(exportData.samples)) {
      exportData.samples = exportData.samples.map(s => ({
        t: s.t,
        tt: round2(s.tt),
        ct: round2(s.ct),
        tp: round2(s.tp),
        cp: round2(s.cp),
        fl: round2(s.fl),
        tf: round2(s.tf),
        pf: round2(s.pf),
        vf: round2(s.vf),
        v: round2(s.v),
        ev: round2(s.ev),
        pr: round2(s.pr),
        wp: round2(s.wp),
        systemInfo: s.systemInfo,
        phaseNumber: s.phaseNumber,
        phaseDisplayNumber: s.phaseDisplayNumber,
      }));
    }
    exportData.volume = round2(exportData.volume);
    // duration left as integer ms
    downloadJson(exportData, `shot-${shot.id}.json`);
  }, [shot, shotNotes]);

  const handleNotesLoaded = useCallback(notes => {
    setShotNotes(notes);
  }, []);

  const handleNotesUpdate = useCallback(
    notes => {
      setShotNotes(notes);
      // Notify parent that notes changed (so it can reload the index)
      if (onNotesChanged) onNotesChanged();
    },
    [onNotesChanged],
  );

  const handleUpload = useCallback(
    async (username, password) => {
      setIsUploading(true);
      try {
        // Validate shot data
        if (!visualizerService.validateShot(shot)) {
          throw new Error('Shot data is invalid or incomplete');
        }

        // Fetch profile data if profileId is available
        let profileData = null;
        if (shot.profileId && apiService) {
          try {
            const profileResponse = await apiService.request({
              tp: 'req:profiles:load',
              id: shot.profileId,
            });
            if (profileResponse.profile) {
              profileData = profileResponse.profile;
            }
          } catch (error) {
            console.warn('Failed to fetch profile data:', error);
            // Continue without profile data
          }
        }

        // Include notes in shot data
        const shotWithNotes = {
          ...shot,
          notes: shotNotes,
        };

        await visualizerService.uploadShot(shotWithNotes, username, password, profileData);
        setUploaded(true);
      } catch (error) {
        console.error('Upload failed:', error);
        // The sheet stays open over the page, so this has to be said above it.
        alert(`Upload failed: ${error.message}`);
        throw error; // Re-throw to prevent modal from closing
      } finally {
        setIsUploading(false);
      }
    },
    [shot, shotNotes, apiService],
  );

  const profileTitle = shot.profile || 'Unknown profile';
  const facts = [
    `${(shot.duration / 1000).toFixed(1)} s`,
    shot.volume > 0 && `${shot.volume.toFixed(1)} g`,
    shot.maxPressure > 0 && `${shot.maxPressure.toFixed(1)} bar`,
    shot.rating > 0 && `${shot.rating}/5`,
  ]
    .filter(Boolean)
    .join(' · ');

  const stoppedBy =
    shot.loaded && shot.samples?.[0]?.systemInfo
      ? ` · stopped by ${shot.samples[0].systemInfo.shotStartedVolumetric ? 'weight' : 'time'}`
      : '';

  return (
    <>
      <ListRow
        icon='coffee'
        title={
          <span className='flex items-center gap-2'>
            <span className='min-w-0 truncate'>{profileTitle}</span>
            {shot.incomplete && (
              <Chip tone='warning' className='-my-0.5 shrink-0'>
                Incomplete
              </Chip>
            )}
            {compact && <span className='bm-data ml-auto shrink-0'>{when}</span>}
          </span>
        }
        meta={facts}
        end={compact ? undefined : when}
        aria-expanded={expanded}
        aria-controls={expanded ? detailId : undefined}
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (next && !shot.loaded && onLoad) onLoad(shot.id);
        }}
      />

      {expanded && (
        <div id={detailId} className='flex flex-col gap-4 pt-1 pb-5'>
          <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
            <span className='bm-data'>
              #{shot.id}
              {stoppedBy}
            </span>
            <a href={`/analyzer/internal/${shot.id}`} className='bm-link'>
              Open in Analyzer
            </a>
          </div>

          {shot.loaded && shot.samples.length > 0 ? (
            <HistoryChart shot={shot} />
          ) : shot.loaded ? (
            <Notice title='Nothing was recorded for this shot' />
          ) : shot.loadFailed ? (
            <Notice tone='danger' title='This shot could not be read'>
              The file may be damaged. The other shots are not affected.
            </Notice>
          ) : (
            <SkeletonBlock className='h-56 w-full sm:h-72' />
          )}

          {shot.loaded && (
            <ShotNotes
              shot={shot}
              onNotesLoaded={handleNotesLoaded}
              onNotesUpdate={handleNotesUpdate}
            />
          )}

          <div className='flex flex-wrap items-center gap-2'>
            <Button disabled={!shot.loaded} onClick={onExport} aria-label='Export shot data'>
              Export
            </Button>
            <Button
              disabled={!visualizerService.validateShot(shot)}
              onClick={() => setShowUploadModal(true)}
              aria-label='Upload to visualizer.coffee'
            >
              Upload
            </Button>
            {uploaded && <Chip tone='success'>Uploaded</Chip>}
            <span className='ml-auto'>
              <ConfirmButton
                icon='trash-2'
                btnSize='md'
                tooltip='Delete shot'
                confirmTooltip='Confirm delete'
                onAction={() => onDelete(shot.id)}
              />
            </span>
          </div>

          <VisualizerUploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onUpload={handleUpload}
            isUploading={isUploading}
            shotInfo={{
              profile: shot.profile,
              timestamp: shot.timestamp,
              duration: shot.duration,
              volume: shot.volume,
            }}
          />
        </div>
      )}
    </>
  );
}
