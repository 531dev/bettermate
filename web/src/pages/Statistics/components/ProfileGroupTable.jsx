import { Tile } from '../../../components/Tile.jsx';
import { fmt } from '../utils/format';

export function ProfileGroupTable({ profileGroups, showTitle = true }) {
  if (!profileGroups || profileGroups.length === 0) return null;

  return (
    <Tile title={showTitle ? 'Per-profile statistics' : undefined}>
      <div className='an-scroll overflow-x-auto'>
        <table className='bm-table'>
          <thead>
            <tr>
              <th>Profile</th>
              <th className='text-right'>Shots</th>
              <th className='text-right'>Duration</th>
              <th className='text-right'>Weight</th>
              <th className='text-right'>Pumped water</th>
              <th className='text-right'>Pressure</th>
              <th className='text-right'>Pump flow</th>
            </tr>
          </thead>
          <tbody>
            {profileGroups.map(group => (
              <tr key={group.profileName}>
                <td className='bm-label whitespace-nowrap'>{group.profileName}</td>
                <td className='text-right'>{group.shotCount}</td>
                <td className='text-right whitespace-nowrap'>{fmt(group.avgDuration)} s</td>
                <td className='text-right whitespace-nowrap'>{fmt(group.avgWeight)} g</td>
                <td className='text-right whitespace-nowrap'>{fmt(group.avgWater)} ml</td>
                <td className='text-right whitespace-nowrap'>{fmt(group.metrics.p?.avg)} bar</td>
                <td className='text-right whitespace-nowrap'>{fmt(group.metrics.f?.avg)} ml/s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='bm-caption'>Averages over the shots of each profile.</p>
    </Tile>
  );
}
