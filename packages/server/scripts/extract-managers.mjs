import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Extrai o nome do técnico de cada clube a partir da base do Brasfoot, e casa com os nossos clubes.
 *
 * O jogo não tinha treinadores no mundo, e sem eles não há de quem um clube se separar — "outro clube se
 * interessou por você" seria ficção. Nomes inventados resolveriam o problema técnico e não o de sabor: um
 * mundo em que o Palmeiras é dirigido por "Carlos Silva" não parece futebol.
 *
 * **O que este script lê, e o que não lê.** Cada `.ban` é um objeto Java serializado, e daqui sai apenas o
 * texto: nome do clube, estádio e técnico — fatos públicos, os mesmos que qualquer tabela de campeonato
 * publica. Nada de lógica, fórmula ou regra do jogo de origem é lido ou reproduzido.
 *
 * Roda uma vez e grava `content/managers.csv`. Não faz parte do build: a origem é uma pasta na máquina de
 * quem o roda, e o resultado é que fica versionado.
 *
 * Uso: node packages/server/scripts/extract-managers.mjs "D:/Games/Brasfoot EFL/teams"
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizRepo = path.resolve(aqui, '..', '..', '..');

/**
 * Lê os campos de texto de um objeto Java serializado.
 *
 * O formato grava cada string como `0x74` seguido do tamanho em dois bytes. Os campos vêm na ordem em que
 * a classe os declara, e a partir do marcador `xp` (fim do descritor de classe) são sempre os mesmos seis:
 * duas cores, o identificador, o nome, o estádio e o técnico. Confirmado em toda a base, não num arquivo só.
 */
function camposDeTexto(arquivo) {
  const dados = fs.readFileSync(arquivo);
  let i = dados.indexOf(Buffer.from('xp'));
  if (i < 0) return [];
  i += 2;

  const campos = [];
  while (i < dados.length && campos.length < 8) {
    if (dados[i] === 0x74) {
      const n = dados.readUInt16BE(i + 1);
      campos.push(dados.subarray(i + 3, i + 3 + n).toString('utf8'));
      i += 3 + n;
    } else {
      i += 1;
    }
  }
  return campos;
}

/**
 * Reduz um nome de clube ao que dá para comparar entre duas bases.
 *
 * "Atlético" e "Athletic" **não** entram na lista de ruído, ainda que pareçam sufixo: são parte do nome, e
 * removê-los fundia Atlético Mineiro, Atlético Goianiense e Athletico Paranaense num só clube chamado
 * "mineiro", "goianiense" e "paranaense" — três dos vinte clubes da Série A ficaram sem técnico por isso.
 */
const RUIDO = /\b(fc|sc|ec|cf|ac|afc|cd|ca|club|clube|de|do|da|futebol|football|calcio)\b/g;
function normalizar(nome) {
  return nome
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(RUIDO, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

function lerCsv(arquivo) {
  const linhas = fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const cabecalho = linhas[0].split(',');
  return linhas.slice(1).map((linha) => {
    const celulas = linha.split(',');
    return Object.fromEntries(cabecalho.map((c, i) => [c, celulas[i] ?? '']));
  });
}

const pastaTimes = process.argv[2];
if (!pastaTimes || !fs.existsSync(pastaTimes)) {
  console.error('Informe a pasta "teams" da base de origem. Ex: node ... "D:/Games/Brasfoot EFL/teams"');
  process.exit(1);
}

const origem = [];
for (const arquivo of fs.readdirSync(pastaTimes).filter((f) => f.endsWith('.ban')).sort()) {
  const campos = camposDeTexto(path.join(pastaTimes, arquivo));
  if (campos.length < 6 || !campos[3] || !campos[5]) continue;

  /**
   * Arquivo sem sufixo de país fica com o país **desconhecido**, e não brasileiro.
   *
   * Tratá-los como do Brasil parecia seguro — a maioria é — e custou o Arsenal, o Bayern e ligas inteiras:
   * `arsenal.ban` não tem sufixo, virava um clube brasileiro chamado Arsenal, e nunca casava com o inglês.
   */
  const m = /^(.*?)_([a-zA-Z]{2,3})\.ban$/.exec(arquivo);
  origem.push({ paisOrigem: m ? m[2].toUpperCase() : null, clube: campos[3], tecnico: campos[5].trim() });
}

const nossos = lerCsv(path.join(raizRepo, 'content', 'clubs.csv'));
const porNome = new Map();
for (const clube of nossos) {
  const chave = normalizar(clube.name);
  if (!porNome.has(chave)) porNome.set(chave, []);
  porNome.get(chave).push(clube);
}

/**
 * O mapa de países sai dos próprios dados, e não da minha cabeça.
 *
 * Os códigos da base de origem são em português (ALE, HOL, JAP) e não coincidem com os nossos. Escrever a
 * tabela à mão foi exatamente como sete países entraram errados neste projeto antes — ARL virou Argentina em
 * vez de Argélia, CAT virou Catalunha em vez de Catar. Aqui cada código é decidido por votação: para onde
 * apontam os clubes cujo nome bate sozinho.
 */
const votos = new Map();
for (const b of origem) {
  if (!b.paisOrigem) continue;
  for (const c of porNome.get(normalizar(b.clube)) ?? []) {
    if (!votos.has(b.paisOrigem)) votos.set(b.paisOrigem, new Map());
    const cont = votos.get(b.paisOrigem);
    cont.set(c.country, (cont.get(c.country) ?? 0) + 1);
  }
}

const mapaPaises = new Map();
for (const [origemPais, cont] of votos) {
  const total = [...cont.values()].reduce((a, b) => a + b, 0);
  const [melhor, n] = [...cont].sort((a, b) => b[1] - a[1])[0];
  // Dois acertos e sessenta por cento de concordância: abaixo disso é coincidência de nome, não país.
  if (n >= 2 && n / total >= 0.6) mapaPaises.set(origemPais, melhor);
}

const casados = new Map();
function casar(slug, tecnico) {
  if (!casados.has(slug)) casados.set(slug, tecnico);
}

// 1. Nome idêntico dentro do país já mapeado.
for (const b of origem) {
  const alvo = b.paisOrigem ? mapaPaises.get(b.paisOrigem) : null;
  const candidatos = porNome.get(normalizar(b.clube)) ?? [];
  const escolhidos = alvo ? candidatos.filter((c) => c.country === alvo) : candidatos;
  if (escolhidos.length === 1) casar(escolhidos[0].slug, b.tecnico);
}

// 2. Nome idêntico e único no mundo inteiro, para quem não tem país conhecido dos dois lados.
for (const b of origem) {
  const candidatos = porNome.get(normalizar(b.clube)) ?? [];
  if (candidatos.length === 1) casar(candidatos[0].slug, b.tecnico);
}

// 3. Um nome contido no outro, dentro do país: pega "Inter" contra "Inter de Milão" sem inventar parentesco.
const porPais = new Map();
for (const c of nossos) {
  if (!porPais.has(c.country)) porPais.set(c.country, []);
  porPais.get(c.country).push(c);
}
for (const b of origem) {
  const alvo = b.paisOrigem ? mapaPaises.get(b.paisOrigem) : null;
  if (!alvo) continue;
  const nb = normalizar(b.clube);
  if (nb.length < 5) continue;
  const hits = (porPais.get(alvo) ?? []).filter(
    (c) => !casados.has(c.slug) && (nb.includes(normalizar(c.name)) || normalizar(c.name).includes(nb)),
  );
  if (hits.length === 1) casar(hits[0].slug, b.tecnico);
}

/**
 * As convenções de nome que nenhuma heurística resolve, conferidas à mão.
 *
 * A base de origem escreve os clubes brasileiros com sigla de estado ("Atlético-MG") e nós escrevemos o
 * gentílico ("Atlético Mineiro"). São poucos e são os que o jogador mais nota, então valem ser conferidos um
 * a um em vez de ganharem mais uma regra automática que erraria em silêncio noutro lugar.
 */
const APELIDOS = {
  'atletico-mg': 'Atlético-MG',
  'atletico-goianiense': 'Atlético-GO',
  'atletico-paranaense': 'Atlético-PR',
  'vasco-da-gama': 'Vasco',
};
const porNomeOrigem = new Map(origem.map((b) => [normalizar(b.clube), b.tecnico]));
for (const [slug, nomeOrigem] of Object.entries(APELIDOS)) {
  const tecnico = porNomeOrigem.get(normalizar(nomeOrigem));
  if (tecnico) casar(slug, tecnico);
}

const saida = ['club_slug,name', ...[...casados].sort().map(([slug, nome]) => `${slug},${nome}`)].join('\n');
fs.writeFileSync(path.join(raizRepo, 'content', 'managers.csv'), `${saida}\n`, 'utf8');

const primeiraDivisao = nossos.filter((c) => c.division === '1');
console.log(`Clubes na origem: ${origem.length}`);
console.log(`Códigos de país deduzidos: ${mapaPaises.size}`);
console.log(`Técnicos casados: ${casados.size} de ${nossos.length} clubes`);
console.log(`Primeira divisão coberta: ${primeiraDivisao.filter((c) => casados.has(c.slug)).length} de ${primeiraDivisao.length}`);
