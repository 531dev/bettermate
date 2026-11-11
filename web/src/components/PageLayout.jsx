export default function PageLayout({ variant = 'wide', children, className = '' }) {
  const widthClass = variant === 'narrow' ? 'mx-auto max-w-4xl w-full' : 'w-full';

  return (
    <div className={`${widthClass} flex flex-col gap-3 pb-2 ${className}`}>
      {children}
    </div>
  );
}
