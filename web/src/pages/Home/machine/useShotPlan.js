import { useContext, useEffect, useState } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService.js';

// What the selected profile will do, in one line, plus the dose for working out a ratio.
export function useShotPlan(ds) {
  const apiService = useContext(ApiServiceContext);
  const { selectedProfileId } = ds;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!selectedProfileId || !apiService) {
      setProfile(null);
      return undefined;
    }
    let cancelled = false;
    apiService
      .request({ tp: 'req:profiles:load', id: selectedProfileId })
      .then(res => {
        if (!cancelled) setProfile(res.profile);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, apiService]);

  if (!profile) return { plan: '', dose: null };

  const phases = Array.isArray(profile.phases) ? profile.phases : [];
  const seconds = phases.reduce(
    (sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0),
    0,
  );
  // The live target wins: it is what this shot will actually stop at.
  const weightOut =
    ds.brewTarget && ds.volumetricAvailable && ds.targetWeight
      ? Math.round(ds.targetWeight)
      : phases
          .flatMap(p => p.targets || [])
          .filter(t => t.type === 'volumetric')
          .at(-1)?.value;
  const plan = [
    profile.dose && `${profile.dose} g in`,
    weightOut && `${weightOut} g out`,
    seconds > 0 && `${seconds} s`,
  ]
    .filter(Boolean)
    .join(', ');

  return { plan, dose: profile.dose || null };
}
