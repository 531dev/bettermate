/**
 * The library bar: one tile that names the loaded shot and its profile (two rows in a
 * comparison) and holds the actions on them. Each row takes dropped files for its own shot.
 */

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { cx } from '../../../../components/cx.js';
import { Tile } from '../../../../components/Tile.jsx';
import { AnalyzerActionBar } from '../AnalyzerActionBar';
import { StatusBar } from './StatusBar';
import './LibraryBar.css';

function hasFileDrag(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  if (Array.isArray(types)) return types.includes('Files');
  if (typeof types.contains === 'function') return types.contains('Files');
  return false;
}

/**
 * A place that takes dropped files. `isDropzoneActive` is true while a file is dragged over the
 * window, so the place can show itself before the file reaches it.
 */
function useFileDropzone({ onImport, isImporting = false }) {
  const dragDepthRef = useRef(0);
  const dragResetTimerRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isWindowFileDragActive, setIsWindowFileDragActive] = useState(false);
  const isDropzoneActive = !isImporting && (isDragActive || isWindowFileDragActive);

  const clearDragResetTimer = useCallback(() => {
    if (dragResetTimerRef.current) {
      globalThis.window?.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
  }, []);

  const clearDragState = useCallback(() => {
    clearDragResetTimer();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setIsWindowFileDragActive(false);
  }, [clearDragResetTimer]);

  const armDragResetTimer = useCallback(() => {
    clearDragResetTimer();
    dragResetTimerRef.current = globalThis.window?.setTimeout(() => {
      clearDragState();
    }, 350);
  }, [clearDragResetTimer, clearDragState]);

  useEffect(() => {
    if (isImporting) {
      clearDragState();
      return undefined;
    }
    if (globalThis.window === undefined) return undefined;

    const handleWindowDragEnter = event => {
      if (!hasFileDrag(event)) return;
      setIsWindowFileDragActive(true);
      armDragResetTimer();
    };

    const handleWindowDragOver = event => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      setIsWindowFileDragActive(true);
      event.dataTransfer.dropEffect = 'copy';
      armDragResetTimer();
    };

    const handleWindowDragLeave = event => {
      const isOutsideWindow =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= globalThis.window.innerWidth ||
        event.clientY >= globalThis.window.innerHeight;
      if (isOutsideWindow) clearDragState();
    };

    const handleWindowDrop = event => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      clearDragState();
    };

    globalThis.window.addEventListener('dragenter', handleWindowDragEnter);
    globalThis.window.addEventListener('dragover', handleWindowDragOver);
    globalThis.window.addEventListener('dragleave', handleWindowDragLeave);
    globalThis.window.addEventListener('drop', handleWindowDrop);
    globalThis.window.addEventListener('dragend', clearDragState);

    return () => {
      globalThis.window.removeEventListener('dragenter', handleWindowDragEnter);
      globalThis.window.removeEventListener('dragover', handleWindowDragOver);
      globalThis.window.removeEventListener('dragleave', handleWindowDragLeave);
      globalThis.window.removeEventListener('drop', handleWindowDrop);
      globalThis.window.removeEventListener('dragend', clearDragState);
      clearDragResetTimer();
    };
  }, [armDragResetTimer, clearDragResetTimer, clearDragState, isImporting]);

  const dropzoneProps = {
    onDragEnter: event => {
      if (isImporting || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current += 1;
      setIsDragActive(true);
      armDragResetTimer();
    },
    onDragOver: event => {
      if (isImporting || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      if (!isDragActive) setIsDragActive(true);
      armDragResetTimer();
    },
    onDragLeave: event => {
      if (isImporting || !isDragActive) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragActive(false);
    },
    onDrop: event => {
      if (isImporting || !hasFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      clearDragState();
      const files = Array.from(event.dataTransfer.files || []);
      if (files.length > 0) onImport?.(files);
    },
  };

  return { isDropzoneActive, dropzoneProps };
}

/** The second shot of a comparison: its row is a dropzone of its own. */
function SecondaryStatusRow({ statusBarProps, onImport, isImporting }) {
  const { isDropzoneActive, dropzoneProps } = useFileDropzone({ onImport, isImporting });

  return <StatusBar {...statusBarProps} isDropTarget={isDropzoneActive} dropzoneProps={dropzoneProps} />;
}

export function LibraryPanelStatusSlots({
  collapsed,
  compareMode,
  primaryActionBarProps,
  primaryStatusBarProps,
  secondaryStatusBarProps,
  onSecondaryImport,
}) {
  const isImporting = Boolean(primaryActionBarProps?.isImporting);
  // The first shot's row and the action row under it take files for the first shot.
  const { isDropzoneActive, dropzoneProps } = useFileDropzone({
    onImport: primaryActionBarProps?.onImport,
    isImporting,
  });

  return (
    <Tile className={cx('an-libbar', !collapsed && 'is-open')} aria-label='Loaded shot and profile'>
      <div className='an-libbar__rows'>
        <StatusBar
          {...primaryStatusBarProps}
          compareBadgeNumber={compareMode ? 1 : null}
          isDropTarget={isDropzoneActive}
          dropzoneProps={dropzoneProps}
        />
        {compareMode ? (
          <SecondaryStatusRow
            statusBarProps={secondaryStatusBarProps}
            onImport={onSecondaryImport}
            isImporting={isImporting}
          />
        ) : null}
      </div>
      <AnalyzerActionBar
        {...primaryActionBarProps}
        isFileDragActive={isDropzoneActive}
        dropzoneProps={dropzoneProps}
      />
    </Tile>
  );
}
