import PropTypes from 'prop-types';
import { outlinePaths } from '../design/outlinePaths.js';

// Stroke glyphs stay legible at a consistent size in controls and chart toolbars.
export function Icon({ name, className = '', rotation = 0, spin = false, title, style, ...props }) {
  return (
    <svg
      {...props}
      viewBox='0 0 24 24'
      width='24'
      height='24'
      fill='none'
      stroke='currentColor'
      stroke-width='1.6'
      stroke-linecap='round'
      stroke-linejoin='round'
      data-icon={name}
      className={`bm-icon ${spin ? 'animate-spin' : ''} ${className}`}
      style={{
        ...style,
        width: 24,
        height: 24,
        minWidth: 24,
        flexShrink: 0,
        transform: rotation ? `rotate(${rotation}deg)` : style?.transform,
      }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d={outlinePaths[name] || outlinePaths.info} />
    </svg>
  );
}

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  className: PropTypes.string,
  rotation: PropTypes.number,
  spin: PropTypes.bool,
  title: PropTypes.string,
  style: PropTypes.object,
};
