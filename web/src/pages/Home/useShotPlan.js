import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { share } from '../../utils/metricDefinitions.js';

// The least a phase's bar gets, as a share of the planned shot.
const SHORTEST_STAGE = 0.2;

const NO_PLAN = {
  profile: null,
  line: '',
  dose: null,
  weightOut: null,
  seconds: 0,
  phases: [],
  hasCurve: false,
};

// A profile draws a curve when some phase asks for a pressure or a flow. A standard profile runs
// its pump at a share of full power, so it has none.
const asksForCurve = phase =>
  typeof phase?.pump === 'object' && (phase.pump?.pressure > 0 || phase.pump?.flow > 0);

/**
 * What the selected profile will do: one line for the dial, the dose for working out a ratio,
 * where the shot stops, its phases, and whether they draw a pressure or flow curve.
 */
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

  if (!profile) return NO_PLAN;

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
  const line = [
    profile.dose && `${profile.dose} g in`,
    weightOut && `${weightOut} g out`,
    seconds > 0 && `${seconds} s`,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    profile,
    line,
    dose: profile.dose || null,
    weightOut,
    seconds,
    phases,
    hasCurve: phases.some(asksForCurve),
  };
}

/**
 * The phases of the running shot for a StageTrack: done, running, to come. The firmware names the
 * running phase and not its number, so the name is looked for from the last phase seen onwards,
 * which keeps two phases of one name apart. Null unless a shot of two or more phases is running:
 * a single phase is already the progress in the banner.
 */
export function useShotStages(phases, ds) {
  const seen = useRef(0);
  const { processInfo: p, isActive, isBrewing } = ds;
  const brewing = isBrewing && isActive && !p?.u;
  if (!brewing) seen.current = 0;
  if (!brewing || phases.length < 2) return null;

  let at = phases.findIndex((phase, i) => i >= seen.current && phase.name === p.l);
  if (at < 0) at = phases.findIndex(phase => phase.name === p.l);
  if (at < 0) return null;
  seen.current = at;

  // A bar is as wide as its phase is long, but never too short to hold a one-word name.
  const length = phase => (phase.duration > 0 ? phase.duration : 1);
  const shortest = phases.reduce((sum, phase) => sum + length(phase), 0) * SHORTEST_STAGE;
  return phases.map((phase, i) => ({
    name: phase.name || `Phase ${i + 1}`,
    weight: Math.max(length(phase), shortest),
    state: i < at ? 'done' : i === at ? 'now' : undefined,
    progress: i === at && p.pt > 0 ? share(p.pp, p.pt) : 0,
  }));
}
