import { useEffect } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Icon } from '../../components/Icon.jsx';

// Press-and-hold aware: a hold-to-flush (flush duration 0) runs until the pointer or key is released.
export function FlushButton({ isFlushing, startFlush, stopFlush }) {
  // The release is caught on the window so it still arrives when the pointer left the button.
  useEffect(() => {
    if (!isFlushing) return undefined;
    window.addEventListener('pointerup', stopFlush);
    window.addEventListener('pointercancel', stopFlush);
    return () => {
      window.removeEventListener('pointerup', stopFlush);
      window.removeEventListener('pointercancel', stopFlush);
    };
  }, [isFlushing, stopFlush]);

  const onKeyDown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      startFlush();
    }
  };
  const onKeyUp = e => {
    if (e.key === 'Enter' || e.key === ' ') stopFlush();
  };
  return (
    <Button
      size='sm'
      // While water runs, the button is what is selected on the tile: ink.
      variant={isFlushing ? 'ink' : undefined}
      onPointerDown={startFlush}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      aria-pressed={isFlushing}
      aria-label='Flush water'
    >
      <Icon name='droplet' size={18} />
      Flush
    </Button>
  );
}
