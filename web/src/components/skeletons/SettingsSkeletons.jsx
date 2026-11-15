import { SkeletonBlock } from '../SkeletonBlock.jsx';
import { Tile } from '../Tile.jsx';

// Still outlines of the Settings tabs while their code and values load: a title, then fields.

function FieldSkeleton() {
  return (
    <div className='flex flex-col gap-2'>
      <SkeletonBlock className='h-4 w-28' />
      <SkeletonBlock className='h-11 w-full' />
    </div>
  );
}

function SwitchSkeleton() {
  return (
    <div className='flex min-h-11 items-center justify-between'>
      <SkeletonBlock className='h-4 w-32' />
      <SkeletonBlock className='h-7 w-12' />
    </div>
  );
}

function TileSkeleton({ fields = 0, switches = 0, children }) {
  return (
    <Tile aria-hidden='true'>
      <SkeletonBlock className='h-5 w-36' />
      {fields > 0 && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {Array.from({ length: fields }, (_, i) => (
            <FieldSkeleton key={i} />
          ))}
        </div>
      )}
      {Array.from({ length: switches }, (_, i) => (
        <SwitchSkeleton key={i} />
      ))}
      {children}
    </Tile>
  );
}

export function GeneralTabSkeleton() {
  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      <TileSkeleton fields={3} switches={1} />
      <TileSkeleton fields={2} />
    </div>
  );
}

export function MachineTabSkeleton() {
  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      <TileSkeleton fields={2} />
      <TileSkeleton fields={4} />
    </div>
  );
}

export function PluginsTabSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3'>
      {Array.from({ length: 4 }, (_, i) => (
        <TileSkeleton key={i} switches={1}>
          <SkeletonBlock className='h-4 w-5/6' />
        </TileSkeleton>
      ))}
    </div>
  );
}

export function BluetoothTabSkeleton() {
  return (
    <TileSkeleton>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className='flex min-h-15 items-center gap-3'>
          <SkeletonBlock className='h-10 w-10 shrink-0 rounded-pill' />
          <div className='flex flex-1 flex-col gap-2'>
            <SkeletonBlock className='h-4 w-28' />
            <SkeletonBlock className='h-3 w-40' />
          </div>
        </div>
      ))}
    </TileSkeleton>
  );
}

export function SystemTabSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 lg:gap-3'>
      <TileSkeleton>
        <SkeletonBlock className='h-4 w-5/6' />
        <SkeletonBlock className='h-24 w-full' />
      </TileSkeleton>
      <TileSkeleton>
        <SkeletonBlock className='h-4 w-5/6' />
        <SkeletonBlock className='h-11 w-full' />
        <SkeletonBlock className='h-11 w-full' />
      </TileSkeleton>
    </div>
  );
}
