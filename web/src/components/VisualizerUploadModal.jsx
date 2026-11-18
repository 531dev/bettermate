import { useState, useEffect } from 'preact/hooks';
import { Button } from './Button.jsx';
import { Checkbox, Field, Input } from './Field.jsx';
import { Icon } from './Icon.jsx';
import { Dialog } from './Dialog.jsx';
import { Loader } from './Loader.jsx';
import { Cell } from './Tile.jsx';
import { dateTime } from '../utils/time.js';

export default function VisualizerUploadModal({
  isOpen,
  onClose,
  onUpload,
  isUploading = false,
  shotInfo,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert('Please enter both username and password');
      return;
    }

    try {
      await onUpload(username.trim(), password, rememberCredentials);

      // Save credentials to localStorage if requested
      if (rememberCredentials) {
        localStorage.setItem('visualizer_username', username.trim());
        localStorage.setItem('visualizer_password', password);
        localStorage.setItem('visualizer_remember', 'true');
      } else {
        localStorage.removeItem('visualizer_username');
        localStorage.removeItem('visualizer_password');
        localStorage.removeItem('visualizer_remember');
      }

      // Clear form and close modal on success
      setUsername('');
      setPassword('');
      onClose();
    } catch (error) {
      // Error handling is done in parent component
      console.error('Upload failed:', error);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setUsername('');
      setPassword('');
      onClose();
    }
  };

  // Load saved credentials when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedUsername = localStorage.getItem('visualizer_username');
      const savedPassword = localStorage.getItem('visualizer_password');
      const savedRemember = localStorage.getItem('visualizer_remember') === 'true';

      if (savedRemember && savedUsername) {
        setUsername(savedUsername);
        setRememberCredentials(true);
        if (savedPassword) {
          setPassword(savedPassword);
        }
      }
    }
  }, [isOpen]);

  const shotFacts = shotInfo && [
    dateTime(shotInfo.timestamp),
    `${(shotInfo.duration / 1000).toFixed(1)} s`,
    shotInfo.volume > 0 && `${shotInfo.volume} g`,
  ];

  return (
    <Dialog
      close
      open={isOpen}
      onClose={handleClose}
      title='Upload to Visualizer'
      dismissable={!isUploading}
    >
      {shotInfo && (
        <Cell>
          <span className='bm-field__label'>{shotInfo.profile}</span>
          <span className='bm-data'>{shotFacts.filter(Boolean).join(' · ')}</span>
        </Cell>
      )}

      <form
        onSubmit={handleSubmit}
        className='flex flex-col gap-3'
        name='visualizer-login'
        method='post'
      >
        <Field label='Visualizer.coffee username'>
          <Input
            id='username'
            name='username'
            type='text'
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={isUploading}
            autoComplete='username'
            required
            data-autofocus
          />
        </Field>

        <Field label='Password' htmlFor='password'>
          <div className='flex gap-2'>
            <Input
              id='password'
              name='password'
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isUploading}
              autoComplete='current-password'
              required
              className='min-w-0 flex-1'
            />
            <Button
              iconOnly
              className='shrink-0'
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
              disabled={isUploading}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} />
            </Button>
          </div>
        </Field>

        <Checkbox
          id='remember'
          checked={rememberCredentials}
          onChange={e => setRememberCredentials(e.target.checked)}
          disabled={isUploading}
          label='Remember on this device'
        />
        <p className='bm-help'>
          Your username and password are sent only for this upload. They stay in this browser if you
          choose to remember them.
        </p>

        <div className='bm-dialog__actions'>
          <Button onClick={handleClose} disabled={isUploading}>
            Keep it here
          </Button>
          <Button
            type='submit'
            variant='primary'
            disabled={isUploading || !username.trim() || !password.trim()}
            aria-busy={isUploading}
          >
            {isUploading && <Loader size={18} />}
            {isUploading ? 'Uploading' : 'Upload'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
