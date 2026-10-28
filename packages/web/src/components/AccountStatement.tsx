import { useMemo } from 'react';
import type { Club } from '@tactical-arena/shared';
import { buildAccountStatement, type AccountLine, type HealthIndicator } from '@tactical-arena/shared';

/**
 * A conta corrente do clube: o que entra, o que sai, e como está a saúde.
 *
 * A tela de Finanças mostrava o caixa e mais nada: um número grande, sem dizer de onde ele vem nem para onde
 * vai. O técnico assinava salário sem saber quanto da receita já estava comprometida, e descobria o buraco
 * semanas depois. Toda a conta vem de `buildAccountStatement`, no shared, que refaz exatamente a soma que o
 * `weeklyTickService` executa toda semana.
 *
 * Não há extrato do passado porque o jogo não guarda lançamento: não existe tabela de movimentação. O que
 * está aqui é o retrato de agora e a projeção de "se nada mudar", que é a pergunta que importa antes de
 * gastar.
 */
function dinheiro(valor: number): string {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Uma linha do extrato, com barra proporcional ao maior valor da sua coluna. */
function Linha({ linha, maior, tom }: { linha: AccountLine; maior: number; tom: 'entrada' | 'saida' }) {
  const largura = maior > 0 ? Math.max(4, Math.round((linha.amount / maior) * 100)) : 0;
  return (
    <li className={`conta-linha conta-linha-${tom}`}>
      <div className="conta-linha-topo">
        <span className="conta-linha-label">{linha.label}</span>
        <strong className="conta-linha-valor">{dinheiro(linha.amount)}</strong>
      </div>
      {/* A barra é o que deixa a proporção óbvia sem ler número nenhum. */}
      <div className="conta-barra-trilho">
        <div className="conta-barra-preenchida" style={{ width: `${largura}%` }} />
      </div>
      <span className="conta-linha-hint">{linha.hint}</span>
    </li>
  );
}

function Indicador({ ind }: { ind: HealthIndicator }) {
  return (
    <div className={`conta-indicador conta-indicador-${ind.level}`}>
      <span className="conta-indicador-label">{ind.label}</span>
      <strong className="conta-indicador-valor">{ind.value}</strong>
      <span className="conta-indicador-hint">{ind.hint}</span>
    </div>
  );
}

/**
 * O saldo projetado, em linha.
 *
 * SVG à mão em vez de biblioteca: são vinte pontos e uma reta, e o pacote do jogo não precisa de mais
 * trezentos kilobytes para desenhar isso. A faixa vermelha marca onde o caixa cruza o zero, que é a única
 * informação que o técnico realmente procura aqui.
 */
function Projecao({ pontos }: { pontos: number[] }) {
  const largura = 320;
  const altura = 96;
  const min = Math.min(0, ...pontos);
  const max = Math.max(0, ...pontos);
  const faixa = max - min || 1;

  const y = (valor: number) => altura - ((valor - min) / faixa) * altura;
  const caminho = pontos
    .map((valor, i) => `${i === 0 ? 'M' : 'L'} ${(i / (pontos.length - 1)) * largura} ${y(valor)}`)
    .join(' ');

  const zeroY = y(0);
  const cruzaZero = min < 0;

  return (
    <div className="conta-projecao">
      <div className="conta-projecao-titulo">
        <span>Projeção do caixa</span>
        <span className="conta-projecao-sub">20 semanas, se nada mudar</span>
      </div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="conta-projecao-svg" role="img" aria-label="Saldo projetado">
        {cruzaZero && (
          <>
            <rect x="0" y={zeroY} width={largura} height={Math.max(0, altura - zeroY)} className="conta-projecao-vermelho" />
            <line x1="0" y1={zeroY} x2={largura} y2={zeroY} className="conta-projecao-zero" />
          </>
        )}
        <path d={caminho} className="conta-projecao-linha" />
      </svg>
      <div className="conta-projecao-pes">
        <span>hoje {dinheiro(pontos[0])}</span>
        <span>em 20 semanas {dinheiro(pontos[pontos.length - 1])}</span>
      </div>
    </div>
  );
}

export function AccountStatement({ club }: { club: Club }) {
  const extrato = useMemo(() => buildAccountStatement(club), [club]);
  const maiorEntrada = Math.max(...extrato.income.map((l) => l.amount), 0);
  const maiorSaida = Math.max(...extrato.expenses.map((l) => l.amount), 0);
  const positivo = extrato.net >= 0;

  return (
    <section className="conta-corrente">
      <header className="conta-cabecalho">
        <div className="conta-caixa">
          <span className="conta-caixa-label">Saldo em caixa</span>
          <strong className="conta-caixa-valor">{dinheiro(extrato.cash)}</strong>
        </div>
        <div className={`conta-resultado conta-resultado-${positivo ? 'positivo' : 'negativo'}`}>
          <span className="conta-resultado-label">Resultado da semana</span>
          <strong className="conta-resultado-valor">
            {positivo ? '+' : '-'}
            {dinheiro(Math.abs(extrato.net))}
          </strong>
        </div>
      </header>

      <div className="conta-indicadores">
        {extrato.indicators.map((ind) => (
          <Indicador key={ind.key} ind={ind} />
        ))}
      </div>

      <Projecao pontos={extrato.projection} />

      <div className="conta-colunas">
        <div className="conta-coluna">
          <h3 className="conta-coluna-titulo conta-coluna-titulo-entrada">
            Entradas <span>{dinheiro(extrato.totalIncome)}</span>
          </h3>
          <ul className="conta-lista">
            {extrato.income.map((linha) => (
              <Linha key={linha.key} linha={linha} maior={maiorEntrada} tom="entrada" />
            ))}
          </ul>
        </div>

        <div className="conta-coluna">
          <h3 className="conta-coluna-titulo conta-coluna-titulo-saida">
            Saídas <span>{dinheiro(extrato.totalExpenses)}</span>
          </h3>
          <ul className="conta-lista">
            {extrato.expenses.map((linha) => (
              <Linha key={linha.key} linha={linha} maior={maiorSaida} tom="saida" />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
