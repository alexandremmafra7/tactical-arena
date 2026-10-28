import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FinanceIcon, TacticsIcon, BriefcaseIcon, ActivityIcon, AcademyIcon, StaffIcon } from './icons/AppIcons.js';
import type { Club } from '@tactical-arena/shared';
import {
  buildMeetingQueue,
  deferMeeting,
  weeklyBudgetSpent,
  type MeetingContext,
  type MeetingDeferral,
  type MeetingRequest,
} from '@tactical-arena/shared';

/**
 * O profissional da área pede uma reunião.
 *
 * Não é caixa de diálogo bloqueando a tela: é um cartão que sobe de baixo, com o rosto de quem fala, uma
 * frase em primeira pessoa e duas saídas. O jogador pode ignorá-lo e continuar usando a tela por trás, que é
 * a diferença entre um convite e uma interrupção.
 *
 * As regras de quando aparecer não estão aqui — estão em `staffMeetings`, no shared, porque são a parte que
 * decide se o sistema irrita e por isso precisam de teste. Aqui só se desenha e se registra a resposta.
 */

/**
 * Onde ficam os adiamentos.
 *
 * `localStorage`, e não o save do clube, de propósito: "não me incomode com isto" é preferência de quem está
 * jogando, não estado do mundo. Vale para as duas plataformas, sobrevive a fechar o jogo, e não polui o save
 * com uma coisa que nada no jogo lê além desta tela.
 */
const CHAVE_ADIAMENTOS = 'tactical_arena_reunioes_v1';

function renderSpeakerAvatar(icon: string, role: string | null) {
  if (icon === 'finance') return <FinanceIcon size={20} color="var(--accent)" />;
  if (icon === 'tactics') return <TacticsIcon size={20} color="var(--accent)" />;
  if (icon === 'director') return <BriefcaseIcon size={20} color="var(--accent)" />;
  if (icon === 'fitness') return <ActivityIcon size={20} color="var(--accent)" />;
  if (icon === 'youth') return <AcademyIcon size={20} color="var(--accent)" />;
  if (icon && (icon.startsWith('/') || icon.startsWith('http') || icon.startsWith('data:'))) {
    return <img src={icon} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />;
  }
  if (icon && icon.length <= 4) {
    return <span>{icon}</span>;
  }
  return <StaffIcon size={20} color="var(--accent)" />;
}

interface Memoria {
  deferrals: MeetingDeferral[];
  /** Semana da última contagem, para o teto semanal se reiniciar sozinho. */
  week: number;
  /** Quantas reuniões já foram abertas nesta semana. */
  countThisWeek: number;
  /** Último dia de jogo em que um cartão apareceu, para o teto diário. */
  lastShownDate: string | null;
}

const VAZIO: Memoria = { deferrals: [], week: 0, countThisWeek: 0, lastShownDate: null };

/** Onde a tela do clube lê quantos avisos do presidente já foram mostrados neste clube. */
export const CHAVE_AVISO_PRESIDENTE = 'tactical_arena_aviso_presidente_v1';

function marcarAvisoVisto(clubId: string, quantos: number): void {
  try {
    const atual = JSON.parse(localStorage.getItem(CHAVE_AVISO_PRESIDENTE) ?? '{}') as Record<string, number>;
    localStorage.setItem(CHAVE_AVISO_PRESIDENTE, JSON.stringify({ ...atual, [clubId]: quantos }));
  } catch {
    // Armazenamento bloqueado faz o presidente insistir, o que é chato mas não é quebrado.
  }
}

function lerMemoria(): Memoria {
  try {
    const bruto = localStorage.getItem(CHAVE_ADIAMENTOS);
    return bruto ? { ...VAZIO, ...(JSON.parse(bruto) as Memoria) } : VAZIO;
  } catch {
    // Armazenamento bloqueado é motivo para o jogo continuar, não para ele parar de funcionar.
    return VAZIO;
  }
}

function gravarMemoria(memoria: Memoria): void {
  try {
    localStorage.setItem(CHAVE_ADIAMENTOS, JSON.stringify(memoria));
  } catch {
    // Idem: sem memória o sistema volta a perguntar, o que é chato mas não é quebrado.
  }
}

interface MeetingCardProps {
  club: Club;
  context: MeetingContext;
  /** A data corrente do jogo, para o teto de um cartão por dia. */
  gameDate: string | null;
}

export function MeetingCard({ club, context, gameDate }: MeetingCardProps) {
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<MeetingRequest | null>(null);
  const [saindo, setSaindo] = useState(false);

  /**
   * Uma decisão por visita, e uma só.
   *
   * O efeito grava a contagem semanal, e efeito que grava não pode contar duas vezes a mesma visita. Em
   * desenvolvimento o React invoca cada efeito duas vezes de propósito, e sem esta trava o teto de três
   * reuniões por semana era consumido em dois pela mesma abertura de tela. Medido: contador em 2 com um
   * cartão exibido.
   */
  const jaDecidiu = useRef(false);

  useEffect(() => {
    if (jaDecidiu.current) return;

    const memoria = lerMemoria();

    // Semana nova zera a contagem, senão o teto de três valeria para a carreira inteira.
    const semanaAtual = context.currentWeek;
    const contagem = memoria.week === semanaAtual ? memoria.countThisWeek : 0;

    // Um por dia de jogo: se já apareceu um hoje, o resto espera amanhã.
    if (gameDate && memoria.lastShownDate === gameDate) return;
    if (weeklyBudgetSpent(contagem)) return;

    const fila = buildMeetingQueue(club, context, memoria.deferrals);
    if (fila.length === 0) return;

    /**
     * A trava fecha aqui, e não na entrada do efeito.
     *
     * Fechá-la logo no começo parecia mais seguro e quebrava tudo: na primeira passagem as propostas de
     * patrocínio ainda estão a ser buscadas, a fila vem vazia, e o efeito nunca mais rodava quando a resposta
     * chegava. Só a passagem que de facto mostra um cartão é que precisa não se repetir.
     */
    jaDecidiu.current = true;
    setPedido(fila[0]);
    gravarMemoria({
      ...memoria,
      week: semanaAtual,
      countThisWeek: contagem + 1,
      lastShownDate: gameDate,
    });

    // A fila é recalculada quando o clube ou o momento mudam, não a cada render.
  }, [club, context, gameDate]);

  if (!pedido) return null;

  function fechar(adiar: boolean) {
    /**
     * O aviso do presidente é dado uma vez, e a marca é posta ao fechar — não ao exibir.
     *
     * Marcar na exibição parecia mais seguro e engolia o cartão inteiro: em desenvolvimento o React monta
     * cada componente duas vezes, a primeira montagem gravava a marca, e a segunda já encontrava o aviso
     * como visto e não desenhava nada. Medido: a marca no armazenamento e nenhum cartão na tela.
     *
     * Fechar sem ler continua a contar como ouvido, que é a intenção: insistir com quem já viu é
     * exatamente o que este sistema existe para não fazer.
     */
    if (pedido?.topic === 'board') marcarAvisoVisto(club.id, context.boardWarningCount ?? 1);

    if (adiar && pedido) {
      const memoria = lerMemoria();
      gravarMemoria({ ...memoria, deferrals: deferMeeting(pedido.topic, context.currentWeek, memoria.deferrals) });
    }
    // Deixa a animação de saída correr antes de desmontar.
    setSaindo(true);
    setTimeout(() => setPedido(null), 200);
  }

  function atender() {
    const destino = pedido!.actionPath;
    fechar(false);
    navigate(destino.startsWith('/') ? destino : `/clubs/${club.id}/${destino}`);
  }

  return (
    <div className={`reuniao-cartao${saindo ? ' reuniao-cartao-saindo' : ''}`} role="dialog" aria-label="Pedido de reunião">
      <div className="reuniao-quem">
        <span className="reuniao-avatar" aria-hidden="true">{renderSpeakerAvatar(pedido.speakerIcon, pedido.role)}</span>
        <div className="reuniao-identidade">
          <strong className="reuniao-nome">{pedido.speakerName}</strong>
          <span className="reuniao-cargo">{pedido.speakerTitle}</span>
        </div>
        <button type="button" className="reuniao-fechar" onClick={() => fechar(false)} aria-label="Fechar">
          ✕
        </button>
      </div>

      <p className="reuniao-fala">{pedido.message}</p>

      <div className="reuniao-acoes">
        <button type="button" className="btn-primary reuniao-aceitar" onClick={atender}>
          {pedido.actionLabel}
        </button>
        {/* "Agora não" é uma resposta, e o sistema a leva a sério: ver deferMeeting. */}
        <button type="button" className="btn-secondary reuniao-adiar" onClick={() => fechar(true)}>
          Agora não
        </button>
      </div>
    </div>
  );
}
