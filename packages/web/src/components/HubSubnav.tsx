import { Link } from 'react-router-dom';
import { HUB_SUBNAV_ITEMS, clubPath } from '../lib/clubNavigation.js';
import { NavIcon } from './icons/AppIcons.js';

export type HubKey = 'team' | 'financial' | 'competitions' | 'club';

interface HubSubnavProps {
  hub: HubKey;
  clubId: string;
  /** Chave do item que representa a tela atual. */
  active: string;
  /**
   * Itens que só existem quando há dado para eles — a Tabela precisa do id da liga e a Copa do id da
   * copa, e nenhum dos dois é derivável do clube sozinho. Entram na frente dos itens fixos do hub.
   */
  extraItems?: { key: string; label: string; to: string }[];
}

function cleanLabel(label: string): string {
  return label.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/u, '').trim() || label;
}

export function HubSubnav({ hub, clubId, active, extraItems = [] }: HubSubnavProps) {
  const items = [
    ...extraItems.map((item) => ({ key: item.key, label: cleanLabel(item.label), to: item.to })),
    ...HUB_SUBNAV_ITEMS[hub].map((item) => ({
      key: item.key,
      label: cleanLabel(item.label),
      to: clubPath(clubId, item.destination as any),
    })),
  ];

  return (
    <div className="hub-subnav-switch">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            to={item.to}
            className={`hub-subnav-btn${isActive ? ' active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <NavIcon name={item.key} size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
