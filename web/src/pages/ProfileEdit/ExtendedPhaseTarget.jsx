import { Button } from '../../components/Button.jsx';
import { Icon } from '../../components/Icon.jsx';
import { FormField } from '../../components/FormField.jsx';

export const TargetTypes = [
  {
    label: 'Water drawn',
    type: 'pumped',
    operator: 'gte',
    unit: 'ml',
  },
  {
    label: 'Weight reached',
    type: 'volumetric',
    operator: 'gte',
    unit: 'g',
  },
  {
    label: 'Pressure above',
    type: 'pressure',
    operator: 'gte',
    unit: 'bar',
  },
  {
    label: 'Pressure below',
    type: 'pressure',
    operator: 'lte',
    unit: 'bar',
  },
  {
    label: 'Flow above',
    type: 'flow',
    operator: 'gte',
    unit: 'ml/s',
  },
  {
    label: 'Flow below',
    type: 'flow',
    operator: 'lte',
    unit: 'ml/s',
  },
];

export function ExtendedPhaseTarget({ onChange, target, index, onRemove }) {
  const targetType =
    TargetTypes.find(tt => tt.type === target.type && tt.operator === (target.operator || 'gte')) ||
    TargetTypes[0];
  return (
    <div className='flex items-start gap-2'>
      <FormField
        className='min-w-0 flex-1'
        id={`phase-${index}-target-value`}
        label={targetType.label}
        unit={targetType.unit}
        type='number'
        value={target.value || 0}
        onInput={e =>
          onChange({
            ...target,
            value: parseFloat(e.target.value),
          })
        }
        aria-label={`${targetType.label} in ${targetType.unit}`}
        min='0'
        step='0.1'
      />
      {/* The label above the input is 24px tall with its gap: the button lines up with the input. */}
      <Button
        iconOnly
        className='mt-6 shrink-0'
        aria-label='Remove target'
        onClick={() => onRemove()}
      >
        <Icon name='x' />
      </Button>
    </div>
  );
}
