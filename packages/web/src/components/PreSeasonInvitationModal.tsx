import React, { useState } from 'react';
import type { Club, PreSeasonTournament } from '@tactical-arena/shared';
import { generatePreSeasonInvitations } from '@tactical-arena/shared';
import { TrophyIcon, TrainingIcon, GlobeIcon } from './icons/AppIcons.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface PreSeasonInvitationModalProps {
  club: Club;
  isOpen: boolean;
  onClose: () => void;
  onAcceptTournament: (tournament: PreSeasonTournament) => Promise<void>;
  onStayAtCt: () => Promise<void>;
}

export function PreSeasonInvitationModal({
  club,
  isOpen,
  onClose,
  onAcceptTournament,
  onStayAtCt,
}: PreSeasonInvitationModalProps) {
  const clubPrestige = (club as any).prestige ?? (club.titlesWon || 1) * 10 + 50;
  const invitations = generatePreSeasonInvitations(clubPrestige);
  const [selectedTour, setSelectedTour] = useState<PreSeasonTournament>(invitations[0]!);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleAccept() {
    setIsSubmitting(true);
    try {
      await onAcceptTournament(selectedTour);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStay() {
    setIsSubmitting(true);
    try {
      await onStayAtCt();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Stadium Night */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-6 border-b border-emerald-500/20 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
              <GlobeIcon size={24} color="#34d399" /> Convites para Torneios de Pré-Temporada
            </h2>
            <p className="text-sm text-slate-400">Escolha uma turnê internacional lucrativa ou decida realizar a preparação no Centro de Treinamento.</p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invitations.map((tour) => {
              const isSelected = selectedTour.id === tour.id;
              return (
                <div
                  key={tour.id}
                  onClick={() => setSelectedTour(tour)}
                  className={`cursor-pointer rounded-xl p-5 border transition-all ${
                    isSelected
                      ? 'bg-emerald-950/50 border-emerald-500 shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-500/50'
                      : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        {tour.hostCountry} • {tour.hostCity}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{tour.name}</h3>
                    </div>
                    <TrophyIcon size={24} color="#fbbf24" />
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cota de Participação:</span>
                      <strong className="text-emerald-400">{formatMoney(tour.appearanceFee)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Prêmio ao Campeão:</span>
                      <strong className="text-amber-400">{formatMoney(tour.prizePool)}</strong>
                    </div>
                  </div>

                  <div className="border-t border-slate-700/60 pt-3">
                    <p className="text-xs text-slate-400 font-semibold mb-1">Participantes Confirmados:</p>
                    <div className="flex flex-wrap gap-1">
                      {tour.participants.map((p, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            disabled={isSubmitting}
            onClick={handleStay}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition flex items-center justify-center gap-2"
          >
            <TrainingIcon size={16} /> Permanecer no CT (Treino Intensivo)
          </button>

          <button
            disabled={isSubmitting}
            onClick={handleAccept}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-900/40 transition flex items-center justify-center gap-2"
          >
            <GlobeIcon size={16} /> Aceitar Convite & Viajar ({selectedTour.name})
          </button>
        </div>
      </div>
    </div>
  );
}
