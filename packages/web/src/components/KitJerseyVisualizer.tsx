import type { Club, Sponsorship } from '@tactical-arena/shared';
import { HDVectorJersey } from './HDVectorJersey.js';
import { LockerRoomIcon, SponsorsIcon, TacticsIcon, StadiumIconSvg } from './icons/AppIcons.js';

export interface KitJerseyVisualizerProps {
  club: Club;
  sponsorships?: Sponsorship[];
  isAway?: boolean;
  className?: string;
}

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function KitJerseyVisualizer({
  club,
  sponsorships,
  isAway = false,
  className = 'kit-jersey-visualizer-container',
}: KitJerseyVisualizerProps) {
  const activeSponsors = sponsorships ?? club.sponsorships ?? [];
  const masterSponsor = activeSponsors.find((s) => s.type === 'MASTER');
  const sleeveSponsor = activeSponsors.find((s) => s.type === 'KIT_SUPPLIER');
  const backSponsor = activeSponsors.find((s) => s.type === 'REGIONAL');
  const namingSponsor = activeSponsors.find((s) => s.type === 'STADIUM_NAMING');

  return (
    <div className={className} role="region" aria-label="Visualizador de Uniforme e Patrocínios">
      <div className="kit-visualizer-header">
        <h3 className="kit-visualizer-title">Manto e Patrocínios</h3>
        <span className="kit-visualizer-season-tag">Temporada 2026</span>
      </div>

      <div className="kit-visualizer-display">
        <div className="kit-showcase-duo">
          <div className="kit-visualizer-jersey-wrapper">
            <span className="kit-jersey-label">Uniforme Titular (Home)</span>
            <HDVectorJersey
              club={club}
              isAway={false}
              size={140}
              masterSponsorName={masterSponsor?.sponsorName}
              supplierSponsorName={sleeveSponsor?.sponsorName}
              optionalSponsorName={backSponsor?.sponsorName}
              showOptionalSponsor={Boolean(backSponsor)}
            />
          </div>

          <div className="kit-visualizer-jersey-wrapper">
            <span className="kit-jersey-label">Uniforme Reserva (Away)</span>
            <HDVectorJersey
              club={club}
              isAway={true}
              size={140}
              masterSponsorName={masterSponsor?.sponsorName}
              supplierSponsorName={sleeveSponsor?.sponsorName}
              optionalSponsorName={backSponsor?.sponsorName}
              showOptionalSponsor={Boolean(backSponsor)}
            />
          </div>
        </div>

        <div className="kit-visualizer-sponsors-grid">

          <div className={`kit-sponsor-slot ${masterSponsor ? 'active' : 'empty'}`}>
            <span className="kit-sponsor-slot-icon">
              <LockerRoomIcon size={20} color="#38bdf8" />
            </span>
            <div className="kit-sponsor-slot-details">
              <span className="kit-sponsor-slot-label">Patrocínio Master</span>
              {masterSponsor ? (
                <>
                  <span className="kit-sponsor-name">{masterSponsor.sponsorName}</span>
                  <span className="kit-sponsor-meta">
                    {formatMoney(masterSponsor.weeklyAmount)}/sem • {masterSponsor.weeksRemaining} sem.
                  </span>
                </>
              ) : (
                <span className="kit-sponsor-empty-text">Espaço vago</span>
              )}
            </div>
          </div>

          <div className={`kit-sponsor-slot ${sleeveSponsor ? 'active' : 'empty'}`}>
            <span className="kit-sponsor-slot-icon">
              <SponsorsIcon size={20} color="#fbbf24" />
            </span>
            <div className="kit-sponsor-slot-details">
              <span className="kit-sponsor-slot-label">Mangas (Material Esportivo)</span>
              {sleeveSponsor ? (
                <>
                  <span className="kit-sponsor-name">{sleeveSponsor.sponsorName}</span>
                  <span className="kit-sponsor-meta">
                    {formatMoney(sleeveSponsor.weeklyAmount)}/sem • {sleeveSponsor.weeksRemaining} sem.
                  </span>
                </>
              ) : (
                <span className="kit-sponsor-empty-text">Espaço vago</span>
              )}
            </div>
          </div>

          <div className={`kit-sponsor-slot ${backSponsor ? 'active' : 'empty'}`}>
            <span className="kit-sponsor-slot-icon">
              <TacticsIcon size={20} color="#a78bfa" />
            </span>
            <div className="kit-sponsor-slot-details">
              <span className="kit-sponsor-slot-label">Costas (Regional)</span>
              {backSponsor ? (
                <>
                  <span className="kit-sponsor-name">{backSponsor.sponsorName}</span>
                  <span className="kit-sponsor-meta">
                    {formatMoney(backSponsor.weeklyAmount)}/sem • {backSponsor.weeksRemaining} sem.
                  </span>
                </>
              ) : (
                <span className="kit-sponsor-empty-text">Espaço vago</span>
              )}
            </div>
          </div>

          <div className={`kit-sponsor-slot ${namingSponsor ? 'active' : 'empty'}`}>
            <span className="kit-sponsor-slot-icon">
              <StadiumIconSvg size={20} color="#34d399" />
            </span>
            <div className="kit-sponsor-slot-details">
              <span className="kit-sponsor-slot-label">Naming Rights do Estádio</span>
              {namingSponsor ? (
                <>
                  <span className="kit-sponsor-name">{namingSponsor.sponsorName}</span>
                  <span className="kit-sponsor-meta">
                    {formatMoney(namingSponsor.weeklyAmount)}/sem • {namingSponsor.weeksRemaining} sem.
                  </span>
                </>
              ) : (
                <span className="kit-sponsor-empty-text">Espaço vago</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
