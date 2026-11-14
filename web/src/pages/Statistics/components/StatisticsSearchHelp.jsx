import { Sheet } from '../../../components/Sheet.jsx';
import { Cell } from '../../../components/Tile.jsx';
import { IconButton } from '../../ShotAnalyzer/ui/IconButton.jsx';
import { Popover } from '../../ShotAnalyzer/ui/Popover.jsx';
import '../statistics.css';
import { TOOLBAR_FLOATING_PANEL_ATTR } from './toolbar/constants';
import { useMediaQuery, usePopoverState } from './toolbar/hooks';

const FLOATING_PANEL_PROPS = { [TOOLBAR_FLOATING_PANEL_ATTR]: '' };

function Code({ children }) {
  return <code className='st-code'>{children}</code>;
}

function HelpGroup({ title, onSheet, children }) {
  // A cell is surface-2: on the popover's own surface-2 the group needs no ground of its own.
  const Group = onSheet ? Cell : 'div';
  return (
    <Group className='flex flex-col gap-1'>
      <span className='bm-eyebrow'>{title}</span>
      {children}
    </Group>
  );
}

function StatisticsSearchHelpContent({ onSheet = false }) {
  return (
    <div className='bm-help flex flex-col gap-3 text-(--ink)'>
      <p>
        Rules are separated with <Code>;</Code>. The filters above and the query are combined with
        AND.
      </p>
      <HelpGroup title='Fields' onSheet={onSheet}>
        <p>
          <Code>name</Code>, <Code>profile</Code>, <Code>id</Code>, <Code>source</Code>,{' '}
          <Code>date</Code>, <Code>pinned</Code>
        </p>
      </HelpGroup>
      <HelpGroup title='Examples' onSheet={onSheet}>
        <p>
          <Code>name:325; name:326;</Code> the same field twice is OR
        </p>
        <p>
          <Code>name:&quot;325&quot;;</Code> exact
        </p>
        <p>
          <Code>profile:3_0_25; date:&gt;h-7d;</Code>
        </p>
        <p>
          <Code>pinned:true; source:gm;</Code>
        </p>
        <p>
          <Code>date:&gt;=01.02.2026; date:&lt;=07.02.2026 23:59;</Code>
        </p>
      </HelpGroup>
      <HelpGroup title='Date' onSheet={onSheet}>
        <p>
          Use <Code>&gt;</Code>, <Code>&gt;=</Code>, <Code>&lt;</Code>, <Code>&lt;=</Code>,{' '}
          <Code>=</Code>
        </p>
        <p>
          Relative time: <Code>h</Code> is now, <Code>h-7d</Code> is 7 days ago. Local browser time
          is used.
        </p>
        <p>
          The date basis (shot, auto or upload) appears only when shots without a timestamp are
          found.
        </p>
      </HelpGroup>
    </div>
  );
}

// The search syntax: a popover beside its button, a sheet on a phone.
export function StatisticsSearchHelp() {
  const popover = usePopoverState();
  const isPhone = useMediaQuery('(max-width: 599.98px)');

  return (
    <>
      <IconButton
        ref={popover.anchor}
        icon='info'
        label='Search help'
        aria-haspopup='dialog'
        aria-expanded={popover.open}
        onClick={popover.toggle}
      />
      {isPhone ? (
        <Sheet open={popover.open} onClose={popover.close} title='Search syntax'>
          <StatisticsSearchHelpContent onSheet />
        </Sheet>
      ) : (
        <Popover
          {...FLOATING_PANEL_PROPS}
          open={popover.open}
          onClose={popover.close}
          anchor={popover.anchor}
          placement='bottom-end'
          label='Search syntax'
          width='min(calc(100vw - 24px), 30rem)'
        >
          <span className='bm-sub'>Search syntax</span>
          <StatisticsSearchHelpContent />
        </Popover>
      )}
    </>
  );
}
