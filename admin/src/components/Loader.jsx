/**
 * Custom animated loading spinner
 * @param {number} size - Size of the loader in pixels (default: 48)
 * @param {string} className - Additional CSS classes
 * @param {string} color - Color of the loader (default: #fff)
 */
const Loader = ({ size = 48, className = '', color = '#fff' }) => {
  return (
    <div 
      className={`loader ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        color: color
      }}
    />
  );
};

export default Loader;
