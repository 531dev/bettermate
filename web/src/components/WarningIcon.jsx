import { Icon } from './Icon.jsx';

// A warning's glyph by its key in utils/warnings.js: the same glyphs the round display uses.
export function WarningIcon({ icon, title, className, size }) {
  return <Icon name={icon} title={title} className={className} size={size} />;
}
