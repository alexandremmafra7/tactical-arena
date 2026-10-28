import React from 'react';

export interface IconProps {
  size?: number | string;
  color?: string;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** ⬅️ Seta para Voltar */
export function ArrowLeftIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/** 🏠 Página Inicial / Início */
export function HomeIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

/** 👥 Elenco / Jogadores */
export function SquadIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export const UsersIcon = SquadIcon;

/** 👕 Vestiário / Camisa / Manto */
export function LockerRoomIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M6 3l3-1h6l3 1 3 3-2.5 3.5L16 9v12H8V9l-2.5 1.5L3 6l3-3z" />
      <path d="M10 2a2 2 0 0 0 4 0" />
      <path d="M12 9v3" />
    </svg>
  );
}

/** 📋 Tática / Prancheta / Campo Estratégico */
export function TacticsIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="7" cy="7.5" r="1.2" fill={color} />
      <circle cx="17" cy="16.5" r="1.2" fill={color} />
    </svg>
  );
}

/** 📋💧 Prancheta Tática + Hidratação Esportiva (Intervalo de Jogo) */
export function HalftimeTacticsHydrationIcon({ size = 28, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Prancheta Tática de Madeira/Ouro */}
      <rect x="2.5" y="4" width="18" height="25" rx="2.5" stroke="#ffd700" strokeWidth="1.8" fill="rgba(212, 175, 55, 0.14)" />
      {/* Grampo / Clip Superior */}
      <path d="M7.5 4V2.2C7.5 1.5 8.1 1 8.8 1H14.2C14.9 1 15.5 1.5 15.5 2.2V4" stroke="#ffd700" strokeWidth="1.6" strokeLinecap="round" />
      {/* Desenho do Campo / Linhas Táticas na Prancheta */}
      <rect x="5" y="7" width="13" height="19" rx="1.5" stroke="rgba(255, 215, 0, 0.4)" strokeWidth="1" />
      <line x1="5" y1="16.5" x2="18" y2="16.5" stroke="rgba(255, 215, 0, 0.4)" strokeWidth="1" />
      <circle cx="11.5" cy="16.5" r="2.5" stroke="rgba(255, 215, 0, 0.4)" strokeWidth="1" />
      {/* Movimentações táticas: cruz e círculos com seta tracejada */}
      <circle cx="8" cy="11" r="0.9" fill="#ffd700" />
      <circle cx="15" cy="22" r="0.9" fill="#ffd700" />
      <path d="M8 12L11.5 15L15 21" stroke="#ffd700" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5" />

      {/* Squeeze Esportivo de Hidratação (Sobreposto no canto direito com brilho ciano) */}
      {/* Bico dosador */}
      <rect x="23.5" y="8" width="3" height="2" rx="0.6" fill="#38bdf8" />
      {/* Tampa / Gargalo com anel */}
      <rect x="22" y="10" width="6" height="2.5" rx="0.8" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />
      {/* Corpo da Garrafa */}
      <path
        d="M21.5 13C21.5 12.5 22 12.5 22.5 12.5H27.5C28 12.5 28.5 12.5 28.5 13L29 20C29 20.8 28.5 21.2 27.8 21.2L28.2 28.2C28.2 29.2 27.4 30 26.4 30H23.6C22.6 30 21.8 29.2 21.8 28.2L22.2 21.2C21.5 21.2 21 20.8 21 20L21.5 13Z"
        fill="#0b1726"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Ranhura / Grip ergonômico */}
      <line x1="23.2" y1="16" x2="26.8" y2="16" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="1" strokeLinecap="round" />
      {/* Símbolo de Gota de Hidratação iluminada */}
      <path
        d="M25 19.5C25 19.5 23.2 21.8 23.2 23.2C23.2 24.2 24 25 25 25C26 25 26.8 24.2 26.8 23.2C26.8 21.8 25 19.5 25 19.5Z"
        fill="#38bdf8"
      />
    </svg>
  );
}

/** 🟥 Cartão Vermelho */
export function RedCardIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="5.5" y="2" width="13" height="20" rx="2.5" fill="#ef4444" stroke="#dc2626" strokeWidth="1.5" />
    </svg>
  );
}

/** ➕ Cruz de Atendimento Médico */
export function MedicalCrossIcon({ size = 22, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1.5" />
      <path d="M12 7V17M7 12H17" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** 🏃 Treino / Fitness / Preparação Física */
export function TrainingIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="13" cy="4" r="2" />
      <path d="M6 16l3-3 2 1 2-4 3 2 4-2" />
      <path d="M9 13v7" />
      <path d="M13 14l3 7" />
    </svg>
  );
}

/** 🌱 Base / Categorias de Base / Jovens Talentos */
export function AcademyIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M12 22v-9" />
      <path d="M12 13c0-4.5 3.5-7 7-7 0 5-3 7-7 7z" />
      <path d="M12 16c0-3.5-2.5-5.5-5.5-5.5 0 4 2.5 5.5 5.5 5.5z" />
    </svg>
  );
}

/** 📝 Contratos / Documento / Assinatura */
export function ContractsIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

/** 👔 Comissão Técnica & Diretoria / Crachá */
export function StaffIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M8 18c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <line x1="10" y1="2" x2="14" y2="2" />
    </svg>
  );
}

/** 💰 Finanças / Conta Corrente / Saldo */
export function FinanceIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="17" cy="15" r="1.5" fill={color} />
    </svg>
  );
}

/** 🤝 Patrocínios / Parcerias Comerciais */
export function SponsorsIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 13L17 22l-5-3-5 3 1.5-9" />
      <circle cx="12" cy="8" r="2.5" />
    </svg>
  );
}

/** 🏟️ Estádio / Arena Esportiva */
export function StadiumIconSvg({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M3 11c0-4 4-7 9-7s9 3 9 7v5c0 4-4 7-9 7s-9-3-9-7v-5z" />
      <ellipse cx="12" cy="11" rx="6" ry="3" />
      <line x1="12" y1="14" x2="12" y2="18" />
    </svg>
  );
}

/** 🏆 Competições / Troféu / Taça */
export function CompetitionsIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12v7a6 6 0 0 1-12 0V4z" />
    </svg>
  );
}

/** 📅 Calendário / Agenda de Jogos */
export function AgendaIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="15" r="1" fill={color} />
      <circle cx="12" cy="15" r="1" fill={color} />
      <circle cx="16" cy="15" r="1" fill={color} />
    </svg>
  );
}

/** 🏛️ Galeria / Sala de Troféus / Histórico */
export function HistoryIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M12 2l7 4v6c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V6l7-4z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

/** 💼 Carreira do Treinador */
export function CareerIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

/** 🔄 Mercado / Transferências / Trocas */
export function TransfersIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H8a4 4 0 0 0-4 4v1" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h12a4 4 0 0 0 4-4v-1" />
    </svg>
  );
}

/** ⚠️ Alerta / Triângulo de Aviso */
export function AlertTriangleIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
    </svg>
  );
}

/** ⚡ Raio / Ação Rápida / Físico */

/** 📈 Pulso / Condicionamento Físico / Estamina */
export function ActivityIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

/** ☀️ Sol / Tempo Seco */
export function SunIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

/** 🌧️ Chuva / Campo Pesado */
export function CloudRainIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <line x1="16" y1="13" x2="16" y2="21" />
      <line x1="8" y1="13" x2="8" y2="21" />
      <line x1="12" y1="15" x2="12" y2="23" />
      <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    </svg>
  );
}

export function LightningIcon({ size = 18, color = 'currentColor', fill, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? 'none'}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/** Alvo / Ponto de Referência */
export function TargetIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/** 📋 Gerenciar em Lote / Checklist */
export function ChecklistIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12l2 2 4-4" />
      <path d="M9 17l2 2 4-4" />
    </svg>
  );
}

/** ⭐ Estrela / Destaque / Craque */
export function StarIcon({ size = 18, color = 'currentColor', fill, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? 'none'}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/** ☰ Menu Hambúrguer */
export function MenuIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/** ⚙️ Configurações / Opções */
export function SettingsIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** ⚽ Bola de Futebol */
export function SoccerBallIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 8 8 11 9.5 15.5 14.5 15.5 16 11" />
      <line x1="12" y1="2" x2="12" y2="8" />
      <line x1="8" y1="11" x2="2.5" y2="9" />
      <line x1="16" y1="11" x2="21.5" y2="9" />
      <line x1="9.5" y1="15.5" x2="6" y2="20" />
      <line x1="14.5" y1="15.5" x2="18" y2="20" />
    </svg>
  );
}

/** 🧠 Moral / Mentalidade */
export function BrainIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z" />
    </svg>
  );
}

/** ✓ Sucesso / Check */
export function CheckIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** ✕ Fechar / Excedente */
export function CrossIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** 🔄 Rotação */
export function RefreshIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

/** 👑 Coroa / Líder de Equipe / Capitão */
export function CrownIcon({ size = 18, color = 'currentColor', fill = 'none', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z" />
    </svg>
  );
}

/** 🛡️ Escudo Defensivo / Proteção */
export function ShieldIcon({ size = 18, color = 'currentColor', fill = 'none', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/** 🔥 Chama / Fogo / Moral Alto / Ambiente Aquecido */
export function FlameIcon({ size = 18, color = 'currentColor', fill = 'none', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

/** 👁️ Olho / Visão Simples */
export function EyeIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** ⏱️ Cronômetro / Relógio de Partida */
export function ClockIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/** 🏆 Troféu Oficial */
export function TrophyIcon({ size = 18, color = 'currentColor', fill = 'none', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12v7a6 6 0 0 1-12 0V4z" />
    </svg>
  );
}

export function BriefcaseIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function SearchIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function GlobeIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function StoreIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export const MarketIcon = StoreIcon;

export function MailIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function HandshakeIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <path d="M20 12l-4-4v3H8V8l-4 4 4 4v-3h8v3l4-4z" />
    </svg>
  );
}

export function BarChartIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

export function SwordsIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
      <line x1="5" y1="19" x2="11" y2="13" />
    </svg>
  );
}

export function ClipboardIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }} aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

/**
 * Despachante inteligente de ícones de navegação vetoriais para os Hubs e Drawer
 */
export function NavIcon({
  name,
  size = 18,
  color = 'currentColor',
  className,
  style,
}: {
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (
    name === 'competitions' ||
    name === 'league' ||
    name.startsWith('league') ||
    name === 'cup' ||
    name.startsWith('cup')
  ) {
    return <CompetitionsIcon size={size} color={color} className={className} style={style} />;
  }

  switch (name) {
    case 'agenda':
      return <AgendaIcon size={size} color={color} className={className} style={style} />;
    case 'history':
      return <HistoryIcon size={size} color={color} className={className} style={style} />;
    case 'career':
      return <CareerIcon size={size} color={color} className={className} style={style} />;
    case 'transfers':
      return <TransfersIcon size={size} color={color} className={className} style={style} />;
    case 'settings':
      return <SettingsIcon size={size} color={color} className={className} style={style} />;
    default:
      return null;
  }
}

/** Ícone SVG correspondente a cada cargo da comissão técnica */
export function StaffRoleIcon({
  role,
  size = 18,
  color = 'currentColor',
  className,
  style,
}: {
  role: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  switch (role) {
    case 'TACTICAL_ASSISTANT':
      return <TacticsIcon size={size} color={color} className={className} style={style} />;
    case 'FOOTBALL_DIRECTOR':
      return <BriefcaseIcon size={size} color={color} className={className} style={style} />;
    case 'FINANCIAL_DIRECTOR':
      return <FinanceIcon size={size} color={color} className={className} style={style} />;
    case 'FITNESS_COACH':
      return <TrainingIcon size={size} color={color} className={className} style={style} />;
    case 'YOUTH_COORDINATOR':
      return <AcademyIcon size={size} color={color} className={className} style={style} />;
    case 'DATA_ANALYST':
      return <BarChartIcon size={size} color={color} className={className} style={style} />;
    default:
      return null;
  }
}


/** ⚽🥅 Bola na Rede / Artilharia Estilizada */
export function GoalNetIcon({ size = 24, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M3 4h13v16H3" strokeWidth="2.2" />
      <path d="M16 4l5 3v12l-5 1" strokeWidth="1.6" />
      <path d="M3 8h13" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M3 12h13" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M3 16h13" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M7 4v16" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M11 4v16" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M16 8l5 2" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M16 12l5 1" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <path d="M16 16l5 1" strokeDasharray="1.5 1.5" strokeWidth="1.1" />
      <circle cx="15" cy="9.5" r="4.2" fill="var(--bg-card, #0f172a)" stroke={color} strokeWidth="1.8" />
      <polygon points="15 7.5 16.5 8.7 15.9 10.5 14.1 10.5 13.5 8.7" fill={color} />
      <line x1="15" y1="7.5" x2="15" y2="5.5" strokeWidth="1" />
      <line x1="16.5" y1="8.7" x2="19" y2="8" strokeWidth="1" />
      <line x1="15.9" y1="10.5" x2="17.8" y2="12.5" strokeWidth="1" />
      <line x1="14.1" y1="10.5" x2="12.2" y2="12.5" strokeWidth="1" />
      <line x1="13.5" y1="8.7" x2="11" y2="8" strokeWidth="1" />
      <path d="M18.8 6.5l2 1.5" strokeWidth="1.5" />
      <path d="M19.2 11l1.8 0.5" strokeWidth="1.5" />
    </svg>
  );
}

/** 👟 Chuteira de Passe & Assistências */
export function AssistBootIcon({ size = 18, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M3 16l4-8 4 3 5-1.5 4 4.5-2.5 3H3z" />
      <path d="M7 8l2 3" />
      <path d="M10 9l2 3" />
      <line x1="4" y1="19.5" x2="18.5" y2="19.5" strokeWidth="2.4" />
      <circle cx="20.5" cy="11.5" r="2" fill={color} />
      <path d="M19 14l-2 1" strokeDasharray="1 1" />
    </svg>
  );
}
