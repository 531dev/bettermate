import { Icon } from '../../components/Icon.jsx';
import Card from '../../components/Card.jsx';
import { useCallback, useState, useContext } from 'preact/hooks';
import { HistoryChart } from './HistoryChart.jsx';
import { downloadJson } from '../../utils/download.js';
import ShotNotesCard from './ShotNotesCard.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';

import VisualizerUploadModal from '../../components/VisualizerUploadModal.jsx';
import { visualizerService } from '../../services/VisualizerService.js';
import { ApiServiceContext } from '../../services/ApiService.js';

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function HistoryCard({ shot, onDelete, onLoad, onNotesChanged }) {
  const apiService = useContext(ApiServiceContext);
  const [shotNotes, setShotNotes] = useState(shot.notes || null);
  const [expanded, setExpanded] = useState(false);
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const date = new Date(shot.timestamp * 1000);

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
    downloadJson(exportData, 'shot-' + shot.id + '.json');
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
  const profileTitle = shot.profile || 'Unknown Profile';
  let formattedDate = 'No timestamp available';
  if (date.getFullYear() > 1970) {
    formattedDate =
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const handleUpload = useCallback(
    async (username, password, rememberCredentials) => {
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

        // Show success message
        alert('Shot uploaded successfully to visualizer.coffee!');
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Upload failed: ${error.message}`);
        throw error; // Re-throw to prevent modal from closing
      } finally {
        setIsUploading(false);
      }
    },
    [shot, shotNotes, apiService],
  );

  const canUpload = visualizerService.validateShot(shot);

  const facts = [
    formattedDate,
    `${(shot.duration / 1000).toFixed(1)} s`,
    shot.volume > 0 && `${round2(shot.volume)} g`,
    shot.rating > 0 && `Rated ${shot.rating}/5`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card sm={12} className='[&>.card-body]:p-3'>
      <div className='flex items-center gap-1'>
        <button
          type='button'
          className='min-h-11 min-w-0 flex-1 cursor-pointer pl-1 text-left'
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (next && !shot.loaded && onLoad) onLoad(shot.id);
          }}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${profileTitle}, ${facts}`}
        >
          <span className='bm-row__title'>{profileTitle}</span>
          <span className='bm-row__sub'>{facts}</span>
        </button>
        {shot.incomplete && (
          <span className='shrink-0 rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-xs text-[var(--warning)]'>
            Incomplete
          </span>
        )}
        <details className='relative shrink-0'>
          <summary
            className='btn btn-ghost btn-circle list-none'
            aria-label={`More actions for ${profileTitle}`}
          >
            <Icon name='more-horizontal' />
          </summary>
          <div className='absolute top-full right-0 z-50 mt-2 flex w-56 flex-col rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-2'>
            <button
              disabled={!shot.loaded}
              onClick={onExport}
              className='btn btn-ghost justify-start'
              aria-label='Export shot data'
            >
              Export data
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={!canUpload}
              className='btn btn-ghost justify-start'
              aria-label='Upload to visualizer.coffee'
            >
              Upload to Visualizer
            </button>
            <button
              onClick={() => confirmOrDelete(() => onDelete(shot.id))}
              className={`btn justify-start ${confirmDelete ? 'btn-error' : 'btn-ghost text-[var(--danger)]'}`}
              aria-label={confirmDelete ? 'Confirm deletion of shot' : 'Delete shot'}
            >
              {confirmDelete ? 'Confirm delete' : 'Delete shot'}
            </button>
          </div>
        </details>
        <a
          href={`/analyzer/internal/${shot.id}`}
          className='flex h-11 w-11 shrink-0 items-center justify-center'
          aria-label='Open in Analyzer'
        >
          <span className='bm-row__arrow'>
            <Icon name='arrow-right' />
          </span>
        </a>
      </div>

      {expanded && (
        <div className='border-base-content/20 mt-3 border-t pt-3'>
          <p className='mb-2 text-xs text-[var(--ink-muted)]'>
            Shot #{shot.id}
            {shot.loaded &&
              shot.samples?.[0]?.systemInfo &&
              `, stopped by ${shot.samples[0].systemInfo.shotStartedVolumetric ? 'weight' : 'time'}`}
          </p>
          {!shot.loaded && (
            <div className='flex items-center justify-center py-8'>
              <span className='text-sm text-[var(--ink-muted)]'>Loading shot data...</span>
            </div>
          )}
          {shot.loaded && <HistoryChart shot={shot} />}
          {shot.loaded && (
            <ShotNotesCard
              shot={shot}
              onNotesLoaded={handleNotesLoaded}
              onNotesUpdate={handleNotesUpdate}
            />
          )}
        </div>
      )}

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
    </Card>
  );
}
