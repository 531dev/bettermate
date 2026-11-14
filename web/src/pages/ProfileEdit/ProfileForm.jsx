import { Button } from '../../components/Button.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { FormErrors } from './form.jsx';

/**
 * The frame both editors share: a column of tiles in one form, each field's message, and the
 * page's one primary Button pinned at the bottom.
 *   validation  what `useFormValidation()` returned
 *   onSubmit    runs once every field is valid
 */
export function ProfileForm({ validation, saving, onSubmit, children }) {
  return (
    <form
      className='flex flex-col gap-2 lg:gap-3'
      {...validation.formProps}
      onSubmit={e => {
        e.preventDefault();
        validation.clearErrors();
        onSubmit();
      }}
    >
      <FormErrors value={validation.errors}>{children}</FormErrors>
      <div className='bm-pinned'>
        <Button
          type='submit'
          variant='primary'
          size='lg'
          block
          disabled={saving}
          aria-label={saving ? 'Saving profile' : 'Save profile'}
        >
          Save
          {saving && <Spinner size={4} />}
        </Button>
      </div>
    </form>
  );
}
