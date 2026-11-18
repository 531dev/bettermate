import { useEffect } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Notice } from '../../components/Notice.jsx';
import { installUpdate, requestUpdateInfo, updateVersion } from '../../utils/machineState.js';

/**
 * Update ready, at the top of Settings and nowhere else: the version and INSTALL. Installing
 * takes the window until the machine is back.
 */
export function UpdateNotice({ className }) {
  useEffect(requestUpdateInfo, []);
  const version = updateVersion.value;
  return (
    <Notice
      page
      tone='info'
      className={className}
      title={version ? `Version ${version} is ready` : 'An update is ready'}
      actions={
        <>
          <Button variant='outline' onClick={() => installUpdate()}>
            Install
          </Button>
          <Button variant='ghost' href='/settings/system'>
            Details
          </Button>
        </>
      }
    >
      Back up your profiles first. Installing takes a few minutes, and the machine restarts.
    </Notice>
  );
}
