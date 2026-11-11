import { Icon } from '../../components/Icon.jsx';
import { useState, useEffect, useContext, useCallback } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';

export default function ShotNotesCard({ shot, onNotesUpdate, onNotesLoaded }) {
  const apiService = useContext(ApiServiceContext);

  const [notes, setNotes] = useState({
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

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Calculate ratio function
  const calculateRatio = useCallback((doseIn, doseOut) => {
    if (doseIn && doseOut && parseFloat(doseIn) > 0 && parseFloat(doseOut) > 0) {
      return (parseFloat(doseOut) / parseFloat(doseIn)).toFixed(2);
    }
    return '';
  }, []);

  // Load notes ONLY on component mount
  useEffect(() => {
    if (initialLoaded) return; // Prevent reloading

    const loadNotes = async () => {
      try {
        const response = await apiService.request({
          tp: 'req:history:notes:get',
          id: shot.id,
        });

        let loadedNotes = {
          id: shot.id,
          rating: 0,
          beanType: '',
          doseIn: '',
          doseOut: '',
          ratio: '',
          grindSetting: '',
          balanceTaste: 'balanced',
          notes: '',
        };

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

        // Pre-populate doseOut with shot.volume if it's empty and shot.volume exists
        if (!loadedNotes.doseOut && shot.volume) {
          loadedNotes.doseOut = shot.volume.toFixed(1);
        }

        // Calculate ratio from loaded data
        if (loadedNotes.doseIn && loadedNotes.doseOut) {
          loadedNotes.ratio = calculateRatio(loadedNotes.doseIn, loadedNotes.doseOut);
        }

        setNotes(loadedNotes);
        setInitialLoaded(true);
        // Pass loaded notes to parent
        if (onNotesLoaded) {
          onNotesLoaded(loadedNotes);
        }
      } catch (error) {
        console.error('Failed to load notes:', error);

        // Even if loading fails, set up defaults
        const defaultNotes = {
          id: shot.id,
          rating: 0,
          beanType: '',
          doseIn: '',
          doseOut: shot.volume ? shot.volume.toFixed(1) : '',
          ratio: '',
          grindSetting: '',
          balanceTaste: 'balanced',
          notes: '',
        };

        setNotes(defaultNotes);
        setInitialLoaded(true);
        if (onNotesLoaded) {
          onNotesLoaded(defaultNotes);
        }
      }
    };

    loadNotes();
  }, []); // No dependencies - only run once

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
        notes: notes,
      });
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

  const handleInputChange = (field, value) => {
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
  };

  const renderStars = (rating, editable = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type='button'
          disabled={!editable}
          onClick={() => editable && handleInputChange('rating', i)}
          className={`text-lg ${i <= rating ? 'text-[var(--heat)]' : 'text-[var(--line-strong)]'} ${
            editable ? 'cursor-pointer hover:text-[var(--heat)]' : 'cursor-default'
          }`}
        >
          ★
        </button>,
      );
    }
    return stars;
  };

  // Don't render until initial load is complete
  if (!initialLoaded) {
    return (
      <div className='mt-6 border-t pt-6'>
        <div className='flex items-center justify-center py-8'>
          <span className='loading loading-spinner loading-md'></span>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    // Empty fields say nothing, so reading a shot only shows what was written down.
    const written =
      notes.rating > 0 ||
      notes.beanType ||
      notes.doseIn ||
      notes.grindSetting ||
      notes.notes ||
      notes.balanceTaste !== 'balanced';
    const facts = [
      notes.rating > 0 && ['Rating', `${notes.rating}/5`],
      notes.beanType && ['Bean', notes.beanType],
      notes.doseIn && ['Dose in', `${notes.doseIn} g`],
      notes.doseOut && ['Dose out', `${notes.doseOut} g`],
      notes.ratio && ['Ratio', `1:${notes.ratio}`],
      notes.grindSetting && ['Grind', notes.grindSetting],
      written && [
        'Taste',
        notes.balanceTaste.charAt(0).toUpperCase() + notes.balanceTaste.slice(1),
      ],
    ].filter(Boolean);

    return (
      <div className='border-base-content/20 mt-3 flex flex-col gap-3 border-t pt-3'>
        <div className='bm-group__head'>
          <h3 className='bm-group__title'>Shot notes</h3>
          <button
            type='button'
            onClick={() => setIsEditing(true)}
            className='bm-link cursor-pointer'
          >
            {written ? 'Edit' : 'Add notes'}
          </button>
        </div>
        {facts.length > 0 && (
          <dl className='grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4'>
            {facts.map(([label, value]) => (
              <div key={label} className='min-w-0'>
                <dt className='text-xs leading-4 text-[var(--ink-muted)]'>{label}</dt>
                <dd className='truncate'>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {notes.notes && <p className='text-sm whitespace-pre-wrap'>{notes.notes}</p>}
      </div>
    );
  }

  return (
    <div className='border-base-content/20 mt-3 border-t pt-3'>
      <div className='mb-4 flex items-center justify-between gap-3'>
        <h3 className='bm-group__title'>Shot notes</h3>
        <div className='flex gap-2'>
          <button
            onClick={() => setIsEditing(false)}
            className='btn btn-sm btn-ghost'
            disabled={loading}
          >
            Cancel
          </button>
          <button onClick={saveNotes} className='btn btn-sm btn-primary' disabled={loading}>
            {loading ? (
              <Spinner size={4} />
            ) : (
              <>
                <Icon name={'save'} />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Rating</label>
          <div className='flex gap-1'>{renderStars(notes.rating, true)}</div>
        </div>

        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Bean Type</label>
          <input
            type='text'
            className='input input-bordered w-full'
            value={notes.beanType}
            onChange={e => handleInputChange('beanType', e.target.value)}
            placeholder='e.g., Single Origin, Blend'
          />
        </div>

        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Dose In (g)</label>
          <input
            type='number'
            step='0.1'
            className='input input-bordered w-full'
            value={notes.doseIn}
            onChange={e => handleInputChange('doseIn', e.target.value)}
            placeholder='18.0'
          />
        </div>

        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Dose Out (g)</label>
          <input
            type='number'
            step='0.1'
            className='input input-bordered w-full'
            value={notes.doseOut}
            onChange={e => handleInputChange('doseOut', e.target.value)}
            placeholder='36.0'
          />
        </div>

        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Ratio</label>
          <div className='input input-bordered w-full cursor-default bg-[var(--surface-2)]'>
            {notes.ratio ? `1:${notes.ratio}` : '—'}
          </div>
        </div>

        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Grind Setting</label>
          <input
            type='text'
            className='input input-bordered w-full'
            value={notes.grindSetting}
            onChange={e => handleInputChange('grindSetting', e.target.value)}
            placeholder='e.g., 2.5, Medium-Fine'
          />
        </div>

        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Balance/Taste</label>
          <select
            className='select select-bordered w-full'
            value={notes.balanceTaste}
            onChange={e => handleInputChange('balanceTaste', e.target.value)}
          >
            <option value='bitter'>Bitter</option>
            <option value='balanced'>Balanced</option>
            <option value='sour'>Sour</option>
          </select>
        </div>
      </div>

      <div className='form-control mt-6'>
        <label className='mb-2 block text-sm font-medium'>
          Notes <span className='text-xs text-[var(--ink-muted)]'>({notes.notes.length}/200)</span>
        </label>
        <textarea
          className='textarea textarea-bordered w-full'
          rows='4'
          value={notes.notes}
          maxLength={200}
          onChange={e => handleInputChange('notes', e.target.value)}
          placeholder='Tasting notes, brewing observations, etc...'
        />
      </div>
    </div>
  );
}
