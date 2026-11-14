import { Icon } from '../../../components/Icon.jsx';

// The glyph's size per variant: beside a line of data, in a list row, in an icon disc.
const SOURCE_MARKER_SIZES = {
  compact: 16,
  library: 18,
  large: 20,
};

// Where a shot or profile lives: the machine, this browser, or nowhere (opened temporarily).
const SOURCES = {
  gaggimate: { icon: 'coffee', word: 'Machine' },
  browser: { icon: 'monitor', word: 'Browser' },
  temp: { icon: 'eye', word: 'Temporary' },
};

export function getSourceWord(source) {
  return (SOURCES[source] || SOURCES.browser).word;
}

/** The machine's glyph. `size` is the Icon size. */
export function GmLogoIcon({ size = SOURCE_MARKER_SIZES.compact }) {
  return <Icon name={SOURCES.gaggimate.icon} size={size} />;
}

/**
 * The source of a shot or profile as a glyph in currentColor, with its word for screen readers.
 *   source   'gaggimate' (the machine), 'browser', or 'temp' for a file opened without saving
 *   variant  'compact' 16px, 'library' 18px, 'large' 20px
 *   size     an Icon size, in place of a variant
 */
export function SourceMarker({ source, variant = 'compact', size }) {
  const { icon, word } = SOURCES[source] || SOURCES.browser;
  const iconSize = size ?? SOURCE_MARKER_SIZES[variant] ?? SOURCE_MARKER_SIZES.compact;

  return (
    <span className='inline-flex items-center justify-center'>
      <span className='sr-only'>{word}</span>
      <Icon name={icon} size={iconSize} />
    </span>
  );
}
