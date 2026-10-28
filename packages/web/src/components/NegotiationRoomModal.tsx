import React, { useState } from 'react';
import type { Club, Player } from '@tactical-arena/shared';
import { evaluateContractNegotiation, getPlayerTier, type AgentProfile, type NegotiationOffer, type NegotiationStatus } from '@tactical-arena/shared';
import { SpecialPlayerBadge } from './SpecialPlayerIcon.js';
import { positionLabel } from '../lib/positionLabel.js';
import { BriefcaseIcon } from './icons/AppIcons.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface NegotiationRoomModalProps {
  player: Player;
  club: Club;
  isOpen: boolean;
  onClose: () => void;
  onSuccessDeal: (acceptedOffer: NegotiationOffer) => Promise<void>;
}

export function NegotiationRoomModal({
  player,
  club,
  isOpen,
  onClose,
  onSuccessDeal,
}: NegotiationRoomModalProps) {
  const [agent, setAgent] = useState<AgentProfile>({
    name: `Agente de ${player.name.split(' ')[0]}`,
    personality: player.overall >= 85 ? 'GREEDY' : 'AMBITIOUS',
    patience: 100,
  });

  const [weeklyWage, setWeeklyWage] = useState<number>(Math.max(player.wage * 1.1, 20_000));
  const [signingBonus, setSigningBonus] = useState<number>(100_000);
  const [contractYears, setContractYears] = useState<number>(3);
  const [goalBonus, setGoalBonus] = useState<number>(2_500);
  const [cleanSheetBonus, setCleanSheetBonus] = useState<number>(player.position === 'GK' || player.position === 'DEF' ? 3_000 : 0);
  const [appearanceBonus, setAppearanceBonus] = useState<number>(1_000);
  const [releaseClause, setReleaseClause] = useState<number>(weeklyWage * 104 * 3);

  const [dialogMessage, setDialogMessage] = useState<string>(
    `Olá, sou ${agent.name}. Estamos prontos para ouvir sua proposta para o contrato de ${player.name}. Venha com valores justos se quiser fechar negócio!`
  );
  const [status, setStatus] = useState<NegotiationStatus | 'PENDING'>('PENDING');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado, player.age, player.potential, player.name);

  const handleEvaluate = () => {
    const offer: NegotiationOffer = {
      weeklyWage,
      signingBonus,
      contractYears,
      goalBonus,
      cleanSheetBonus,
      appearanceBonus,
      releaseClause,
    };

    const result = evaluateContractNegotiation({
      player,
      club,
      offer,
      agent,
    });

    setAgent(result.updatedAgent);
    setDialogMessage(result.message);
    setStatus(result.status);

    if (result.status === 'COUNTER_OFFER' && result.counterOffer) {
      setWeeklyWage(result.counterOffer.weeklyWage);
      setSigningBonus(result.counterOffer.signingBonus);
      setContractYears(result.counterOffer.contractYears);
      setGoalBonus(result.counterOffer.goalBonus);
      setCleanSheetBonus(result.counterOffer.cleanSheetBonus);
      setAppearanceBonus(result.counterOffer.appearanceBonus);
      setReleaseClause(result.counterOffer.releaseClause);
    }
  };

  async function handleFinalizeDeal() {
    if (status !== 'ACCEPTED') return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSuccessDeal({
        weeklyWage,
        signingBonus,
        contractYears,
        goalBonus,
        cleanSheetBonus,
        appearanceBonus,
        releaseClause,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const getPersonalityLabel = (p: string) => {
    switch (p) {
      case 'GREEDY': return 'Ganancioso';
      case 'STUBBORN': return 'Rigoroso';
      case 'AMBITIOUS': return 'Ambicioso';
      case 'DIPLOMATIC': return 'Diplomático';
      default: return p;
    }
  };

  const patienceColor = agent.patience > 60 ? 'bg-emerald-500' : agent.patience > 30 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Stadium Night */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-6 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-800 border border-emerald-500/30 flex items-center justify-center text-2xl font-black text-emerald-400">
              {player.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">{player.name}</h2>
                {tier && <SpecialPlayerBadge tier={tier} size="md" />}
              </div>
              <p className="text-sm text-slate-400">
                {positionLabel(player.position)} • Overall: <span className="text-emerald-400 font-bold">{player.overall}</span> • Valor: {formatMoney(player.marketValue)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold px-3 py-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Agent & Patience Card */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold">
                <BriefcaseIcon size={22} color="#34d399" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{agent.name}</p>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {getPersonalityLabel(agent.personality)}
                </span>
              </div>
            </div>

            <div className="w-full md:w-64 space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Paciência do Empresário</span>
                <span className="font-bold">{agent.patience}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                <div className={`h-full transition-all duration-500 ${patienceColor}`} style={{ width: `${agent.patience}%` }} />
              </div>
            </div>
          </div>

          {/* Dialogue Bubble */}
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Mesa de Diálogo</p>
              <p className="text-sm text-slate-200 italic">"{dialogMessage}"</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-950/50 border border-red-500/40 text-red-300 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Sliders & Contract Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Salário Semanal</span>
                <span className="font-bold text-emerald-400">{formatMoney(weeklyWage)}</span>
              </div>
              <input
                type="range"
                min={10_000}
                max={300_000}
                step={5_000}
                value={weeklyWage}
                onChange={(e) => setWeeklyWage(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-800/50 border border-slate-700/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Duração do Contrato</span>
                <span className="font-bold text-emerald-400">{contractYears} Anos</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={contractYears}
                onChange={(e) => setContractYears(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-800/50 border border-slate-700/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Luvas de Assinatura</span>
                <span className="font-bold text-emerald-400">{formatMoney(signingBonus)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={2_000_000}
                step={50_000}
                value={signingBonus}
                onChange={(e) => setSigningBonus(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-800/50 border border-slate-700/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Multa Rescisória</span>
                <span className="font-bold text-emerald-400">{formatMoney(releaseClause)}</span>
              </div>
              <input
                type="range"
                min={500_000}
                max={100_000_000}
                step={1_000_000}
                value={releaseClause}
                onChange={(e) => setReleaseClause(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-800/50 border border-slate-700/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Bônus por Gol</span>
                <span className="font-bold text-emerald-400">{formatMoney(goalBonus)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20_000}
                step={1_000}
                value={goalBonus}
                onChange={(e) => setGoalBonus(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="bg-slate-800/50 border border-slate-700/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Bônus Clean Sheet (Sem Sofrer Gols)</span>
                <span className="font-bold text-emerald-400">{formatMoney(cleanSheetBonus)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20_000}
                step={1_000}
                value={cleanSheetBonus}
                onChange={(e) => setCleanSheetBonus(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {status !== 'ACCEPTED' && status !== 'STORMED_OUT' && (
              <button
                onClick={handleEvaluate}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/30 transition"
              >
                Apresentar Proposta
              </button>
            )}

            {status === 'ACCEPTED' && (
              <button
                disabled={isSubmitting}
                onClick={handleFinalizeDeal}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/30 transition animate-pulse"
              >
                {isSubmitting ? 'Assinando...' : 'Assinar Contrato Oficial'}
              </button>
            )}

            {status === 'STORMED_OUT' && (
              <div className="text-red-400 font-bold text-sm">
                Negociação Encerrada por Paciência Esgotada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
