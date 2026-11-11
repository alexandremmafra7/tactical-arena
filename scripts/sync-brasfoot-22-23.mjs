import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const BRASFOOT_DIR = 'D:\\Games\\Brasfoot22-23';
const TEAMS_DIR = path.join(BRASFOOT_DIR, 'teams');
const EXE_PATH = path.join(BRASFOOT_DIR, 'bf22-23.exe');

const CONTENT_DIR = path.resolve('content');
const CLUBS_CSV_PATH = path.join(CONTENT_DIR, 'clubs.csv');
const PLAYERS_CSV_PATH = path.join(CONTENT_DIR, 'players.csv');
const MANAGERS_CSV_PATH = path.join(CONTENT_DIR, 'managers.csv');
const KITS_JSON_PATH = path.join(CONTENT_DIR, 'kits.json');
const CRESTS_DIR = path.join(CONTENT_DIR, 'crests');
const JERSEYS_DIR = path.join(CONTENT_DIR, 'jerseys');
const TROPHIES_DIR = path.join(CONTENT_DIR, 'trophies');
const NATIONAL_JERSEYS_DIR = path.join(CONTENT_DIR, 'national-jerseys');

const BRASFOOT_TO_CANONICAL = {
  'AFS': 'RSA', 'ALE': 'GER', 'AGO': 'ANG', 'ANG': 'ANG', 'ARS': 'KSA', 'ARL': 'ALG',
  'AZB': 'AZE', 'BIE': 'BLR', 'BKF': 'BFA', 'BOS': 'BIH', 'CAM': 'CMR', 'CAT': 'QAT',
  'CAV': 'CPV', 'CAZ': 'KAZ', 'CHP': 'CYP', 'CMA': 'CIV', 'CMJ': 'CAM', 'CNG': 'COG',
  'CON': 'COG', 'COS': 'CRC', 'CRN': 'PRK', 'CRS': 'KOR', 'CSR': 'CRC', 'DIN': 'DEN',
  'EGI': 'EGY', 'ELQ': 'SVK', 'ELS': 'SLV', 'ELV': 'SVN', 'EMI': 'UAE', 'EQU': 'ECU',
  'ESC': 'SCO', 'ESL': 'SVN', 'ESS': 'SWZ', 'ESV': 'SVK', 'ETI': 'ETH', 'EUA': 'USA',
  'FIL': 'PHI', 'GAN': 'GHA', 'GNE': 'GNQ', 'GUN': 'GUI', 'HOL': 'NED', 'IDO': 'IDN',
  'IFA': 'FRO', 'ING': 'ENG', 'IRA': 'IRQ', 'IRN': 'IRN', 'JAP': 'JPN', 'LEB': 'LBN',
  'LET': 'LVA', 'LIB': 'LBY', 'LIT': 'LTU', 'LRI': 'LBR', 'MAL': 'MYS', 'MAU': 'MTN',
  'MCD': 'MKD', 'MIA': 'MMR', 'MOC': 'MOZ', 'MOL': 'MDA', 'MON': 'MNE', 'MTA': 'MLT',
  'NCA': 'NCL', 'NIG': 'NGA', 'NOZ': 'NZL', 'NZE': 'NZL', 'PAP': 'PNG', 'PAQ': 'PAK',
  'PGA': 'WAL', 'QUE': 'KEN', 'QUI': 'KGZ', 'RDC': 'COD', 'RDG': 'DOM', 'RDO': 'DOM',
  'REP': 'CZE', 'ROM': 'ROU', 'RTC': 'CZE', 'RUA': 'RWA', 'SER': 'SRB', 'SIN': 'SGP',
  'SIR': 'SYR', 'SLK': 'SVK', 'SUD': 'SDN', 'SUE': 'SWE', 'TAI': 'THA', 'TAJ': 'TJK',
  'TAD': 'TJK', 'TCH': 'CZE', 'TTB': 'TRI', 'TTI': 'TRI', 'UBZ': 'UZB', 'UCR': 'UKR',
  'ZAM': 'ZAM', 'ZIM': 'ZIM'
};

const BRAZIL_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const VIP_MIN_RATINGS = {
  'arrascaeta': 86,
  'giorgian de arrascaeta': 86,
  'pedro': 84,
  'lucas paqueta': 85,
  'lucas paquetá': 85,
  'neymar': 88,
  'lionel messi': 92,
  'messi': 92,
  'cristiano ronaldo': 90,
  'kylian mbappe': 91,
  'mbappe': 91,
  'vinicius junior': 90,
  'vinicius jr': 90,
  'erling haaland': 90,
  'haaland': 90,
  'jude bellingham': 89,
  'bellingham': 89,
  'robert lewandowski': 88,
  'lewandowski': 88,
  'harry kane': 88,
  'kane': 88,
  'mohamed salah': 88,
  'salah': 88,
  'kevin de bruyne': 88,
  'rodri': 89,
  'lamine yamal': 88,
  'estevao': 84,
  'estêvão': 84,
  'raphael veiga': 82,
  'gustavo gomez': 82,
  'gustavo gómez': 82,
  'memphis depay': 83,
  'lucas moura': 82,
  'jonathan calleri': 81,
  'calleri': 81,
  'rodrigo garro': 82,
  'luiz henrique': 83,
  'thiago almada': 83,
  'agustin rossi': 80,
  'agustín rossi': 80,
  'hulk': 83,
  'bruno henrique': 80,
  'nicolas de la cruz': 81,
  'nicolás de la cruz': 81,
  'leo ortiz': 80,
  'léo ortiz': 80,
  'leo pereira': 78,
  'léo pereira': 78,
  'jorginho': 82,
  'saul niguez': 78,
  'saúl ñíguez': 78,
};

function normalize(s) {
  const RUIDO = /\b(fc|sc|ec|cf|ac|afc|cd|ca|club|clube|de|do|da|futebol|football|calcio)\b/g;
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(RUIDO, ' ')
    .replace(/[^a-z0-9]/g, '');
}

function extractCountryIdMap() {
  const buf = fs.readFileSync(EXE_PATH);
  const eocdPos = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdPos === -1) return {};
  
  const cdCount = buf.readUInt16LE(eocdPos + 10);
  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  
  let pos = 125440 + cdOffset;
  const files = {};
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const compMethod = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = 125440 + buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    files[name] = { compMethod, compSize, localHeaderOffset };
    pos += 46 + nameLen + extraLen + commentLen;
  }
  
  function getFile(name) {
    const f = files[name];
    if (!f) return null;
    const lhPos = f.localHeaderOffset;
    const nameLen = buf.readUInt16LE(lhPos + 26);
    const extraLen = buf.readUInt16LE(lhPos + 28);
    const dataOffset = lhPos + 30 + nameLen + extraLen;
    const compressed = buf.subarray(dataOffset, dataOffset + f.compSize);
    return f.compMethod === 8 ? zlib.inflateRawSync(compressed) : compressed;
  }
  
  function parseClass(classBuf) {
    const cpCount = classBuf.readUInt16BE(8);
    let cpOffset = 10;
    const cp = [null];
    for (let i = 1; i < cpCount; i++) {
      const tag = classBuf.readUInt8(cpOffset++);
      if (tag === 1) {
        const len = classBuf.readUInt16BE(cpOffset);
        cpOffset += 2;
        cp.push({ tag: 1, val: classBuf.toString('utf8', cpOffset, cpOffset + len) });
        cpOffset += len;
      } else if (tag === 3 || tag === 4) {
        cpOffset += 4; cp.push({ tag });
      } else if (tag === 5 || tag === 6) {
        cpOffset += 8; cp.push({ tag }); cp.push(null); i++;
      } else if (tag === 7 || tag === 8) {
        cp.push({ tag, strIndex: classBuf.readUInt16BE(cpOffset) }); cpOffset += 2;
      } else if (tag === 9 || tag === 10 || tag === 11 || tag === 12) {
        cpOffset += 4; cp.push({ tag });
      } else {
        cpOffset += 2; cp.push({ tag });
      }
    }
    return cp;
  }
  
  const acClass = getFile('best/ac.class');
  if (!acClass) return {};
  const cp = parseClass(acClass);
  
  function getString(idx) {
    const item = cp[idx];
    if (item && item.tag === 8) return cp[item.strIndex]?.val;
    return null;
  }
  
  let ip = 0;
  const countryMap = {};
  while (ip < acClass.length - 10) {
    if (acClass[ip] === 0xbb) {
      let strings = [];
      let intVal = null;
      let scanIp = ip + 3;
      while (scanIp < acClass.length && scanIp < ip + 80 && acClass[scanIp] !== 0xb3) {
        const o = acClass[scanIp];
        if (o === 0x12) {
          const s = getString(acClass[scanIp + 1]);
          if (s !== null) strings.push(s);
          scanIp += 2;
        } else if (o === 0x13) {
          const s = getString(acClass.readUInt16BE(scanIp + 1));
          if (s !== null) strings.push(s);
          scanIp += 3;
        } else if (o >= 0x02 && o <= 0x08) {
          if (intVal === null) intVal = o - 3;
          scanIp += 1;
        } else if (o === 0x10) {
          if (intVal === null) intVal = acClass.readInt8(scanIp + 1);
          scanIp += 2;
        } else if (o === 0x11) {
          if (intVal === null) intVal = acClass.readInt16BE(scanIp + 1);
          scanIp += 3;
        } else {
          scanIp += 1;
        }
      }
      if (intVal !== null && strings.length >= 3) {
        const bCode = strings[2];
        const canon = BRASFOOT_TO_CANONICAL[bCode] || bCode;
        countryMap[intVal] = canon;
      }
      ip = scanIp + 3;
    } else {
      ip += 1;
    }
  }
  return countryMap;
}

const MANUAL_SLUG_MAP = {
  'flamengo': 'flarj',
  'vasco-da-gama': 'vasco',
  'vasco': 'vasco',
  'palmeiras': 'palmeiras_bra',
  'corinthians': 'corinthians_bra',
  'sao-paulo': 'saopaulo_bra',
  'santos': 'santos_bra',
  'botafogo': 'botafogo_bra',
  'fluminense': 'fluminense_bra',
  'gremio': 'gremio_bra',
  'internacional': 'internacional_bra',
  'cruzeiro': 'cruzeiro_bra',
  'atletico-mg': 'atleticomg_bra',
  'atletico-mineiro': 'atleticomg_bra',
  'atletico-paranaense': 'atleticopr_bra',
  'atletico-goianiense': 'atleticogo_bra',
  'bahia': 'bahiaba_bra',
  'vitoria': 'vitoriaba_bra',
  'fortaleza': 'fortalezace_bra',
  'ceara': 'cearace_bra',
  'sport': 'sportpe_bra',
  'nautico': 'nauticope_bra',
  'santa-cruz': 'santacruzpe_bra',
  'coritiba': 'coritibapr_bra',
  'parana': 'paranapr_bra',
  'juventude': 'juventuders_bra',
  'criciuma': 'criciumasc_bra',
  'avai': 'avai_bra',
  'figueirense': 'figueirensesc_bra',
  'chapecoense': 'chapecoensesc_bra',
  'goias': 'goiasgo_bra',
  'vila-nova': 'vilanovago_bra',
  'cuiaba': 'cuiabamt_bra',
  'rb-bragantino': 'redbullbragantino_bra',
  'bragantino': 'redbullbragantino_bra',
  'ponte-preta': 'pontepretasp_bra',
  'guarani': 'guaranisp_bra',
  'botafogo-sp': 'botafogosp_bra',
  'novorizontino': 'novorizontinosp_bra',
  'mirassol': 'mirassolsp_bra',
  'ituano': 'ituanosp_bra',
  'operario-pr': 'operariopr_bra',
  'crb': 'crbal_bra',
  'csa': 'csaal_bra',
  'sampaio-correa': 'sampaiocorreama_bra',
  'paysandu': 'paysandupa_bra',
  'remo': 'remopa_bra',
  'londrina': 'londrinapr_bra',
  'brusque': 'brusquesc_bra',
  'amazonas': 'amazonasam_bra',
  'america-mg': 'americamg_bra',
  'volta-redonda': 'voltaredondarj_bra',
  'real-madrid': 'realmadrid_esp',
  'barcelona': 'barcelona_esp',
  'atletico-madrid': 'atleticomadrid_esp',
  'manchester-city': 'manchestercity_ing',
  'manchester-united': 'manchesterunited_ing',
  'liverpool': 'liverpool_ing',
  'chelsea': 'chelsea_ing',
  'arsenal': 'arsenal_ing',
  'tottenham': 'tottenhamhotspur_ing',
  'newcastle': 'newcastle_ing',
  'west-ham': 'westham_ing',
  'wolves': 'wolverhampton_ing',
  'everton': 'everton_ing',
  'juventus': 'juventus_it',
  'inter-milan': 'inter_it',
  'ac-milan': 'milan_it',
  'milan': 'milan_it',
  'napoli': 'napoli_it',
  'roma': 'roma_it',
  'lazio': 'lazio_it',
  'atalanta': 'atalanta_it',
  'bologna': 'bologna_it',
  'fiorentina': 'fiorentina_it',
  'como': 'como_it',
  'hellas-verona': 'verona_it',
  'bayern-munchen': 'bayerndemunique_ale',
  'borussia-dortmund': 'borussiadortmund_ale',
  'bayer-leverkusen': 'bayerleverkusen_ale',
  'rb-leipzig': 'rbleipzig_ale',
  'union-berlin': 'unionberlin_ale',
  'hamburger-sv': 'hamburgo_ale',
  'koln': 'fckoln_ale',
  'psg': 'parissaintgermain_fr',
  'marseille': 'olympique_fr',
  'lyon': 'lyon_fr',
  'monaco': 'monaco_fr',
  'benfica': 'benfica_por',
  'porto': 'porto_por',
  'sporting': 'sporting_por',
  'braga': 'braga_por',
  'ajax': 'ajax_hol',
  'feyenoord': 'feyenoord_hol',
  'psv': 'psv_hol',
  'boca-juniors': 'bocajuniors_arg',
  'river-plate': 'riverplate_arg',
  'racing': 'racing_arg',
  'independiente': 'independiente_arg',
  'san-lorenzo': 'sanlorenzo_arg',
  'villarreal': 'villareal_esp',
  'rayo-vallecano': 'rayovallecano_esp',
};

function parseBanFile(filePath, countryIdMap) {
  const buf = fs.readFileSync(filePath);
  const fileSlug = path.basename(filePath, '.ban');
  
  let xp = buf.indexOf(Buffer.from('xp'));
  if (xp === -1) return null;
  let cur = xp + 2;
  
  const paisId = buf.readInt32BE(cur);
  const estadoId = buf.readInt32BE(cur + 4);
  const nivel = buf.readInt32BE(cur + 8);
  const capacidade = buf.readInt32BE(cur + 16);
  const tecNacId = buf.readInt32BE(cur + 20);
  
  let p = cur;
  const str = [];
  while (p < buf.length - 3 && str.length < 6) {
    if (buf[p] === 0x74) {
      const len = buf.readUInt16BE(p + 1);
      str.push(buf.toString('utf8', p + 3, p + 3 + len));
      p += 3 + len;
      continue;
    }
    p++;
  }
  
  const cor1 = str[0] || '#ffffff';
  const cor2 = str[1] || '#000000';
  const code = str[2] || fileSlug;
  const clubName = str[3] || fileSlug;
  const stadium = str[4] || '';
  const manager = str[5] || '';
  const country = countryIdMap[paisId] || 'BRA';
  const state = country === 'BRA' && estadoId >= 0 && estadoId < BRAZIL_STATES.length ? BRAZIL_STATES[estadoId] : null;

  // Players ArrayList
  const players = [];
  const alPos = buf.indexOf(Buffer.from('java.util.ArrayList'));
  if (alPos !== -1) {
    const alXp = buf.indexOf(Buffer.from('xp'), alPos);
    if (alXp !== -1) {
      const listSize = buf.readInt32BE(alXp + 2);
      const egXp = buf.indexOf(Buffer.from('xp'), alXp + 6);
      if (egXp !== -1 && listSize > 0 && listSize < 100) {
        let pCur = egXp + 2;
        const posMap = { 0: 'GK', 1: 'LAT', 2: 'DEF', 3: 'MID', 4: 'ATT' };
        for (let i = 0; i < listSize; i++) {
          if (i > 0) pCur += 6;
          if (pCur + 46 > buf.length) break;
          const aid = buf.readInt32BE(pCur);
          const isEstrela = buf.readUInt8(pCur + 4) === 1;
          const pPais = buf.readInt32BE(pCur + 5);
          const pIdade = buf.readInt32BE(pCur + 9);
          const pPos = buf.readInt32BE(pCur + 13);
          const pForca = buf.readInt32BE(pCur + 17);
          const cr1 = buf.readInt32BE(pCur + 21);
          const cr2 = buf.readInt32BE(pCur + 25);
          const isTopMundial = buf.readUInt8(pCur + 37) === 1;
          pCur += 46;
          if (pCur + 3 > buf.length || buf[pCur] !== 0x74) break;
          const sLen = buf.readUInt16BE(pCur + 1);
          const pNome = buf.toString('utf8', pCur + 3, pCur + 3 + sLen);
          pCur += 3 + sLen;
          
          const nat = countryIdMap[pPais] || country;
          const position = posMap[pPos] || 'MID';
          const age = Math.min(45, Math.max(16, pIdade));
          
          players.push({
            name: pNome.trim(),
            position,
            age,
            nationality: nat,
            isEstrela,
            isTopMundial,
            cr1,
            cr2
          });
        }
      }
    }
  }

  return {
    fileSlug,
    code,
    clubName,
    stadium,
    capacidade: capacidade > 0 ? capacidade : 20000,
    manager: manager.trim(),
    paisId,
    country,
    state,
    cor1,
    cor2,
    players
  };
}

function calibrateSquad(squad, baseSkill, country) {
  const isEurope = ['ESP', 'ENG', 'ITA', 'GER', 'FRA', 'POR', 'NED', 'TUR'].includes(country);
  const maxCap = isEurope ? 92 : 87;

  // Split into GKs and Outfield
  let gks = squad.filter(p => p.position === 'GK');
  let outfield = squad.filter(p => p.position !== 'GK');

  // GUARANTEE at least 2 goalkeepers in EVERY squad
  while (gks.length < 2) {
    if (outfield.length > 15) {
      const converted = outfield.pop();
      converted.position = 'GK';
      gks.push(converted);
    } else {
      gks.push({
        name: gks.length === 0 ? 'Goleiro Titular' : 'Goleiro Reserva',
        position: 'GK',
        age: 24 + gks.length * 3,
        nationality: country,
        isEstrela: false,
        isTopMundial: false
      });
    }
  }

  function ratePlayer(p, roleTier) {
    let rating = baseSkill;
    if (roleTier === 'protagonist') rating = baseSkill + 5 + Math.floor(Math.random() * 3);
    else if (roleTier === 'starter') rating = baseSkill + Math.floor(Math.random() * 4);
    else if (roleTier === 'sub') rating = baseSkill - 2 - Math.floor(Math.random() * 4);
    else rating = baseSkill - 6 - Math.floor(Math.random() * 5);

    // VIP protection
    const norm = normalize(p.name);
    for (const [k, v] of Object.entries(VIP_MIN_RATINGS)) {
      if (norm === normalize(k) || norm.includes(normalize(k))) {
        rating = Math.max(rating, v);
        break;
      }
    }

    if (p.isEstrela && rating < 80) rating = Math.max(rating, 80);
    rating = Math.min(maxCap, Math.max(52, rating));

    const starLevel = p.isEstrela || rating >= 84 ? 'NATURAL' : 'NONE';
    const diferenciado = p.isTopMundial || p.isEstrela || rating >= 82 ? 'S' : 'NONE';

    return {
      name: p.name,
      position: p.position,
      age: p.age,
      nationality: p.nationality,
      rating,
      starLevel,
      diferenciado
    };
  }

  // Rate GKs (ensure 1st GK is protagonist/starter, 2nd is sub, 3rd is reserve)
  const ratedGks = gks.map((p, i) => ratePlayer(p, i === 0 ? 'starter' : i === 1 ? 'sub' : 'reserve'));
  ratedGks.sort((a, b) => b.rating - a.rating);

  // Rate outfield players
  // Sort by star/top status first to assign protagonist tiers
  outfield.sort((a, b) => (b.isEstrela ? 2 : b.isTopMundial ? 1 : 0) - (a.isEstrela ? 2 : a.isTopMundial ? 1 : 0));
  const ratedOutfield = outfield.map((p, i) => {
    const tier = i < 2 ? 'protagonist' : i < 9 ? 'starter' : i < 17 ? 'sub' : 'reserve';
    return ratePlayer(p, tier);
  });

  const ratedDefs = ratedOutfield.filter(p => p.position === 'DEF' || p.position === 'LAT').sort((a, b) => b.rating - a.rating);
  const ratedMids = ratedOutfield.filter(p => p.position === 'MID').sort((a, b) => b.rating - a.rating);
  const ratedAtts = ratedOutfield.filter(p => p.position === 'ATT').sort((a, b) => b.rating - a.rating);

  // RETURN SQUAD WITH GOALKEEPERS FIRST!
  return [...ratedGks, ...ratedDefs, ...ratedMids, ...ratedAtts];
}

async function main() {
  console.log('⚽ INICIANDO ATUALIZAÇÃO COMPLETA A PARTIR DE:', BRASFOOT_DIR);
  
  const countryIdMap = extractCountryIdMap();
  console.log(`✓ Mapa de países extraído: ${Object.keys(countryIdMap).length} países.`);

  // 1. Parse all .ban files
  console.log('✓ Carregando e processando 2.000+ arquivos .ban de clubes...');
  const banFiles = fs.readdirSync(TEAMS_DIR).filter(f => f.endsWith('.ban'));
  const banClubs = new Map();
  for (const f of banFiles) {
    try {
      const parsed = parseBanFile(path.join(TEAMS_DIR, f), countryIdMap);
      if (parsed) banClubs.set(parsed.fileSlug, parsed);
    } catch (e) {}
  }
  console.log(`✓ Total de clubes parseados da pasta teams: ${banClubs.size}`);

  // Build secondary indexes
  const byCode = new Map([...banClubs.values()].map(b => [b.code, b]));
  const byNormName = new Map();
  const byCountry = new Map();
  for (const b of banClubs.values()) {
    const n = normalize(b.clubName);
    if (!byNormName.has(n)) byNormName.set(n, []);
    byNormName.get(n).push(b);
    if (!byCountry.has(b.country)) byCountry.set(b.country, []);
    byCountry.get(b.country).push(b);
  }

  // 2. Read existing content/clubs.csv
  const clubsCsvLines = fs.readFileSync(CLUBS_CSV_PATH, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const existingClubs = [];
  const existingSlugs = new Set();
  for (let i = 1; i < clubsCsvLines.length; i++) {
    const parts = clubsCsvLines[i].split(',');
    existingClubs.push({
      slug: parts[0],
      name: parts[1],
      country: parts[2],
      division: parts[3],
      capacity: Number(parts[4]) || 20000,
      skillLevel: Number(parts[5]) || 70,
      state: parts[6] || null
    });
    existingSlugs.add(parts[0]);
  }
  console.log(`✓ Clubes existentes no jogo: ${existingClubs.length}`);

  const countryCounts = new Map();
  for (const c of existingClubs) {
    countryCounts.set(c.country, (countryCounts.get(c.country) || 0) + 1);
  }
  const playableCountries = new Set(
    [...countryCounts.entries()].filter(([_, count]) => count >= 10).map(([c]) => c)
  );
  console.log(`✓ Países com liga estruturada (>= 10 clubes): ${playableCountries.size}`);

  // Match existing clubs to .ban
  const clubToBan = new Map();
  const banToClub = new Map();

  for (const c of existingClubs) {
    let ban = null;
    const manualSlug = MANUAL_SLUG_MAP[c.slug];
    if (manualSlug && banClubs.has(manualSlug)) {
      ban = banClubs.get(manualSlug);
    } else if (banClubs.has(c.slug)) {
      ban = banClubs.get(c.slug);
    } else if (byCode.has(c.slug)) {
      ban = byCode.get(c.slug);
    } else {
      const norm = normalize(c.name);
      const inCountry = byCountry.get(c.country) || [];
      const exact = inCountry.filter(b => normalize(b.clubName) === norm);
      if (exact.length === 1) {
        ban = exact[0];
      } else {
        const cont = inCountry.filter(b => normalize(b.clubName).includes(norm) || norm.includes(normalize(b.clubName)));
        if (cont.length === 1) ban = cont[0];
      }
    }
    if (ban) {
      clubToBan.set(c.slug, ban);
      banToClub.set(ban.fileSlug, c.slug);
    }
  }
  console.log(`✓ Clubes existentes casados com a base Brasfoot: ${clubToBan.size}`);

  // 3. Update / Append clubs in clubs.csv
  const updatedClubsList = [];
  for (const c of existingClubs) {
    const ban = clubToBan.get(c.slug);
    if (ban) {
      c.capacity = ban.capacidade || c.capacity;
      if (ban.state && !c.state) c.state = ban.state;
    }
    updatedClubsList.push(c);
  }

  // Append any new clubs from Brasfoot that don't exist yet (apenas países com ligas jogáveis)
  let appendedClubs = 0;
  for (const ban of banClubs.values()) {
    if (banToClub.has(ban.fileSlug)) continue;
    if (!playableCountries.has(ban.country)) continue;
    // New club!
    const slug = ban.fileSlug.replace(/_/g, '-');
    if (existingSlugs.has(slug)) continue;
    existingSlugs.add(slug);
    banToClub.set(ban.fileSlug, slug);
    clubToBan.set(slug, ban);

    const isTopCountry = ['BRA', 'ENG', 'ESP', 'ITA', 'GER', 'FRA', 'POR', 'ARG'].includes(ban.country);
    const skillLevel = isTopCountry ? 68 : 62;

    updatedClubsList.push({
      slug,
      name: ban.clubName,
      country: ban.country,
      division: '5',
      capacity: ban.capacidade || 20000,
      skillLevel,
      state: ban.state
    });
    appendedClubs++;
  }
  console.log(`✓ Novos clubes adicionados ao catálogo: ${appendedClubs}. Total agora: ${updatedClubsList.length}`);

  // Write updated clubs.csv
  const clubsOutputLines = ['slug,name,country,division,stadium_capacity,skill_level,state'];
  for (const c of updatedClubsList) {
    clubsOutputLines.push(`${c.slug},${c.name},${c.country},${c.division},${c.capacity},${c.skillLevel},${c.state || ''}`);
  }
  fs.writeFileSync(CLUBS_CSV_PATH, clubsOutputLines.join('\n'), 'utf8');
  console.log(`✓ content/clubs.csv regravado com sucesso.`);

  // 4. Build content/managers.csv
  console.log('✓ Atualizando content/managers.csv com os técnicos reais...');
  const managersOutputLines = ['club_slug,manager_name,stadium_name,stadium_capacity'];
  for (const c of updatedClubsList) {
    const ban = clubToBan.get(c.slug);
    const mgr = ban && ban.manager ? ban.manager : '';
    const std = ban && ban.stadium ? ban.stadium : '';
    const cap = ban && ban.capacidade ? ban.capacidade : c.capacity;
    managersOutputLines.push(`${c.slug},${mgr},${std},${cap}`);
  }
  fs.writeFileSync(MANAGERS_CSV_PATH, managersOutputLines.join('\n'), 'utf8');
  console.log(`✓ content/managers.csv regravado com sucesso.`);

  // 5. Build content/kits.json
  console.log('✓ Atualizando content/kits.json com as cores oficiais de cada clube...');
  let kits = {};
  if (fs.existsSync(KITS_JSON_PATH)) {
    try { kits = JSON.parse(fs.readFileSync(KITS_JSON_PATH, 'utf8')); } catch (e) {}
  }
  for (const c of updatedClubsList) {
    const ban = clubToBan.get(c.slug);
    if (ban && ban.cor1 && ban.cor2) {
      kits[c.slug] = {
        primary: ban.cor1,
        secondary: ban.cor2,
        accent: ban.cor1
      };
    }
  }
  fs.writeFileSync(KITS_JSON_PATH, JSON.stringify(kits, null, 2), 'utf8');
  console.log(`✓ content/kits.json atualizado com ${Object.keys(kits).length} clubes.`);

  // 6. Build content/players.csv
  console.log('✓ Atualizando content/players.csv com elencos reais, calibrados e com goleiros prioritários...');
  const playersOutputLines = [
    'club_slug,name,position,age,nationality,rating,star_level,diferenciado'
  ];

  let totalPlayersCount = 0;
  for (const c of updatedClubsList) {
    const ban = clubToBan.get(c.slug);
    if (!ban || !ban.players || ban.players.length === 0) continue;

    const calibrated = calibrateSquad(ban.players, c.skillLevel, c.country);
    for (const p of calibrated) {
      playersOutputLines.push(
        `${c.slug},${p.name},${p.position},${p.age},${p.nationality},${p.rating},${p.starLevel},${p.diferenciado}`
      );
      totalPlayersCount++;
    }
  }
  fs.writeFileSync(PLAYERS_CSV_PATH, playersOutputLines.join('\n'), 'utf8');
  console.log(`✓ content/players.csv gerado com ${totalPlayersCount} jogadores em ${updatedClubsList.length} clubes.`);

  // 7. Copy Escudos (Crests)
  console.log('✓ Copiando e vinculando escudos (crests)...');
  const bfEscudosDir = path.join(TEAMS_DIR, 'escudos');
  if (fs.existsSync(bfEscudosDir)) {
    const escudos = fs.readdirSync(bfEscudosDir).filter(f => f.endsWith('.png'));
    let copiedCrests = 0;
    for (const f of escudos) {
      const src = path.join(bfEscudosDir, f);
      const dest = path.join(CRESTS_DIR, f);
      fs.copyFileSync(src, dest);
      copiedCrests++;

      // Also copy to canonical club slug if mapped
      const fileSlug = path.basename(f, '.png');
      const canonSlug = banToClub.get(fileSlug);
      if (canonSlug && canonSlug !== fileSlug) {
        fs.copyFileSync(src, path.join(CRESTS_DIR, `${canonSlug}.png`));
      }
    }
    console.log(`✓ ${copiedCrests} escudos sincronizados para content/crests/.`);
  }

  // 8. Copy Camisas (Jerseys)
  console.log('✓ Copiando e vinculando camisas (jerseys)...');
  const camisasDirs = [
    { srcDir: path.join(TEAMS_DIR, 'camisas'), suffix: '' },
    { srcDir: path.join(TEAMS_DIR, 'camisas2'), suffix: '_away' },
    { srcDir: path.join(TEAMS_DIR, 'camisas3'), suffix: '_third' }
  ];
  let copiedJerseys = 0;
  for (const { srcDir, suffix } of camisasDirs) {
    if (fs.existsSync(srcDir)) {
      for (const f of fs.readdirSync(srcDir).filter(f => f.endsWith('.png'))) {
        const src = path.join(srcDir, f);
        const fileSlug = path.basename(f, '.png');
        const destName = `${fileSlug}${suffix}.png`;
        fs.copyFileSync(src, path.join(JERSEYS_DIR, destName));
        copiedJerseys++;

        const canonSlug = banToClub.get(fileSlug);
        if (canonSlug && canonSlug !== fileSlug) {
          fs.copyFileSync(src, path.join(JERSEYS_DIR, `${canonSlug}${suffix}.png`));
        }
      }
    }
  }
  console.log(`✓ ${copiedJerseys} camisas sincronizadas para content/jerseys/.`);

  // 9. Copy Troféus (Trophies)
  console.log('✓ Copiando troféus...');
  const bfTrofeusDir = path.join(BRASFOOT_DIR, 'trofeus');
  if (fs.existsSync(bfTrofeusDir)) {
    let copiedTrophies = 0;
    for (const f of fs.readdirSync(bfTrofeusDir).filter(f => f.endsWith('.png'))) {
      fs.copyFileSync(path.join(bfTrofeusDir, f), path.join(TROPHIES_DIR, f));
      copiedTrophies++;
    }
    console.log(`✓ ${copiedTrophies} troféus sincronizados para content/trophies/.`);
  }

  // 10. Copy Seleções (National Jerseys)
  console.log('✓ Copiando camisas de seleções...');
  const bfSelCamisas = path.join(BRASFOOT_DIR, 'selecoes', 'camisas');
  if (fs.existsSync(bfSelCamisas)) {
    let copiedSel = 0;
    for (const f of fs.readdirSync(bfSelCamisas).filter(f => f.endsWith('.png'))) {
      fs.copyFileSync(path.join(bfSelCamisas, f), path.join(NATIONAL_JERSEYS_DIR, f));
      copiedSel++;
    }
    console.log(`✓ ${copiedSel} camisas de seleções sincronizadas para content/national-jerseys/.`);
  }

  console.log('🎉 SINCRONIZAÇÃO COMPLETA DO BRASFOOT 22-23 CONCLUÍDA COM SUCESSO!');
}

main().catch(err => {
  console.error('ERRO FATAL NA SINCRONIZAÇÃO:', err);
  process.exit(1);
});
