import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const BRASFOOT_DIR = 'D:\\Games\\Brasfoot EFL';
const TEAMS_DIR = path.join(BRASFOOT_DIR, 'teams');
const EXE_PATH = path.join(BRASFOOT_DIR, 'Brasfoot 2026 - EBL MOD.exe');
const PLAYERS_CSV_PATH = path.resolve('content/players.csv');
const WEB_PLAYERS_CSV_PATH = path.resolve('packages/web/public/players.csv');

const BRASFOOT_TO_CANONICAL = {
  'AFS': 'RSA',
  'ALE': 'GER',
  'AGO': 'ANG',
  'ANG': 'ANG',
  'ARS': 'KSA',
  'ARL': 'ALG',
  'AZB': 'AZE',
  'BIE': 'BLR',
  'BKF': 'BFA',
  'BOS': 'BIH',
  'CAM': 'CMR',
  'CAT': 'QAT',
  'CAV': 'CPV',
  'CAZ': 'KAZ',
  'CHP': 'CYP',
  'CMA': 'CIV',
  'CMJ': 'CAM',
  'CNG': 'COG',
  'CON': 'COG',
  'COS': 'CRC',
  'CRN': 'PRK',
  'CRS': 'KOR',
  'CSR': 'CRC',
  'DIN': 'DEN',
  'EGI': 'EGY',
  'ELQ': 'SVK',
  'ELS': 'SLV',
  'ELV': 'SVN',
  'EMI': 'UAE',
  'EQU': 'ECU',
  'ESC': 'SCO',
  'ESL': 'SVN',
  'ESS': 'SWZ',
  'ESV': 'SVK',
  'ETI': 'ETH',
  'EUA': 'USA',
  'FIL': 'PHI',
  'GAN': 'GHA',
  'GNE': 'GNQ',
  'GUN': 'GUI',
  'HOL': 'NED',
  'IDO': 'IDN',
  'IFA': 'FRO',
  'ING': 'ENG',
  'IRA': 'IRQ',
  'IRN': 'IRN',
  'JAP': 'JPN',
  'LEB': 'LBN',
  'LET': 'LVA',
  'LIB': 'LBY',
  'LIT': 'LTU',
  'LRI': 'LBR',
  'MAL': 'MYS',
  'MAU': 'MTN',
  'MCD': 'MKD',
  'MIA': 'MMR',
  'MOC': 'MOZ',
  'MOL': 'MDA',
  'MON': 'MNE',
  'MTA': 'MLT',
  'NCA': 'NCL',
  'NIG': 'NGA',
  'NOZ': 'NZL',
  'NZE': 'NZL',
  'PAP': 'PNG',
  'PAQ': 'PAK',
  'PGA': 'WAL',
  'QUE': 'KEN',
  'QUI': 'KGZ',
  'RDC': 'COD',
  'RDG': 'DOM',
  'RDO': 'DOM',
  'REP': 'CZE',
  'ROM': 'ROU',
  'RTC': 'CZE',
  'RUA': 'RWA',
  'SER': 'SRB',
  'SIN': 'SGP',
  'SIR': 'SYR',
  'SLK': 'SVK',
  'SUD': 'SDN',
  'SUE': 'SWE',
  'TAI': 'THA',
  'TAJ': 'TJK',
  'TAD': 'TJK',
  'TCH': 'CZE',
  'TTB': 'TRI',
  'TTI': 'TRI',
  'UBZ': 'UZB',
  'UCR': 'UKR',
  'ZAM': 'ZAM',
  'ZIM': 'ZIM'
};

const FOREIGN_POS_MAP = {
  'GK': 'GK',
  'DF': 'DEF',
  'MF': 'MID',
  'FW': 'ATT',
  'DEF': 'DEF',
  'LAT': 'LAT',
  'MID': 'MID',
  'ATT': 'ATT'
};

function extractCountryIdMap() {
  if (!fs.existsSync(EXE_PATH)) return {};
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
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = 125440 + buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    files[name] = { compMethod, compSize, uncompSize, localHeaderOffset };
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
      } else if (tag === 3) {
        cp.push({ tag: 3, val: classBuf.readInt32BE(cpOffset) });
        cpOffset += 4;
      } else if (tag === 4) {
        cp.push({ tag: 4, val: classBuf.readFloatBE(cpOffset) });
        cpOffset += 4;
      } else if (tag === 5) {
        cp.push({ tag: 5, val: classBuf.readBigInt64BE(cpOffset) });
        cpOffset += 8;
        cp.push(null);
        i++;
      } else if (tag === 6) {
        cp.push({ tag: 6, val: classBuf.readDoubleBE(cpOffset) });
        cpOffset += 8;
        cp.push(null);
        i++;
      } else if (tag === 7) {
        cp.push({ tag: 7, nameIndex: classBuf.readUInt16BE(cpOffset) });
        cpOffset += 2;
      } else if (tag === 8) {
        cp.push({ tag: 8, strIndex: classBuf.readUInt16BE(cpOffset) });
        cpOffset += 2;
      } else if (tag === 9 || tag === 10 || tag === 11) {
        cp.push({ tag, classIndex: classBuf.readUInt16BE(cpOffset), ntIndex: classBuf.readUInt16BE(cpOffset + 2) });
        cpOffset += 4;
      } else if (tag === 12) {
        cp.push({ tag: 12, nameIndex: classBuf.readUInt16BE(cpOffset), descIndex: classBuf.readUInt16BE(cpOffset + 2) });
        cpOffset += 4;
      } else if (tag === 15) {
        cpOffset += 3;
        cp.push({ tag: 15 });
      } else if (tag === 16 || tag === 19 || tag === 20) {
        cpOffset += 2;
        cp.push({ tag });
      } else if (tag === 17 || tag === 18) {
        cpOffset += 4;
        cp.push({ tag });
      }
    }
    return cp;
  }
  
  const acClass = getFile('best/ac.class');
  if (!acClass) return {};
  const cp = parseClass(acClass);
  
  function getString(idx) {
    const item = cp[idx];
    if (item && item.tag === 8) {
      return cp[item.strIndex]?.val;
    }
    return null;
  }
  
  let ip = 0;
  const countryMap = {};
  while (ip < acClass.length - 10) {
    if (acClass[ip] === 0xbb) {
      let strings = [];
      let intVal = null;
      let scanIp = ip + 3;
      while (scanIp < acClass.length && acClass[scanIp] !== 0xb3) {
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

function parseBanFile(filePath, countryIdMap) {
  const buf = fs.readFileSync(filePath);
  const baseName = path.basename(filePath, '.ban');
  
  let clubName = '';
  let pos = 0;
  const headerStrings = [];
  while (pos < Math.min(buf.length, 500)) {
    if (buf[pos] === 0x74) {
      const len = buf.readUInt16BE(pos + 1);
      if (pos + 3 + len <= buf.length) {
        const str = buf.toString('utf8', pos + 3, pos + 3 + len);
        if (str && !str.startsWith('Ljava') && !str.startsWith('#') && str !== baseName) {
          headerStrings.push(str);
        }
        pos += 3 + len;
        continue;
      }
    }
    pos++;
  }
  if (headerStrings.length > 0) clubName = headerStrings[0];

  const players = [];
  let scanPos = 300;
  while (scanPos < buf.length - 45) {
    if (buf[scanPos] === 0x73 && buf[scanPos + 1] === 0x71) {
      let pOffset = scanPos + 6;
      if (pOffset + 46 > buf.length) break;
      const countryId = buf.readInt32BE(pOffset + 5);
      const age = buf.readInt32BE(pOffset + 9);
      const posCode = buf.readInt32BE(pOffset + 13);
      
      let strOffset = pOffset + 46;
      if (strOffset + 3 <= buf.length && buf[strOffset] === 0x74) {
        const sLen = buf.readUInt16BE(strOffset + 1);
        if (strOffset + 3 + sLen <= buf.length) {
          const name = buf.toString('utf8', strOffset + 3, strOffset + 3 + sLen);
          const nationality = countryIdMap[countryId] || 'BRA';
          const posMap = { 0: 'GK', 1: 'LAT', 2: 'DEF', 3: 'MID', 4: 'ATT' };
          players.push({
            name: name.trim(),
            nationality,
            countryId,
            age,
            position: posMap[posCode] || 'MID',
            posCode,
            clubFile: baseName,
            clubName
          });
          scanPos = strOffset + 3 + sLen;
          continue;
        }
      }
    }
    scanPos++;
  }
  return { clubFile: baseName, clubName, players };
}

function normalize(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["'\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out;
}

function formatCsvField(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log('--- Rebuilding Unified Canonical players.csv ---');
  const countryIdMap = extractCountryIdMap();
  console.log(`Country Enum entries loaded: ${Object.keys(countryIdMap).length}`);
  
  const banFiles = fs.readdirSync(TEAMS_DIR).filter(f => f.endsWith('.ban'));
  console.log(`Indexing ${banFiles.length} .ban team files...`);
  
  const playerByClubAndName = new Map();
  const playerByExactName = new Map();
  const playerByNormName = new Map();
  
  for (const file of banFiles) {
    const filePath = path.join(TEAMS_DIR, file);
    try {
      const { clubFile, clubName, players } = parseBanFile(filePath, countryIdMap);
      for (const p of players) {
        const normName = normalize(p.name);
        const normFile = normalize(clubFile);
        const normClub = normalize(clubName);
        
        playerByClubAndName.set(`${normFile}:::${normName}`, p);
        if (normClub) playerByClubAndName.set(`${normClub}:::${normName}`, p);
        
        playerByExactName.set(p.name.trim(), p);
        
        if (!playerByNormName.has(normName)) playerByNormName.set(normName, []);
        playerByNormName.get(normName).push(p);
      }
    } catch (e) {}
  }
  
  // Also index clubs.csv to know each club's home country
  const clubsCsvPath = path.resolve('packages/web/public/clubs.csv');
  const clubCountryBySlug = new Map();
  if (fs.existsSync(clubsCsvPath)) {
    const clubLines = fs.readFileSync(clubsCsvPath, 'utf8').split('\n').slice(1);
    for (const l of clubLines) {
      if (!l.trim()) continue;
      const c = splitCsvLine(l);
      if (c[0] && c[2]) clubCountryBySlug.set(c[0].trim(), c[2].trim());
    }
  }
  
  const rawCsv = fs.readFileSync(PLAYERS_CSV_PATH, 'utf8');
  const lines = rawCsv.split('\n');
  
  const outputRows = [
    'club_slug,name,position,age,nationality,rating,star_level,diferenciado'
  ];
  
  let layoutACount = 0;
  let layoutBCount = 0;
  let matchedBrasfoot = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvLine(line).map(c => c.replace(/^"|"$/g, '').trim());
    if (cells.length < 4) continue;
    
    const clubSlug = cells[0];
    const playerName = cells[1];
    const clubHomeCountry = clubCountryBySlug.get(clubSlug) || 'BRA';
    
    let position = 'MID';
    let age = 25;
    let nationality = clubHomeCountry;
    let rating = 65;
    let starLevel = 'NONE';
    let diferenciado = 'NONE';
    
    const isLayoutA = !/^\d+$/.test(cells[2]) && /^\d+$/.test(cells[3]);
    const isLayoutB = !isLayoutA;
    
    if (isLayoutA) {
      layoutACount++;
      position = FOREIGN_POS_MAP[cells[2]?.toUpperCase()] || 'MID';
      age = Number(cells[3]) || 25;
      nationality = cells[4] || clubHomeCountry;
      rating = Number(cells[5]) || 65;
      starLevel = cells[6] || 'NONE';
      diferenciado = cells[7] || 'NONE';
    } else {
      layoutBCount++;
      age = Number(cells[2]) || 25;
      position = FOREIGN_POS_MAP[cells[3]?.toUpperCase()] || 'MID';
      // In layout B, rating was in cells[4] if numeric, or if cells[4] was nationality, let's parse:
      if (/^\d+$/.test(cells[4])) {
        rating = Number(cells[4]);
      } else {
        nationality = cells[4] || clubHomeCountry;
        rating = Number(cells[5]) || 60;
      }
      starLevel = cells[5] === '1' ? 'NATURAL' : (cells[5] || 'NONE');
      diferenciado = cells[6] === '1' ? 'S' : (cells[6] || 'NONE');
    }
    
    // Check against Brasfoot player index
    const normPlayer = normalize(playerName);
    const normClub = normalize(clubSlug);
    
    let matched = playerByClubAndName.get(`${normClub}:::${normPlayer}`) ||
                  playerByClubAndName.get(`${normClub.replace(/\s+/g, '')}:::${normPlayer}`) ||
                  playerByExactName.get(playerName);
                  
    if (!matched && playerByNormName.has(normPlayer)) {
      const list = playerByNormName.get(normPlayer);
      if (list.length === 1) matched = list[0];
      else {
        matched = list.find(p => p.position === position) || list[0];
      }
    }
    
    if (matched) {
      matchedBrasfoot++;
      nationality = matched.nationality;
      if (isLayoutB && matched.position) {
        position = matched.position;
      }
    }
    
    // Ensure valid age and rating
    if (age < 15 || age > 45) age = 25;
    if (rating < 1 || rating > 99) rating = 65;
    
    outputRows.push([
      formatCsvField(clubSlug),
      formatCsvField(playerName),
      formatCsvField(position),
      formatCsvField(age),
      formatCsvField(nationality),
      formatCsvField(rating),
      formatCsvField(starLevel),
      formatCsvField(diferenciado)
    ].join(','));
  }
  
  console.log(`\nRebuild Summary:`);
  console.log(`- Layout A Rows: ${layoutACount}`);
  console.log(`- Layout B Rows: ${layoutBCount}`);
  console.log(`- Total Normalized Rows: ${outputRows.length - 1}`);
  console.log(`- Matched & Enhanced with Brasfoot Nationalities: ${matchedBrasfoot}`);
  
  const content = outputRows.join('\n');
  fs.writeFileSync(PLAYERS_CSV_PATH, content, 'utf8');
  console.log(`Saved clean canonical CSV to: ${PLAYERS_CSV_PATH}`);
  
  fs.writeFileSync(WEB_PLAYERS_CSV_PATH, content, 'utf8');
  console.log(`Saved clean canonical CSV to: ${WEB_PLAYERS_CSV_PATH}`);
}

main().catch(err => {
  console.error('Error rebuilding players.csv:', err);
  process.exit(1);
});
