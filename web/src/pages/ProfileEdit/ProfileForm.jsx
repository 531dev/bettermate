import { FormErrors } from '../../components/FormField.jsx';
import { PinnedAction } from '../../components/PinnedAction.jsx';
import { Loader } from '../../components/Loader.jsx';
import { connection } from '../../utils/machineState.js';

/**
 * The frame both editors share: a column of tiles in one form, each field's message, and the
 * page's one primary Button pinned at the bottom.
 *   validation  what `useFormValidation()` returned
 *   onSubmit    runs once every field is valid
 */
export function ProfileForm({ validation, saving, onSubmit, children }) {
  const offline = connection.value === 'offline';
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
      {/* Saving keeps the Button's width and says so; offline it waits, and says why. */}
      <PinnedAction
        type='submit'
        disabled={saving || offline}
        aria-busy={saving ? 'true' : undefined}
        aria-label={saving ? 'Saving profile' : 'Save profile'}
        status={
          offline ? (
            <p className='bm-help'>The machine is offline. Save once it is back.</p>
          ) : undefined
        }
      >
        {saving && <Loader size={18} />}
        {saving ? 'Saving' : 'Save'}
      </PinnedAction>
    </form>
  );
}
