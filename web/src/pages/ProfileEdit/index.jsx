import { useLocation, useRoute } from 'preact-iso';
import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'preact/hooks';
import { ProfileTypeSelection } from './ProfileTypeSelection.jsx';
import { StandardProfileForm } from './StandardProfileForm.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { computed } from '@preact/signals';
import { Button } from '../../components/Button.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { Tile } from '../../components/Tile.jsx';
import { ExtendedProfileForm } from './ExtendedProfileForm.jsx';
import { useUnsavedGuard } from './useUnsavedGuard.js';

const connected = computed(() => machine.value.connected);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);

export function ProfileEdit() {
  const apiService = useContext(ApiServiceContext);
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { params } = useRoute();
  const [data, setData] = useState(null);
  // The profile as it was loaded or last saved: anything else on the page is an unsaved edit.
  const [saved, setSaved] = useState(null);
  const open = useCallback(profile => {
    setData(profile);
    setSaved(profile);
  }, []);
  // The machine no longer has the profile this address names.
  const [missing, setMissing] = useState(false);
  // A profile is fetched once. The connection drops and returns whenever a phone sleeps, and a
  // second fetch would replace what is being edited.
  const fetchedId = useRef(null);
  const isConnected = connected.value;
  useEffect(() => {
    if (fetchedId.current === params.id) return;
    async function fetchData() {
      if (params.id === 'new') {
        fetchedId.current = params.id;
        setMissing(false);
        open({
          label: 'New Profile',
          description: '',
          temperature: 93,
          phases: [
            {
              name: 'Pump',
              phase: 'preinfusion',
              valve: 1,
              pump: 100,
              duration: 3,
              transition: {
                type: 'instant',
                duration: 0,
                adaptive: true,
              },
              targets: [],
            },
            {
              name: 'Bloom',
              phase: 'preinfusion',
              valve: 1,
              pump: 0,
              duration: 5,
              transition: {
                type: 'instant',
                duration: 0,
                adaptive: true,
              },
              targets: [],
            },
            {
              name: 'Pump',
              phase: 'brew',
              valve: 1,
              pump: 100,
              duration: 20,
              targets: [
                {
                  type: 'volumetric',
                  value: 36,
                },
              ],
              transition: {
                type: 'instant',
                duration: 0,
                adaptive: true,
              },
            },
          ],
        });
        setLoading(false);
      } else if (isConnected) {
        const id = params.id;
        const response = await apiService.request({ tp: 'req:profiles:load', id });
        fetchedId.current = id;
        setMissing(!response.profile);
        open({
          ...response.profile,
          phases: Array.isArray(response.profile?.phases) ? response.profile.phases : [],
        });
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id, open, isConnected, apiService]);
  const onSave = useCallback(
    async data => {
      setSaving(true);
      const response = await apiService.request({ tp: 'req:profiles:save', profile: data });
      open(response.profile);
      setSaving(false);
      location.route('/profiles');
    },
    [apiService, open, location],
  );
  const onConvert = useCallback(() => {
    setData({
      ...data,
      type: 'pro',
    });
  }, [data, setData]);

  const dirty = useMemo(
    () => saved !== null && JSON.stringify(data) !== JSON.stringify(saved),
    [data, saved],
  );
  const guard = useUnsavedGuard(dirty);

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  if (missing) {
    return (
      <PageLayout variant='narrow'>
        <PageHeader title='Profile not found' />
        <Tile>
          <p className='bm-help'>This profile is not on the machine. It may have been deleted.</p>
          <Button className='self-start' href='/profiles'>
            All profiles
          </Button>
        </Tile>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant='narrow'>
      <PageHeader
        title={params.id === 'new' ? 'New profile' : `Edit ${saved?.label ?? ''}`}
        actions={
          data?.type === 'standard' &&
          pressureAvailable.value && (
            <Button size='sm' onClick={() => onConvert()}>
              Convert to Pro
            </Button>
          )
        }
      />

      {/* Choosing the type of a new profile starts it; it is not an edit yet. */}
      {!data?.type && <ProfileTypeSelection onSelect={type => open({ ...data, type })} />}
      {data?.type === 'standard' && (
        <StandardProfileForm
          data={data}
          onChange={data => setData(data)}
          onSave={onSave}
          saving={saving}
          pressureAvailable={pressureAvailable.value}
        />
      )}
      {data?.type === 'pro' && (
        <ExtendedProfileForm
          data={data}
          onChange={data => setData(data)}
          onSave={onSave}
          saving={saving}
          pressureAvailable={pressureAvailable.value}
        />
      )}

      <Sheet open={guard.pending !== null} onClose={guard.stay} title='Discard changes?'>
        <p className='bm-help'>This profile has edits that are not saved.</p>
        <div className='flex justify-end gap-2 pt-2'>
          <Button onClick={guard.stay} data-autofocus>
            Keep editing
          </Button>
          <Button variant='danger' onClick={guard.leave}>
            Discard
          </Button>
        </div>
      </Sheet>
    </PageLayout>
  );
}
