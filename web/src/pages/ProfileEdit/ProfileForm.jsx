import { FormErrors } from '../../components/FormField.jsx';
import { PinnedAction } from '../../components/PinnedAction.jsx';
import { Spinner } from '../../components/Spinner.jsx';

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
      <FormErrors.Provider value={validation.errors}>{children}</FormErrors.Provider>
      <PinnedAction
        type='submit'
        disabled={saving}
        aria-label={saving ? 'Saving profile' : 'Save profile'}
      >
        Save
        {saving && <Spinner size={4} />}
      </PinnedAction>
    </form>
  );
}
