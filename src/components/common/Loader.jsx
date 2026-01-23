import PropTypes from 'prop-types';
import './Loader.css';

/**
 * Custom animated loading spinner
 * @param {number} size - Size of the loader in pixels (default: 48)
 * @param {string} className - Additional CSS classes
 * @param {string} color - Color of the loader (default: #fff)
 */
const Loader = ({ size = 48, className = '', color = '#fff' }) => {
  return (
    <div 
      className={`custom-loader ${className}`}
      style={{
        // Drive Loader.css via CSS variables
        '--loader-size': `${size}px`,
        '--loader-color': color,
      }}
    />
  );
};

Loader.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
  color: PropTypes.string
};

export default Loader;
