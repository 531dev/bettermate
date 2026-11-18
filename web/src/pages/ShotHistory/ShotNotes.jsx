import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { CardTitle } from '../../components/CardTitle.jsx';
import { Field, Input, Textarea } from '../../components/Field.jsx';
import { SegmentBar } from '../../components/SegmentBar.jsx';
import { Segmented } from '../../components/Segmented.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { Stepper } from '../../components/Stepper.jsx';
import { ApiServiceContext } from '../../services/ApiService.js';

const TASTES = [
  { value: 'bitter', label: 'Bitter' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'sour', label: 'Sour' },
];
const MAX_NOTES = 200;

const blankNotes = shot => ({
  id: shot.id,
  rating: 0,
  beanType: '',
  doseIn: '',
  doseOut: '',
  ratio: '',
  grindSetting: '',
  balanceTaste: 'balanced',
  notes: '',
});

function calculateRatio(doseIn, doseOut) {
  if (doseIn && doseOut && parseFloat(doseIn) > 0 && parseFloat(doseOut) > 0) {
    return (parseFloat(doseOut) / parseFloat(doseIn)).toFixed(2);
  }
  return '';
}

/** What was written down about a shot, and the form that writes it. */
export default function ShotNotes({ shot, onNotesUpdate, onNotesLoaded }) {
  const apiService = useContext(ApiServiceContext);

  const [notes, setNotes] = useState(() => blankNotes(shot));
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  // What is saved, so Cancel can put it back.
  const saved = useRef(notes);

  // Load notes ONLY on component mount
  useEffect(() => {
    if (initialLoaded) return; // Prevent reloading

    const loadNotes = async () => {
      let loadedNotes = blankNotes(shot);
      try {
        const response = await apiService.request({
          tp: 'req:history:notes:get',
          id: shot.id,
        });

        if (response.notes && Object.keys(response.notes).length > 0) {
          // Parse response.notes if it's a string
          let parsedNotes = response.notes;
          if (typeof response.notes === 'string') {
            try {
              parsedNotes = JSON.parse(response.notes);
            } catch (e) {
              console.warn('Failed to parse notes JSON:', e);
              parsedNotes = {};
            }
          }

          // Merge loaded notes with defaults
          loadedNotes = { ...loadedNotes, ...parsedNotes };
        }
      } catch (error) {
        // Even if loading fails, the defaults below still apply
        console.error('Failed to load notes:', error);
      }

      // Pre-populate doseOut with shot.volume if it's empty and shot.volume exists
      if (!loadedNotes.doseOut && shot.volume) {
        loadedNotes.doseOut = shot.volume.toFixed(1);
      }

      // Calculate ratio from loaded data
      if (loadedNotes.doseIn && loadedNotes.doseOut) {
        loadedNotes.ratio = calculateRatio(loadedNotes.doseIn, loadedNotes.doseOut);
      }

      setNotes(loadedNotes);
      saved.current = loadedNotes;
      setInitialLoaded(true);
      // Pass loaded notes to parent
      if (onNotesLoaded) {
        onNotesLoaded(loadedNotes);
      }
    };

    loadNotes();
    // No dependencies - only run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset if shot changes
  useEffect(() => {
    if (notes.id !== shot.id) {
      setInitialLoaded(false);
      setIsEditing(false);
    }
  }, [shot.id, notes.id]);

  const saveNotes = async () => {
    setLoading(true);
    try {
      await apiService.request({
        tp: 'req:history:notes:save',
        id: shot.id,
        notes,
      });
      saved.current = notes;
      setIsEditing(false);
      if (onNotesUpdate) {
        onNotesUpdate(notes);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelEditing = () => {
    setNotes(saved.current);
    setIsEditing(false);
  };

  const handleInputChange = useCallback(
    (field, value) => {
      setNotes(prev => {
        const newNotes = { ...prev, [field]: value };

        // Only recalculate ratio if we're changing doseIn or doseOut
        if ((field === 'doseIn' || field === 'doseOut') && initialLoaded) {
          const doseIn = field === 'doseIn' ? value : prev.doseIn;
          const doseOut = field === 'doseOut' ? value : prev.doseOut;
          newNotes.ratio = calculateRatio(doseIn, doseOut);
        }

        return newNotes;
      });
    },
    [initialLoaded],
  );

  // Empty fields say nothing, so reading a shot only shows what was written down.
  const written =
    notes.rating > 0 ||
    notes.beanType ||
    notes.doseIn ||
    notes.grindSetting ||
    notes.notes ||
    notes.balanceTaste !== 'balanced';

  const head = (
    <div className='bm-tile__head'>
      <CardTitle>Notes</CardTitle>
      {initialLoaded && !isEditing && (
        <Button variant='ghost' className='-mr-2' onClick={() => setIsEditing(true)}>
          {written ? 'Edit' : 'Add notes'}
        </Button>
      )}
    </div>
  );

  if (!isEditing) {
    // The yield is in the row already; it joins the notes once there is a dose to set it against.
    const facts = [
      notes.beanType,
      notes.doseIn && `${notes.doseIn} g in`,
      notes.doseIn && notes.doseOut && `${notes.doseOut} g out`,
      notes.ratio && `1:${notes.ratio}`,
      notes.grindSetting && `grind ${notes.grindSetting}`,
      written && notes.balanceTaste,
    ].filter(Boolean);

    return (
      <section className='flex flex-col gap-2' aria-label='Shot notes'>
        {head}
        {notes.rating > 0 && (
          <div className='flex items-center gap-3'>
            <SegmentBar value={notes.rating / 5} total={5} label={`Rated ${notes.rating} of 5`} />
            <span className='bm-data'>{notes.rating}/5</span>
          </div>
        )}
        {facts.length > 0 && <p className='bm-data'>{facts.join(' · ')}</p>}
        {notes.notes && <p className='whitespace-pre-wrap'>{notes.notes}</p>}
      </section>
    );
  }

  return (
    <section className='flex flex-col gap-3' aria-label='Shot notes'>
      {head}
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Field as='div' label='Rating'>
          <Stepper
            className='self-start'
            value={notes.rating > 0 ? `${notes.rating}/5` : '—'}
            canDecrease={notes.rating > 0}
            canIncrease={notes.rating < 5}
            decreaseLabel='Lower rating'
            increaseLabel='Raise rating'
            onDecrease={() => handleInputChange('rating', Math.max(0, notes.rating - 1))}
            onIncrease={() => handleInputChange('rating', Math.min(5, notes.rating + 1))}
          />
        </Field>

        <Field label='Bean'>
          <Input
            type='text'
            value={notes.beanType}
            onInput={e => handleInputChange('beanType', e.target.value)}
            placeholder='Single origin or blend'
          />
        </Field>

        <Field label='Dose in'>
          <Input
            type='number'
            step='0.1'
            inputMode='decimal'
            unit='g'
            value={notes.doseIn}
            onInput={e => handleInputChange('doseIn', e.target.value)}
            placeholder='18.0'
          />
        </Field>

        <Field label='Dose out' help={`Ratio ${notes.ratio ? `1:${notes.ratio}` : '—'}`}>
          <Input
            type='number'
            step='0.1'
            inputMode='decimal'
            unit='g'
            value={notes.doseOut}
            onInput={e => handleInputChange('doseOut', e.target.value)}
            placeholder='36.0'
          />
        </Field>

        <Field label='Grind setting'>
          <Input
            type='text'
            value={notes.grindSetting}
            onInput={e => handleInputChange('grindSetting', e.target.value)}
            placeholder='2.5 or medium-fine'
          />
        </Field>

        <Field as='div' label='Taste' className='lg:col-span-3'>
          <Segmented
            label='Taste'
            className='self-start'
            options={TASTES}
            value={notes.balanceTaste}
            onChange={value => handleInputChange('balanceTaste', value)}
          />
        </Field>
      </div>

      <Field
        label={
          <>
            Notes{' '}
            <span className='bm-field__count'>
              {notes.notes.length} / {MAX_NOTES}
            </span>
          </>
        }
        help='How it tasted, and what to change next time.'
      >
        <Textarea
          rows='4'
          value={notes.notes}
          maxLength={MAX_NOTES}
          onInput={e => handleInputChange('notes', e.target.value)}
        />
      </Field>

      <div className='flex justify-end gap-2'>
        <Button onClick={cancelEditing} disabled={loading}>
          Cancel
        </Button>
        <Button variant='primary' onClick={saveNotes} disabled={loading}>
          {loading && <Spinner size={4} />}
          Save
        </Button>
      </div>
    </section>
  );
}
