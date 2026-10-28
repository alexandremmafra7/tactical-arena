import type { PostMatchInsights } from '@tactical-arena/shared';
import {
  BrainIcon,
  TacticsIcon,
  TargetIcon,
  ActivityIcon,
  RedCardIcon,
  BarChartIcon,
  ShieldIcon,
  RefreshIcon,
} from './icons/AppIcons.js';

interface PostMatchInsightsCardProps {
  insights: PostMatchInsights;
  homeClubName: string;
  awayClubName: string;
}

function renderInsightIcon(icon: string) {
  if (icon === '📈') return <BarChartIcon size={16} color="#38bdf8" />;
  if (icon === '🎯') return <TargetIcon size={16} color="#fbbf24" />;
  if (icon === '🧤') return <ShieldIcon size={16} color="#38bdf8" />;
  if (icon === '🏃') return <ActivityIcon size={16} color="#34d399" />;
  if (icon === '🟥') return <RedCardIcon size={16} />;
  if (icon === '🔄') return <RefreshIcon size={16} color="#a855f7" />;
  return <TacticsIcon size={16} color="#a855f7" />;
}

export function PostMatchInsightsCard({
  insights,
  homeClubName,
  awayClubName,
}: PostMatchInsightsCardProps) {
  const { headline, verdict, insights: items, homeXgDominancePct } = insights;
  const awayXgDominancePct = 100 - homeXgDominancePct;

  return (
    <div className="card post-match-insights-card">
      <div className="insights-header">
        <span className="insights-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <BrainIcon size={14} color="#38bdf8" />
          ANÁLISE TÁTICA E INSIGHTS DA PARTIDA
        </span>
        <h2 className="insights-headline">{headline}</h2>
        <p className="insights-verdict">{verdict}</p>
      </div>

      {/* Dominance Bar */}
      <div className="insights-dominance-section">
        <div className="dominance-labels">
          <span className="dom-home">
            {homeClubName} ({homeXgDominancePct}%)
          </span>
          <span className="dom-title">Controle do xG e Oportunidades</span>
          <span className="dom-away">
            {awayClubName} ({awayXgDominancePct}%)
          </span>
        </div>
        <div className="dominance-bar-container">
          <div className="dom-bar-home" style={{ width: `${homeXgDominancePct}%` }} />
          <div className="dom-bar-away" style={{ width: `${awayXgDominancePct}%` }} />
        </div>
      </div>

      {/* Tactical Points List */}
      <div className="insights-points-grid">
        {items.map((item, index) => (
          <div key={index} className={`insight-item-box impact-${item.impact.toLowerCase()}`}>
            <div className="insight-item-top">
              <span className="insight-icon">{renderInsightIcon(item.icon)}</span>
              <span className="insight-item-title">{item.title}</span>
            </div>
            <p className="insight-item-narrative">{item.narrative}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
