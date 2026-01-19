const BackgroundOverlay = ({ 
  opacity = 0.3, 
  gradient = true,
  className = '' 
}) => {
  // For dynamic opacity, we need to use CSS variables or inline style for the gradient
  // Since Tailwind doesn't support dynamic gradient opacity easily, we'll use a style for the gradient
  // but we can use Tailwind for the base classes
  const gradientStyle = gradient
    ? {
        background: `linear-gradient(135deg, rgba(0, 0, 0, ${opacity}) 0%, rgba(20, 20, 40, ${opacity * 0.8}) 50%, rgba(0, 0, 0, ${opacity}) 100%)`
      }
    : {
        backgroundColor: `rgba(0, 0, 0, ${opacity})`
      };

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={gradientStyle}
    />
  );
};

export default BackgroundOverlay;
