import { Button } from '../components/Button.jsx';
import { Dial } from '../components/Dial.jsx';
import PageLayout from '../components/PageLayout.jsx';
import { Tile } from '../components/Tile.jsx';

// An address that leads nowhere: the dial with nothing lit, and the way back.
export function NotFound() {
  return (
    <PageLayout variant='narrow'>
      <Tile className='items-center text-center'>
        <h1 className='sr-only'>Page not found</h1>
        <Dial full={[0, -1, 'ink']} eyebrow='Error' value='404' plan='Page not found' />
        <p className='bm-help'>Nothing on the machine lives at this address.</p>
        <Button variant='primary' href='/'>
          Open dashboard
        </Button>
      </Tile>
    </PageLayout>
  );
}
