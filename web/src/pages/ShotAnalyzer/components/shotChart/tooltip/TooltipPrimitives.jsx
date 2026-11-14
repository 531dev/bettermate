import { ShotBadge } from '../../../ui/ShotBadge.jsx';

/** The badge of the shot a tooltip line belongs to, in a comparison. */
export function TooltipShotBadge({ shotNumber, className }) {
  if (shotNumber === null || shotNumber === undefined) return null;
  return <ShotBadge number={shotNumber} className={className} />;
}
