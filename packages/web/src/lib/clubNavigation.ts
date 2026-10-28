export type ClubDestination =
  | 'home'
  | 'squad'
  | 'tactics'
  | 'training'
  | 'academy'
  | 'staff'
  | 'contracts'
  | 'finance'
  | 'sponsors'
  | 'stadium'
  | 'competitions'
  | 'agenda'
  | 'transfers'
  | 'history'
  | 'career'
  | 'briefing'
  | 'league'
  | 'cup'
  | 'lockerRoom'
  | 'hallOfFame';

export type ClubTab =
  | 'home'
  | 'team'
  | 'squad'
  | 'training'
  | 'tactics'
  | 'academy'
  | 'staff'
  | 'contracts'
  | 'financial'
  | 'stadium'
  | 'finance'
  | 'sponsors'
  | 'competitions'
  | 'agenda'
  | 'transfers'
  | 'history'
  | 'career'
  | 'lockerRoom';

export interface ClubNavigationItem {
  key: string;
  label: string;
  destination: ClubDestination;
  icon?: string;
  matches: readonly ClubTab[];
}

export function clubPath(clubId: string, destination: Exclude<ClubDestination, 'league' | 'cup'>): string {
  if (destination === 'home') return `/clubs/${clubId}`;
  if (destination === 'career') return '/career';
  if (destination === 'lockerRoom') return `/clubs/${clubId}/locker-room`;
  if (destination === 'hallOfFame') return `/clubs/${clubId}/history/hall-of-fame`;
  return `/clubs/${clubId}/${destination}`;
}

export const DESKTOP_CLUB_NAV: readonly ClubNavigationItem[] = [
  { key: 'squad', label: 'Elenco', destination: 'squad', icon: '/icons/squad.png', matches: ['team', 'squad', 'training', 'academy', 'staff', 'contracts', 'lockerRoom'] },
  { key: 'tactics', label: 'Tática', destination: 'tactics', icon: '/icons/tactics.png', matches: ['tactics'] },
  { key: 'competitions', label: 'Competições', destination: 'competitions', icon: '/icons/agenda.png', matches: ['competitions', 'agenda'] },
  { key: 'transfers', label: 'Mercado', destination: 'transfers', icon: '/icons/transfers.png', matches: ['transfers'] },
  { key: 'finance', label: 'Finanças', destination: 'finance', icon: '/icons/finance.png', matches: ['financial', 'finance', 'sponsors', 'stadium'] },
  { key: 'club', label: 'Clube', destination: 'history', icon: '/icons/history.png', matches: ['history', 'career'] },
  { key: 'home', label: 'Home', destination: 'home', icon: '/icons/home-card.png', matches: ['home'] },
];

export const MOBILE_PRIMARY_NAV: readonly ClubNavigationItem[] = [
  { key: 'home', label: 'Início', destination: 'home', icon: '/icons/home-card.png', matches: ['home'] },
  { key: 'squad', label: 'Elenco', destination: 'squad', icon: '/icons/squad.png', matches: ['team', 'squad'] },
  { key: 'tactics', label: 'Tática', destination: 'tactics', icon: '/icons/tactics.png', matches: ['tactics'] },
  { key: 'competitions', label: 'Competições', destination: 'competitions', icon: '/icons/agenda.png', matches: ['competitions', 'agenda'] },
];

export const MOBILE_DRAWER_NAV: readonly ClubNavigationItem[] = [
  { key: 'finance', label: 'Finanças', destination: 'finance', icon: 'finance', matches: ['financial', 'finance'] },
  { key: 'transfers', label: 'Mercado', destination: 'transfers', icon: 'transfers', matches: ['transfers'] },
  { key: 'training', label: 'Treino', destination: 'training', icon: 'training', matches: ['training'] },
  { key: 'academy', label: 'Base', destination: 'academy', icon: 'academy', matches: ['academy'] },
  { key: 'staff', label: 'Comissão', destination: 'staff', icon: 'staff', matches: ['staff'] },
  { key: 'contracts', label: 'Contratos', destination: 'contracts', icon: 'contracts', matches: ['contracts'] },
  { key: 'career', label: 'Clube e Carreira', destination: 'career', icon: 'career', matches: ['career', 'history'] },
];

export interface HubSubnavItem {
  key: string;
  label: string;
  destination: ClubDestination;
  matches: readonly ClubTab[];
}

export const HUB_SUBNAV_ITEMS: Record<'team' | 'financial' | 'competitions' | 'club', readonly HubSubnavItem[]> = {
  team: [
    { key: 'squad', label: 'Elenco', destination: 'squad', matches: ['squad', 'team'] },
    { key: 'lockerRoom', label: 'Vestiário', destination: 'lockerRoom', matches: ['squad'] },
    { key: 'tactics', label: 'Tática', destination: 'tactics', matches: ['tactics'] },
    { key: 'training', label: 'Treino', destination: 'training', matches: ['training'] },
    { key: 'academy', label: 'Base', destination: 'academy', matches: ['academy'] },
    { key: 'contracts', label: 'Contratos', destination: 'contracts', matches: ['contracts'] },
    { key: 'staff', label: 'Comissão', destination: 'staff', matches: ['staff'] },
  ],
  financial: [
    { key: 'finance', label: 'Conta Corrente', destination: 'finance', matches: ['finance', 'financial'] },
    { key: 'sponsors', label: 'Patrocínios', destination: 'sponsors', matches: ['sponsors'] },
    { key: 'stadium', label: 'Estádio', destination: 'stadium', matches: ['stadium'] },
  ],
  competitions: [
    { key: 'competitions', label: 'Visão Geral', destination: 'competitions', matches: ['competitions'] },
    { key: 'agenda', label: 'Calendário', destination: 'agenda', matches: ['agenda'] },
  ],
  club: [
    { key: 'history', label: 'Galeria', destination: 'history', matches: ['history'] },
    { key: 'hallOfFame', label: 'Hall da Fama', destination: 'hallOfFame', matches: ['history'] },
    { key: 'career', label: 'Carreira', destination: 'career', matches: ['career'] },
    { key: 'staff', label: 'Comissão e Diretoria', destination: 'staff', matches: ['staff'] },
  ],
};
