export default function Card({
  xs,
  sm,
  md,
  lg,
  xl,
  title,
  children,
  className = '',
  role,
  fullHeight = false,
}) {
  const getGridClasses = () => {
    const breakpoints = [
      { value: xs, prefix: '' },
      { value: sm, prefix: 'sm:' },
      { value: md, prefix: 'md:' },
      { value: lg, prefix: 'lg:' },
      { value: xl, prefix: 'xl:' },
    ];

    return breakpoints
      .filter(bp => bp.value && bp.value >= 1 && bp.value <= 12)
      .map(bp => `${bp.prefix}col-span-${bp.value}`)
      .join(' ');
  };

  const gridClasses = getGridClasses();

  return (
    <div
      className={`card bg-base-100 min-h-0 min-w-0 rounded-2xl ${gridClasses} ${fullHeight ? 'h-full' : ''} ${className}`}
      role={role}
    >
      {title && (
        <div className='card-header flex shrink-0 px-5 pt-4 max-sm:px-4'>
          <h2 className='bm-group__title'>{title}</h2>
        </div>
      )}
      <div
        className={`card-body flex min-h-0 flex-col gap-3 p-5 max-sm:p-4 ${title ? 'pt-3 max-sm:pt-3' : ''} ${fullHeight ? 'flex-1' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
