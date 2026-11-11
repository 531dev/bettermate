// Joins class names, skipping anything falsy: cx('bm-btn', primary && 'bm-btn--primary', className).
export const cx = (...names) => names.filter(Boolean).join(' ');
