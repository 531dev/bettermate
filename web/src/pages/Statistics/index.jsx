import { useMemo, useState } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import PageHeader from '../../components/PageHeader.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import { StatisticsView } from './components/StatisticsView';
// Statistics is built from the Analyzer's parts and wears its `an-*` recipes.
import '../ShotAnalyzer/ui/tool.css';
import {
  normalizeStatisticsSourceSelection,
  parseStatisticsProfileRouteParams,
} from './utils/statisticsRoute';

// Statistics entry page: merges deep-link context with transient session hints.
// Route params stay canonical for profile source/name, while session state can
// carry extra one-off UI context like the current shot source and detail tab.
export function StatisticsPage() {
  const { params } = useRoute();
  const [sessionInitialContext] = useState(() => {
    try {
      const raw = sessionStorage.getItem('statsInitialContext');
      if (raw) {
        sessionStorage.removeItem('statsInitialContext');
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  });
  const routeInitialContext = useMemo(() => parseStatisticsProfileRouteParams(params), [params]);
  const initialContext = useMemo(() => {
    const sessionContext = sessionInitialContext || {};
    const legacySource = normalizeStatisticsSourceSelection(sessionContext.source, '');
    const baseContext = {
      ...sessionContext,
      shotSource: normalizeStatisticsSourceSelection(
        sessionContext.shotSource || legacySource,
        'gaggimate',
      ),
      profileSource: normalizeStatisticsSourceSelection(
        sessionContext.profileSource || legacySource,
        'gaggimate',
      ),
    };
    baseContext.source = baseContext.profileSource;

    if (!routeInitialContext) return baseContext;

    return {
      ...baseContext,
      ...routeInitialContext,
      profileSource: routeInitialContext.source,
      source: routeInitialContext.source,
    };
  }, [routeInitialContext, sessionInitialContext]);

  return (
    <PageLayout variant='wide'>
      <PageHeader title='Statistics' />
      <StatisticsView initialContext={initialContext} />
    </PageLayout>
  );
}
