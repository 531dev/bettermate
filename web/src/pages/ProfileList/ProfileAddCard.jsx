import { Icon } from '../../components/Icon.jsx';
import Card from '../../components/Card.jsx';

export function ProfileAddCard() {
  return (
    <Card sm={12} role='listitem'>
      <a
        href='/profiles/new'
        className='text-base-content hover:text-primary flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-colors'
      >
        <Icon name={'plus'} className='text-4xl' />
        <span className='text-base font-medium'>Add new profile</span>
      </a>
    </Card>
  );
}
