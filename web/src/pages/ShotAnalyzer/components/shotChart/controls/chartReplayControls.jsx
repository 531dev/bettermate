import { useRef } from 'preact/hooks';
import { Button } from '../../../../../components/Button.jsx';
import { cx } from '../../../../../components/cx.js';
import { Checkbox, Radio, Setting, Switch } from '../../../../../components/Field.jsx';
import { IconButton } from '../../../ui/IconButton.jsx';
import { Popover } from '../../../ui/Popover.jsx';

function getReplayActionLabel({ isReplaying, isReplayPaused }) {
  if (isReplaying) return 'Pause replay';
  if (isReplayPaused) return 'Resume replay';
  return 'Replay chart';
}

function ChartActionDivider() {
  return <span className='shot-chart-action-divider' aria-hidden='true' />;
}

/**
 * The export button and its panel: what to export (a replay video, an image of the chart, or the
 * shot and profile files) and how. The panel is a Popover, so a press outside or Escape closes it.
 */
function ShotMediaExportMenu({
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isControlsLocked,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  profileExportAvailable,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onIncludeLegendChange,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
  placement = 'bottom-end',
}) {
  const localAnchorRef = useRef(null);
  const anchorRef = exportMenuRef || localAnchorRef;
  const fileExportTypes = ['shot', 'profile'].filter(type =>
    exportMenuState.exportType?.includes(type),
  );

  const handleFileExportTypeToggle = fileExportType => {
    const nextExportType = fileExportTypes.includes(fileExportType)
      ? fileExportTypes.filter(type => type !== fileExportType)
      : [...fileExportTypes, fileExportType];
    onExportTypeChange(nextExportType.join('+') || null);
  };

  return (
    <>
      <IconButton
        ref={anchorRef}
        icon='download'
        label='Export'
        onClick={onExportMenuToggle}
        disabled={isControlsLocked}
        aria-expanded={exportMenuState.open}
        aria-haspopup='dialog'
      />
      <Popover
        open={exportMenuState.open}
        onClose={onCloseExportMenu}
        anchor={anchorRef}
        placement={placement}
        label='Export'
        width='min(92vw, 17rem)'
      >
        <div className='shot-chart-export__group'>
          <span className='bm-eyebrow'>Export chart</span>
          <Radio
            name='shot-chart-export-type'
            label={hasVideoExportSupport ? 'Video' : 'Video (not supported here)'}
            checked={exportMenuState.exportType === 'video'}
            disabled={!hasVideoExportSupport}
            onChange={() => onExportTypeChange('video')}
          />
          <Radio
            name='shot-chart-export-type'
            label='Image'
            checked={exportMenuState.exportType === 'image'}
            onChange={() => onExportTypeChange('image')}
          />
          <Setting label='Include legend' htmlFor='shot-chart-export-legend'>
            <Switch
              id='shot-chart-export-legend'
              checked={exportMenuState.includeLegend}
              onChange={onIncludeLegendChange}
            />
          </Setting>
          {exportMenuState.exportType === 'video' && shouldShowWebmToggle ? (
            <>
              <Setting label='Export as WebM' htmlFor='shot-chart-export-webm'>
                <span className='flex items-center gap-1'>
                  <IconButton
                    icon='info'
                    label='Explain WebM export'
                    size='sm'
                    onClick={onExportFormatInfoToggle}
                    aria-expanded={exportMenuState.showFormatInfo}
                  />
                  <Switch
                    id='shot-chart-export-webm'
                    checked={exportMenuState.exportFormat === 'webm'}
                    disabled={shouldLockWebmToggle}
                    onChange={next => onExportFormatChange(next ? 'webm' : 'mp4')}
                  />
                </span>
              </Setting>
              {exportMenuState.showFormatInfo ? (
                <p className='bm-help'>
                  {shouldLockWebmToggle
                    ? 'This browser records replay video as WebM natively.'
                    : 'WebM is the recommended replay video format in browsers with native WebM recording support.'}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className='shot-chart-export__group'>
          <span className='bm-eyebrow'>Export file</span>
          <Checkbox
            label='Shot'
            checked={fileExportTypes.includes('shot')}
            onChange={() => handleFileExportTypeToggle('shot')}
          />
          <Checkbox
            label='Profile'
            checked={fileExportTypes.includes('profile')}
            disabled={!profileExportAvailable}
            onChange={() => handleFileExportTypeToggle('profile')}
          />
        </div>
        <div className='flex items-center justify-end gap-2'>
          <Button size='sm' onClick={onCloseExportMenu}>
            Cancel
          </Button>
          <Button size='sm' variant='ink' onClick={onExportAction}>
            Export
          </Button>
        </div>
      </Popover>
    </>
  );
}

function ReplayActionButton({ isControlsLocked, isReplayPaused, isReplaying, onReplayToggle }) {
  return (
    <IconButton
      icon={isReplaying ? 'pause' : 'play'}
      label={getReplayActionLabel({ isReplaying, isReplayPaused })}
      onClick={onReplayToggle}
      disabled={isControlsLocked}
    />
  );
}

function StopReplayButton({ isReplayExporting, isVideoExportActive, onStop }) {
  return (
    <IconButton
      icon='stop'
      label={isVideoExportActive ? 'Cancel replay export' : 'Stop replay and restore chart'}
      onClick={onStop}
      disabled={isReplayExporting && !isVideoExportActive}
    />
  );
}

export function ShotChartMobileReplayActions({
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isControlsLocked,
  isReplayPaused,
  isReplaying,
  isReplayExporting,
  isVideoExportActive,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  profileExportAvailable,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onIncludeLegendChange,
  onReplayToggle,
  onStop,
  replayExportStatus,
  replayExportStatusHint,
  replayExportStatusLabel,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
}) {
  return (
    <div className='shot-chart-mobile-actions'>
      <div className='shot-chart-mobile-actions__group'>
        <ReplayActionButton
          isControlsLocked={isControlsLocked}
          isReplayPaused={isReplayPaused}
          isReplaying={isReplaying}
          onReplayToggle={onReplayToggle}
        />
        <StopReplayButton
          isReplayExporting={isReplayExporting}
          isVideoExportActive={isVideoExportActive}
          onStop={onStop}
        />
      </div>

      <div className='shot-chart-mobile-actions__group shot-chart-mobile-actions__group--right'>
        <ShotMediaExportMenu
          exportMenuRef={exportMenuRef}
          exportMenuState={exportMenuState}
          hasVideoExportSupport={hasVideoExportSupport}
          isControlsLocked={isControlsLocked}
          onCloseExportMenu={onCloseExportMenu}
          onExportAction={onExportAction}
          onExportMenuToggle={onExportMenuToggle}
          profileExportAvailable={profileExportAvailable}
          onExportTypeChange={onExportTypeChange}
          onExportFormatChange={onExportFormatChange}
          onExportFormatInfoToggle={onExportFormatInfoToggle}
          onIncludeLegendChange={onIncludeLegendChange}
          shouldLockWebmToggle={shouldLockWebmToggle}
          shouldShowWebmToggle={shouldShowWebmToggle}
          placement='top-end'
        />
      </div>

      <div className='shot-chart-mobile-actions__status'>
        <ReplayExportStatus
          replayExportStatus={replayExportStatus}
          replayExportStatusHint={replayExportStatusHint}
          replayExportStatusLabel={replayExportStatusLabel}
        />
      </div>
    </div>
  );
}

function FullDisplayButton({ isControlsLocked, isFullDisplay, onFullDisplayToggle }) {
  return (
    <IconButton
      icon={isFullDisplay ? 'x' : 'monitor'}
      label={isFullDisplay ? 'Close full display' : 'Open full display'}
      onClick={onFullDisplayToggle}
      disabled={isControlsLocked}
    />
  );
}

/** Replay, stop, export and full display: the actions at the right of a chart's head row. */
export function ChartActionGroup({
  exportMenuRef,
  exportMenuState,
  hasVideoExportSupport,
  isCompareMode,
  isControlsLocked,
  isFullDisplay,
  isMobile,
  isReplayPaused,
  isReplaying,
  isReplayExporting,
  isVideoExportActive,
  onCloseExportMenu,
  onExportAction,
  onExportMenuToggle,
  profileExportAvailable,
  onExportTypeChange,
  onExportFormatChange,
  onExportFormatInfoToggle,
  onFullDisplayToggle,
  onIncludeLegendChange,
  onReplayToggle,
  onStop,
  shouldLockWebmToggle,
  shouldShowWebmToggle,
  showExportButton,
  showFullDisplayButton,
  showReplayButton,
  showStopButton,
}) {
  const shouldShowFullDisplayButton = showFullDisplayButton && !isMobile;
  const showsReplay = !isCompareMode && (showReplayButton || showStopButton);
  const showsExport = !isCompareMode && showExportButton;

  return (
    <div className='flex items-center gap-1'>
      {showsReplay && showReplayButton ? (
        <ReplayActionButton
          isControlsLocked={isControlsLocked}
          isReplayPaused={isReplayPaused}
          isReplaying={isReplaying}
          onReplayToggle={onReplayToggle}
        />
      ) : null}
      {showsReplay && showStopButton ? (
        <StopReplayButton
          isReplayExporting={isReplayExporting}
          isVideoExportActive={isVideoExportActive}
          onStop={onStop}
        />
      ) : null}
      {showsReplay && (showsExport || shouldShowFullDisplayButton) ? <ChartActionDivider /> : null}
      {showsExport ? (
        <ShotMediaExportMenu
          exportMenuRef={exportMenuRef}
          exportMenuState={exportMenuState}
          hasVideoExportSupport={hasVideoExportSupport}
          isControlsLocked={isControlsLocked}
          onCloseExportMenu={onCloseExportMenu}
          onExportAction={onExportAction}
          onExportMenuToggle={onExportMenuToggle}
          profileExportAvailable={profileExportAvailable}
          onExportTypeChange={onExportTypeChange}
          onExportFormatChange={onExportFormatChange}
          onExportFormatInfoToggle={onExportFormatInfoToggle}
          onIncludeLegendChange={onIncludeLegendChange}
          shouldLockWebmToggle={shouldLockWebmToggle}
          shouldShowWebmToggle={shouldShowWebmToggle}
        />
      ) : null}
      {shouldShowFullDisplayButton ? (
        <FullDisplayButton
          isControlsLocked={isControlsLocked}
          isFullDisplay={isFullDisplay}
          onFullDisplayToggle={onFullDisplayToggle}
        />
      ) : null}
    </div>
  );
}

/** What the export is doing, as a line of text; a failure is set in the danger colour. */
export function ReplayExportStatus({
  replayExportStatus,
  replayExportStatusHint,
  replayExportStatusLabel,
}) {
  if (!replayExportStatusLabel) return null;

  return (
    <div className='shot-chart-export-status' role='status'>
      <div className={cx('an-caption', replayExportStatus.error && 'text-(--danger)')}>
        {replayExportStatusLabel}
      </div>
      {replayExportStatusHint ? <div className='an-caption'>{replayExportStatusHint}</div> : null}
    </div>
  );
}
