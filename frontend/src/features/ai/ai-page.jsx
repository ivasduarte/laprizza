import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ForecastsPanel from './forecasts/forecasts-panel.jsx';
import SuppliersPanel from './suppliers/suppliers-panel.jsx';
import PlanningPanel from './planning/planning-panel.jsx';
import RunsPanel from './runs/runs-panel.jsx';
import './ai-page.css';

const TABS = ['forecasts', 'suppliers', 'execution', 'results'];

/**
 * WEB07 "AI configuration and execution" (MANAGER only: the route requires forecasts:read and
 * the back end authorizes every request). Every calculation is a simulation: stock is never
 * changed and no purchase order is created.
 */
export default function AiPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('forecasts');
  const [preset, setPreset] = useState(null); // { forecastId, key }
  const [openRunId, setOpenRunId] = useState(null);
  const tabRefs = useRef({});

  const select = (id) => {
    setTab(id);
    tabRefs.current[id]?.focus();
  };

  // Roving focus of the WAI-ARIA tabs pattern (arrows, Home, End).
  function onKeyDown(event) {
    const index = TABS.indexOf(tab);
    const moves = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(TABS[moves[event.key]]);
    }
  }

  const runWith = (forecast) => {
    setPreset({ forecastId: forecast.id, key: `${forecast.id}-${Date.now()}` });
    setTab('execution');
  };
  const openRun = (runId) => {
    setOpenRunId(runId);
    setTab('results');
  };

  return (
    <>
      <h1>{t('ai.title')}</h1>
      <p>{t('ai.intro')}</p>
      <p className="message message-warning">{t('ai.ui.simulationBanner')}</p>

      <div
        className="ai-tabs"
        role="tablist"
        aria-label={t('ai.sections')}
        onKeyDown={onKeyDown}
      >
        {TABS.map((id) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            className="ai-tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {t(`ai.tabs.${id}`)}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'forecasts' && <ForecastsPanel onRun={runWith} />}
        {tab === 'suppliers' && <SuppliersPanel />}
        {tab === 'execution' && (
          <PlanningPanel key={preset?.key ?? 'default'} preset={preset} onOpenRun={openRun} />
        )}
        {tab === 'results' && <RunsPanel key={openRunId ?? 'none'} openRunId={openRunId} />}
      </section>
    </>
  );
}
