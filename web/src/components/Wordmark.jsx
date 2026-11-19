// The wordmark is the Gaggia Milano mark, two files, one per ground, and never live text. Lazy
// loading keeps the browser from fetching the one the theme hides.
export function Wordmark() {
  return (
    <>
      <img
        className='bm-wm bm-wm--light bm-wm--gaggia'
        src='/gaggia-milano.svg'
        alt='Gaggia Milano'
        width='88'
        height='40'
        loading='lazy'
      />
      <img
        className='bm-wm bm-wm--dark bm-wm--gaggia'
        src='/gaggia-milano-inverse.svg'
        alt='Gaggia Milano'
        width='88'
        height='40'
        loading='lazy'
      />
    </>
  );
}
