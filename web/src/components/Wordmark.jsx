// The wordmark is two files, one per ground, and never live text. Lazy loading keeps the browser
// from fetching the one the theme hides.
export function Wordmark() {
  return (
    <>
      <img
        className='bm-wm bm-wm--light'
        src='/bettermate-wordmark.svg'
        alt='BetterMate'
        width='148'
        height='20'
        loading='lazy'
      />
      <img
        className='bm-wm bm-wm--dark'
        src='/bettermate-wordmark-inverse.svg'
        alt='BetterMate'
        width='148'
        height='20'
        loading='lazy'
      />
    </>
  );
}
