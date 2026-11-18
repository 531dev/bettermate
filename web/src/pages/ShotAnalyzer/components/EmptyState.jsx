/**
 * What the analyzer shows before a shot is loaded: where shots and profiles can come from, how
 * to import one, and the keys that drive the tool.
 */
import { Chip } from '../../../components/Chip.jsx';
import { Icon } from '../../../components/Icon.jsx';
import { Loader } from '../../../components/Loader.jsx';
import { Tile } from '../../../components/Tile.jsx';
import '../ui/tool.css';

const SOURCES = [
  {
    icon: 'coffee',
    title: 'On the machine',
    text: 'Shots and profiles the machine has saved.',
  },
  {
    icon: 'eye',
    title: 'Opened for now',
    text: 'With View, an imported file opens for this visit and is not saved.',
  },
  {
    icon: 'monitor',
    title: 'In this browser',
    text: 'With Save, an imported file is kept in this browser on this device. Other browsers and devices do not see it.',
  },
];

const KEYS = [
  { keys: 'X', text: 'Open or close the library.' },
  { keys: 'C', text: 'Start or end a comparison.' },
  { keys: '← →', text: 'Go to the previous or next shot.' },
];

export function EmptyState({ loading }) {
  if (loading) {
    return (
      <p
        className='flex min-h-[20vh] items-center justify-center gap-3 p-8 text-(--ink-muted)'
        aria-busy='true'
      >
        <Loader size={24} />
        Loading the shot
      </p>
    );
  }

  return (
    <Tile>
      <div className='flex flex-col gap-1'>
        <h2 className='bm-heading'>No shot loaded</h2>
        <p className='bm-help'>Pick a shot from the library above, or import a shot file.</p>
      </div>

      <div className='bm-list'>
        {SOURCES.map(source => (
          <div key={source.title} className='bm-item'>
            <span className='bm-item__icon'>
              <Icon name={source.icon} size={20} />
            </span>
            <span className='bm-item__body'>
              <span className='bm-item__title block'>{source.title}</span>
              <span className='bm-help block'>{source.text}</span>
            </span>
          </div>
        ))}
      </div>

      <p className='bm-help'>
        Drop files on the bar above or press Import. Several files at once work too. Choose View or
        Save beside Import before you bring a file in.
      </p>

      <hr className='an-rule' />

      <div className='grid gap-x-5 gap-y-2 sm:grid-cols-3'>
        {KEYS.map(item => (
          <div key={item.keys} className='flex items-center gap-3'>
            <Chip>{item.keys}</Chip>
            <span className='bm-help'>{item.text}</span>
          </div>
        ))}
      </div>
    </Tile>
  );
}
