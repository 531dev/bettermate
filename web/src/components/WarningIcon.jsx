import PropTypes from 'prop-types';
import { Icon } from './Icon.jsx';

// Warning keys resolve to the same pixel glyphs as the round display.
export function WarningIcon({ icon, title, className = '' }) {
  return <Icon name={icon} title={title} className={className} />;
}

WarningIcon.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
};
