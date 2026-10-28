#!/usr/bin/env node
/**
 * squad-sync — traz elencos do mundo inteiro para o formato de content/players.csv e content/clubs.csv.
 *
 *   node tools/squad-sync/sync.mjs download   baixa os CSVs do transfermarkt-datasets para cache/
 *   node tools/squad-sync/sync.mjs build      gera content/clubs.generated.csv + players.generated.csv + relatório
 *   node tools/squad-sync/sync.mjs apply      acrescenta o gerado em clubs.csv/players.csv (com backup)
 *   node tools/squad-sync/sync.mjs all        download + build (+ apply com --apply)
 *
 * Regra de ouro: NUNCA sobrescreve um clube que já existe no jogo (casado por slug ou nome normalizado).
 * Só entram clubes novos; os elencos curados à mão continuam intactos.
 * Opcional: apifootball.mjs refina elencos de clubes específicos (ver README.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const cacheDir = path.join(here, 'cache');
const contentDir = path.join(root, 'content');
const BASE = process.env.TM_DATASET_BASE ?? 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data';
const FILES = ['players', 'clubs', 'competitions'];

/** Elenco máximo por clube e temporada mínima para um jogador contar como "ativo". */
const MAX_SQUAD = 30;
const MIN_LAST_SEASON = Number(process.env.MIN_LAST_SEASON ?? new Date().getFullYear() - 1);

// ---------- CSV ----------
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
export const readTable = (file) => {
  const [head, ...rows] = parseCsv(fs.readFileSync(file, 'utf8'));
  return rows.filter((r) => r.length > 1 && r.length <= head.length).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i]])));
};
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const toCsv = (head, rows) => [head.join(','), ...rows.map((r) => head.map((k) => esc(r[k] ?? '')).join(','))].join('\n') + '\n';

// ---------- normalização ----------
export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['club', 'de', 'del', 'da', 'do', 'fc', 'cf', 'sc', 'ac', 'as', 'ssc', 'afc', 'fk', 'sk', 'if', 'bk', 'cd', 'ca', 'ud', 'sd', 'the', '04', '05', '1899', '1907', '1909', '1910', '1913', '1899']);
/** Tokens que identificam um clube, sem os enfeites ("Club", "FC", "04"...). */
const ALIAS = { munich: 'munique', cologne: 'colonia', lisbon: 'lisboa', seville: 'sevilla', moscow: 'moscou', prague: 'praga', athletico: 'atletico', paranaense: 'paranaense' };
export const tokens = (name) => new Set(norm(name).split(' ').filter((t) => t && !STOP.has(t)).map((t) => ALIAS[t] ?? t));
/** Dois nomes do mesmo país são o mesmo clube quando os tokens de um estão contidos no outro. */
export const sameClub = (a, b) => {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  return [...small].every((t) => big.has(t));
};
export const slugify = (s) => norm(s).replace(/ /g, '-');

/** Posições canônicas do domínio: 'GK' | 'DEF' | 'LAT' | 'MID' | 'ATT'. Nunca DF/MF/FW. */
const SUB_POSITION = {
  Goalkeeper: 'GK',
  'Centre-Back': 'DEF',
  'Left-Back': 'LAT',
  'Right-Back': 'LAT',
  'Defensive Midfield': 'MID',
  'Central Midfield': 'MID',
  'Attacking Midfield': 'MID',
  'Left Midfield': 'MID',
  'Right Midfield': 'MID',
  'Left Winger': 'ATT',
  'Right Winger': 'ATT',
  'Second Striker': 'ATT',
  'Centre-Forward': 'ATT',
};
const POSITION = { Goalkeeper: 'GK', Defender: 'DEF', Midfield: 'MID', Attack: 'ATT' };
export const mapPosition = (sub, pos) => SUB_POSITION[sub] ?? POSITION[pos] ?? null;

/**
 * Nota do jogo a partir do valor de mercado (EUR), em escala log: 100 mil ≈ 55, 1 mi ≈ 64, 10 mi ≈ 73,
 * 50 mi ≈ 80, 150 mi ≈ 84. Sem valor conhecido cai no meio da tabela (60). Faixa final 40–92.
 */
export function ratingFromValue(value) {
  if (!(value > 0)) return 60;
  return Math.max(40, Math.min(92, Math.round(55 + 9 * Math.log10(value / 100_000))));
}

const ageOf = (dob, now = new Date()) => {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
};

// País (nome em inglês, como no Transfermarkt) -> código FIFA usado pelo jogo.
export const COUNTRY = {
  Brazil: 'BRA', Argentina: 'ARG', Uruguay: 'URU', Chile: 'CHI', Colombia: 'COL', Paraguay: 'PAR', Peru: 'PER',
  Ecuador: 'ECU', Bolivia: 'BOL', Venezuela: 'VEN', England: 'ENG', Spain: 'ESP', Italy: 'ITA', Germany: 'GER',
  France: 'FRA', Portugal: 'POR', Netherlands: 'NED', Belgium: 'BEL', Scotland: 'SCO', Croatia: 'CRO', Serbia: 'SRB',
  Turkey: 'TUR', 'Türkiye': 'TUR', Austria: 'AUT', Denmark: 'DEN', Switzerland: 'SUI', Sweden: 'SWE',
  'Czech Republic': 'CZE', Czechia: 'CZE', Norway: 'NOR', 'Bosnia-Herzegovina': 'BIH', 'Bosnia and Herzegovina': 'BIH',
  Poland: 'POL', Hungary: 'HUN', Ukraine: 'UKR', Iceland: 'ISL', Slovenia: 'SVN', Slovakia: 'SVK', Estonia: 'EST',
  Finland: 'FIN', Luxembourg: 'LUX', Greece: 'GRE', Wales: 'WAL', Bulgaria: 'BUL', Georgia: 'GEO', Kosovo: 'KOS',
  Armenia: 'ARM', Israel: 'ISR', Nigeria: 'NGA', Ghana: 'GHA', Morocco: 'MAR', Algeria: 'ALG', Egypt: 'EGY',
  Tunisia: 'TUN', Senegal: 'SEN', Cameroon: 'CMR', "Cote d'Ivoire": 'CIV', "Côte d'Ivoire": 'CIV', 'Ivory Coast': 'CIV',
  'South Africa': 'RSA', 'DR Congo': 'COD', Mali: 'MLI', Guinea: 'GUI', Angola: 'ANG', Zambia: 'ZAM', Zimbabwe: 'ZIM',
  Uganda: 'UGA', Tanzania: 'TAN', Ethiopia: 'ETH', Japan: 'JPN', 'South Korea': 'KOR', China: 'CHN',
  'Saudi Arabia': 'KSA', Qatar: 'QAT', 'United Arab Emirates': 'UAE', Iran: 'IRN', Iraq: 'IRQ', Jordan: 'JOR',
  Lebanon: 'LBN', Syria: 'SYR', India: 'IND', Thailand: 'THA', Vietnam: 'VIE', Indonesia: 'IDN', Singapore: 'SGP',
  Philippines: 'PHI', 'Hong Kong': 'HKG', Kazakhstan: 'KAZ', Uzbekistan: 'UZB', Azerbaijan: 'AZE', Tajikistan: 'TJK',
  'United States': 'USA', USA: 'USA', Mexico: 'MEX', Canada: 'CAN', 'Costa Rica': 'CRC', Panama: 'PAN',
  Honduras: 'HON', Guatemala: 'GUA', 'El Salvador': 'SLV', Jamaica: 'JAM', Cuba: 'CUB', Haiti: 'HAI',
  'Trinidad and Tobago': 'TRI', Nicaragua: 'NCA', 'Dominican Republic': 'DOM', Australia: 'AUS',
  'New Zealand': 'NZL', Ireland: 'IRL', 'Republic of Ireland': 'IRL', Romania: 'ROU', Russia: 'RUS', Belarus: 'BLR',
  Albania: 'ALB', 'North Macedonia': 'MKD', Montenegro: 'MNE', Moldova: 'MDA', Latvia: 'LVA', Lithuania: 'LTU',
  Cyprus: 'CYP', Malta: 'MLT', Libya: 'LBY', Sudan: 'SUD', Mozambique: 'MOZ', Gibraltar: 'GIB', 'San Marino': 'SMR',
  Liechtenstein: 'LIE', Andorra: 'AND', 'Faroe Islands': 'FRO', Fiji: 'FIJ', Belize: 'BLZ',
};

function validCountryCodes() {
  const src = fs.readFileSync(path.join(root, 'packages/shared/src/domain/country.ts'), 'utf8');
  const codes = new Set([...src.matchAll(/code:\s*'([A-Z]{3})'/g)].map((m) => m[1]));
  for (const r of readTable(path.join(contentDir, 'clubs.csv'))) codes.add(r.country);
  return codes;
}

// ---------- comandos ----------
async function download() {
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const f of FILES) {
    const res = await fetch(`${BASE}/${f}.csv.gz`);
    if (!res.ok) throw new Error(`Falha ao baixar ${f}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(cacheDir, `${f}.csv`), zlib.gunzipSync(buf));
    console.log(`baixado ${f}.csv (${(buf.length / 1e6).toFixed(1)} MB gz)`);
  }
}

export function build() {
  for (const f of FILES) {
    if (!fs.existsSync(path.join(cacheDir, `${f}.csv`))) throw new Error(`cache/${f}.csv não existe — rode "download" antes.`);
  }
  const valid = validCountryCodes();
  const existingClubs = readTable(path.join(contentDir, 'clubs.csv'));
  const knownSlugs = new Set(existingClubs.map((c) => c.slug));
  const knownNames = new Set(existingClubs.map((c) => norm(c.name)));
  const existingByCountry = new Map();
  for (const c of existingClubs) existingByCountry.set(c.country, [...(existingByCountry.get(c.country) ?? []), c.name]);

  const comps = new Map(readTable(path.join(cacheDir, 'competitions.csv')).map((c) => [c.competition_id, c]));
  const clubs = readTable(path.join(cacheDir, 'clubs.csv'));
  const players = readTable(path.join(cacheDir, 'players.csv'));

  const report = { clubsSeen: 0, clubsSkippedExisting: 0, clubsSkippedCountry: 0, clubsAdded: 0, playersAdded: 0, byCountry: {} };
  const outClubs = [];
  const clubBySlug = new Map();
  const clubById = new Map();

  for (const c of clubs) {
    report.clubsSeen++;
    const comp = comps.get(c.domestic_competition_id);
    const code = COUNTRY[comp?.country_name ?? ''];
    if (!code || !valid.has(code)) { report.clubsSkippedCountry++; continue; }
    if (Number(c.last_season) < MIN_LAST_SEASON) continue;
    let slug = slugify(c.club_code || c.name);
    if (knownNames.has(norm(c.name)) || knownSlugs.has(slug) || (existingByCountry.get(code) ?? []).some((n) => sameClub(n, c.name))) { report.clubsSkippedExisting++; continue; }
    if (clubBySlug.has(slug)) slug = `${slug}-${code.toLowerCase()}`;
    // Nome em alfabeto não latino (ex.: cirílico) vira o club_code do Transfermarkt, em maiúsculas iniciais.
    const name = /[^\u0000-\u024F]/.test(c.name) ? c.club_code.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : c.name;
    const row = {
      slug, name, country: code, division: comp.sub_type === 'first_tier' ? 1 : 2,
      stadium_capacity: Number(c.stadium_seats) > 0 ? Number(c.stadium_seats) : '', skill_level: '',
    };
    clubBySlug.set(slug, row);
    clubById.set(c.club_id, row);
  }

  const perClub = new Map();
  for (const p of players) {
    const club = clubById.get(p.current_club_id);
    if (!club || Number(p.last_season) < MIN_LAST_SEASON) continue;
    const position = mapPosition(p.sub_position, p.position);
    const age = ageOf(p.date_of_birth);
    if (!position || age == null || age < 15 || age > 45) continue;
    const value = Number(p.market_value_in_eur) || 0;
    const nat = COUNTRY[p.country_of_citizenship] ?? club.country;
    const list = perClub.get(club.slug) ?? [];
    list.push({
      club_slug: club.slug, name: p.name, position, age, nationality: valid.has(nat) ? nat : club.country,
      rating: ratingFromValue(value), star_level: 'NONE', diferenciado: 'NONE', _value: value,
    });
    perClub.set(club.slug, list);
  }

  const outPlayers = [];
  for (const [slug, list] of perClub) {
    // Clube com menos de 11 jogadores não monta um time — deixa o jogo gerar um elenco sintético.
    if (list.length < 11) continue;
    list.sort((a, b) => b._value - a._value);
    outPlayers.push(...list.slice(0, MAX_SQUAD));
    const club = clubBySlug.get(slug);
    outClubs.push(club);
    report.byCountry[club.country] = (report.byCountry[club.country] ?? 0) + 1;
  }
  report.clubsAdded = outClubs.length;
  report.playersAdded = outPlayers.length;

  fs.writeFileSync(path.join(contentDir, 'clubs.generated.csv'), toCsv(['slug', 'name', 'country', 'division', 'stadium_capacity', 'skill_level'], outClubs));
  fs.writeFileSync(path.join(contentDir, 'players.generated.csv'), toCsv(['club_slug', 'name', 'position', 'age', 'nationality', 'rating', 'star_level', 'diferenciado'], outPlayers));
  fs.writeFileSync(path.join(here, 'last-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}

function apply() {
  const gc = path.join(contentDir, 'clubs.generated.csv');
  const gp = path.join(contentDir, 'players.generated.csv');
  if (!fs.existsSync(gc) || !fs.existsSync(gp)) throw new Error('Nada gerado — rode "build" antes.');
  const stamp = new Date().toISOString().slice(0, 10);
  for (const [dest, gen] of [['clubs.csv', gc], ['players.csv', gp]]) {
    const target = path.join(contentDir, dest);
    const current = fs.readFileSync(target, 'utf8');
    const incoming = fs.readFileSync(gen, 'utf8').split('\n').slice(1).join('\n');
    if (!incoming.trim()) continue;
    fs.copyFileSync(target, `${target}.bak-squad-sync-${stamp}`);
    fs.writeFileSync(target, current.replace(/\n*$/, '\n') + incoming);
    console.log(`${dest}: acrescentadas ${incoming.trim().split('\n').length} linhas (backup .bak-squad-sync-${stamp})`);
  }
  fs.renameSync(gc, `${gc}.applied`);
  fs.renameSync(gp, `${gp}.applied`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  const run = { download, build, apply, all: async () => { await download(); build(); if (process.argv.includes('--apply')) apply(); } }[cmd];
  if (!run) { console.error('uso: sync.mjs download | build | apply | all [--apply]'); process.exit(1); }
  await run();
}
