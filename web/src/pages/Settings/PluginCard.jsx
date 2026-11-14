import { useContext } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Input, Switch } from '../../components/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Tile } from '../../components/Tile.jsx';
import { FieldError, FormErrors } from './fields.jsx';

/**
 * One plugin: a tile with its name and one sentence on the left and its switch on the right. Its
 * settings show under them while it is on.
 *   id           the setting's key, and the switch's id
 *   chip         one Chip beside the name, for an exception such as DEPRECATED
 *   enableLabel  the switch's name for screen readers
 *   onChange     receives what a checkbox would send; without it the plugin has no switch and its
 *                settings always show
 */
export function PluginCard({
  id,
  title,
  help,
  chip,
  enableLabel,
  checked,
  onChange,
  className,
  children,
}) {
  const hasSwitch = !!onChange;
  const report = next => {
    const target = { id, name: id, checked: next, value: 'on' };
    onChange({ target, currentTarget: target });
  };

  return (
    <Tile className={className}>
      <div className='flex items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-col gap-1'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <h2 className='bm-sub'>{title}</h2>
            {chip}
          </div>
          {help && <p className='bm-help'>{help}</p>}
        </div>
        {hasSwitch && (
          <Switch
            id={id}
            name={id}
            label={enableLabel}
            checked={!!checked}
            aria-controls={checked ? `${id}-settings` : undefined}
            onChange={report}
          />
        )}
      </div>
      {(checked || !hasSwitch) && (
        <div id={`${id}-settings`} className='flex flex-col gap-3'>
          {children}
        </div>
      )}
    </Tile>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The time of one schedule. It has a row to itself until the tile is wide enough for the days too.
function WakeTime({ id, value, onChange }) {
  const error = useContext(FormErrors)[id];
  return (
    <div className='flex w-full flex-col gap-1.5 @lg:w-36'>
      <Input
        id={id}
        type='time'
        aria-label='Wake time'
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={onChange}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/**
 * The times the machine wakes at: one row per schedule with its time, the days it applies to and
 * a button that removes it. The last schedule stays.
 */
export function WakeSchedules({ schedules, onAdd, onRemove, onTimeChange, onDayChange }) {
  return (
    <>
      <div className='bm-list @container'>
        {schedules?.map((schedule, scheduleIndex) => (
          <div key={scheduleIndex} className='bm-item flex-wrap gap-2'>
            <WakeTime
              id={`autowakeupTime-${scheduleIndex}`}
              value={schedule.time}
              onChange={e => onTimeChange(scheduleIndex, e.target.value)}
            />
            <div
              role='group'
              aria-label='Days of week selection'
              className='bm-seg bm-seg--block min-w-0 flex-1 @lg:max-w-sm'
            >
              {DAYS.map((day, dayIndex) => (
                <button
                  key={day}
                  type='button'
                  className='bm-seg__item px-0'
                  aria-pressed={!!schedule.days[dayIndex]}
                  aria-label={day}
                  title={day}
                  onClick={() => onDayChange(scheduleIndex, dayIndex, !schedule.days[dayIndex])}
                >
                  {day[0]}
                </button>
              ))}
            </div>
            <Button
              iconOnly
              variant='danger'
              aria-label='Delete this schedule'
              title={
                schedules.length > 1 ? 'Delete this schedule' : 'Cannot delete the last schedule'
              }
              disabled={schedules.length <= 1}
              onClick={() => onRemove(scheduleIndex)}
            >
              <Icon name='trash-2' size={20} />
            </Button>
          </div>
        ))}
      </div>
      <Button className='self-start' onClick={onAdd}>
        <Icon name='plus' size={18} />
        Add schedule
      </Button>
    </>
  );
}
