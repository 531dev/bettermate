import { Setting, Switch } from '../../components/Field.jsx';
import { Tile } from '../../components/Tile.jsx';
import { FormField } from '../../components/FormField.jsx';

export function ProfileMainInformation(props) {
  return (
    <Tile title='Profile'>
      <FormField
        id='label'
        name='label'
        label='Name'
        value={props.data?.label}
        onInput={props.onChangeLabel}
        required
      />
      <FormField
        id='description'
        name='description'
        label='Description'
        multiline
        rows={2}
        optional
        value={props.data?.description}
        onInput={props.onChangeDescription}
      />
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <FormField
          id='temperature'
          name='temperature'
          label='Temperature'
          unit='°C'
          type='number'
          value={props.data?.temperature}
          onInput={props.onChangeTemperature}
          aria-label='Temperature in degrees Celsius'
          min='0'
          max='150'
          step='0.1'
        />
        <FormField
          id='dose'
          name='dose'
          label='Coffee dose'
          unit='g'
          type='number'
          optional
          help='Shown as IN on the display. It does not set the grinder target.'
          value={props.data?.dose ?? ''}
          onInput={props.onChangeDose}
          aria-label='Coffee dose in grams'
          min='0.1'
          max='250'
          step='0.1'
        />
      </div>
      <Setting
        label='Utility profile'
        help='Listed under Utility, apart from your coffee profiles.'
        htmlFor='utility'
      >
        <Switch
          id='utility'
          name='utility'
          checked={!!props.data?.utility}
          onChange={props.onChangeUtility}
        />
      </Setting>
    </Tile>
  );
}
