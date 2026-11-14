import { Icon } from '../../components/Icon.jsx';
import { List, ListRow } from '../../components/ListRow.jsx';
import { Tile } from '../../components/Tile.jsx';

const TYPES = [
  { type: 'standard', icon: 'list', title: 'Simple', meta: 'Time and weight targets' },
  { type: 'pro', icon: 'chart-column', title: 'Pro', meta: 'Pressure, flow and ramps' },
];

export function ProfileTypeSelection({ onSelect }) {
  return (
    <Tile title='Choose a type'>
      <List>
        {TYPES.map(({ type, icon, title, meta }) => (
          <ListRow
            key={type}
            onClick={() => onSelect(type)}
            icon={icon}
            title={title}
            meta={meta}
            end={<Icon name='chevron-right' size={20} />}
          />
        ))}
      </List>
      <p className='bm-help'>
        A simple profile runs its phases one after another. A Pro profile also sets pressure or flow
        in each phase, ramps between them and draws the shot as a chart.
      </p>
    </Tile>
  );
}
