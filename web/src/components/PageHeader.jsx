export default function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
  className = '',
  noStack = false,
}) {
  const flexClasses = noStack
    ? 'flex flex-row items-center justify-between gap-4'
    : 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between';

  return (
    <div className={`flex flex-col ${className}`}>
      <div className={flexClasses}>
        <div className='min-w-0'>
          <h1 className='bm-page-title'>{title}</h1>
          {subtitle && <p className='bm-page-sub'>{subtitle}</p>}
        </div>
        {actions && <div className='flex flex-wrap items-center gap-2 sm:shrink-0'>{actions}</div>}
      </div>
      {tabs && <div className='mt-3'>{tabs}</div>}
    </div>
  );
}
