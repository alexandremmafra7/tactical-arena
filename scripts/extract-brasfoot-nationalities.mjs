import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const BRASFOOT_DIR = 'D:\\Games\\Brasfoot EFL';
const TEAMS_DIR = path.join(BRASFOOT_DIR, 'teams');
const EXE_PATH = path.join(BRASFOOT_DIR, 'Brasfoot 2026 - EBL MOD.exe');
const PLAYERS_CSV_PATH = path.resolve('content/players.csv');
const WEB_PLAYERS_CSV_PATH = path.resolve('packages/web/public/players.csv');

// Mapping from Brasfoot 3-letter country codes to Canonical ISO-3 codes used in TacticalArenaFC
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

function extractCountryIdMap() {
  if (!fs.existsSync(EXE_PATH)) {
    console.warn('Exe path not found:', EXE_PATH);
    return {};
  }
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
  if (headerStrings.length > 0) {
    clubName = headerStrings[0];
  }

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
          players.push({
            name: name.trim(),
            nationality,
            countryId,
            age,
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

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function formatCsvField(val) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

async function main() {
  console.log('--- Brasfoot EFL Nationality Extractor ---');
  const countryIdMap = extractCountryIdMap();
  console.log(`Extracted ${Object.keys(countryIdMap).length} country codes from Brasfoot.`);
  
  if (!fs.existsSync(TEAMS_DIR)) {
    console.error('Teams directory not found at:', TEAMS_DIR);
    return;
  }
  
  const banFiles = fs.readdirSync(TEAMS_DIR).filter(f => f.endsWith('.ban'));
  console.log(`Scanning ${banFiles.length} team files in ${TEAMS_DIR}...`);
  
  const playerByClubAndName = new Map();
  const playerByExactName = new Map();
  const playerByNormName = new Map();
  let totalBrasfootPlayers = 0;
  
  for (const file of banFiles) {
    const filePath = path.join(TEAMS_DIR, file);
    try {
      const { clubFile, clubName, players } = parseBanFile(filePath, countryIdMap);
      for (const p of players) {
        totalBrasfootPlayers++;
        const normName = normalize(p.name);
        const normFile = normalize(clubFile);
        const normClub = normalize(clubName);
        
        // Club + Player match
        playerByClubAndName.set(`${normFile}:::${normName}`, p);
        if (normClub) {
          playerByClubAndName.set(`${normClub}:::${normName}`, p);
        }
        
        // Exact raw name
        playerByExactName.set(p.name.trim(), p);
        
        // Norm name list
        if (!playerByNormName.has(normName)) {
          playerByNormName.set(normName, []);
        }
        playerByNormName.get(normName).push(p);
      }
    } catch (e) {}
  }
  console.log(`Total Brasfoot Players indexed: ${totalBrasfootPlayers}`);
  
  // Read content/players.csv
  const rawCsv = fs.readFileSync(PLAYERS_CSV_PATH, 'utf8');
  const lines = rawCsv.split('\n');
  const header = lines[0];
  
  let matchedCount = 0;
  let updatedCount = 0;
  const sampleChanges = [];
  const updatedLines = [header];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      updatedLines.push(line);
      continue;
    }
    const parts = parseCsvLine(line);
    if (parts.length < 5) {
      updatedLines.push(line);
      continue;
    }
    
    const clubSlug = parts[0];
    const cleanPlayerName = parts[1].replace(/^"|"$/g, '').trim();
    const currentNat = parts[4].replace(/^"|"$/g, '').trim();
    
    const normPlayer = normalize(cleanPlayerName);
    const normClub = normalize(clubSlug);
    
    // Multi-tier matching
    let matched = playerByClubAndName.get(`${normClub}:::${normPlayer}`) ||
                  playerByClubAndName.get(`${normClub.replace(/\s+/g, '')}:::${normPlayer}`) ||
                  playerByExactName.get(cleanPlayerName);
                  
    if (!matched && playerByNormName.has(normPlayer)) {
      const candidates = playerByNormName.get(normPlayer);
      if (candidates.length === 1) {
        matched = candidates[0];
      } else {
        // Find closest candidate by club name or position
        const posCodeMap = { 'GK': 0, 'LAT': 1, 'DEF': 2, 'MID': 3, 'ATT': 4 };
        const csvPos = posCodeMap[parts[2]] ?? -1;
        const posMatch = candidates.find(c => c.posCode === csvPos);
        matched = posMatch || candidates[0];
      }
    }
    
    let newNat = currentNat;
    if (matched) {
      matchedCount++;
      newNat = matched.nationality;
      if (newNat !== currentNat) {
        updatedCount++;
        if (sampleChanges.length < 35) {
          sampleChanges.push({
            club: clubSlug,
            player: cleanPlayerName,
            from: currentNat,
            to: newNat
          });
        }
      }
    }
    
    // Reconstruct CSV line properly
    parts[4] = newNat;
    const formattedLine = parts.map(formatCsvField).join(',');
    updatedLines.push(formattedLine);
  }
  
  console.log(`\nResults:`);
  console.log(`- Total CSV Players: ${lines.length - 1}`);
  console.log(`- Matched against Brasfoot: ${matchedCount}`);
  console.log(`- Nationalities Updated: ${updatedCount}`);
  
  console.log('\nSample Nationality Updates:');
  sampleChanges.forEach(c => {
    console.log(`  [${c.club}] ${c.player}: ${c.from} -> ${c.to}`);
  });
  
  const newCsvContent = updatedLines.join('\n');
  fs.writeFileSync(PLAYERS_CSV_PATH, newCsvContent, 'utf8');
  console.log(`\nSaved updated content to ${PLAYERS_CSV_PATH}`);
  
  if (fs.existsSync(path.dirname(WEB_PLAYERS_CSV_PATH))) {
    fs.writeFileSync(WEB_PLAYERS_CSV_PATH, newCsvContent, 'utf8');
    console.log(`Saved updated content to ${WEB_PLAYERS_CSV_PATH}`);
  }
}

main().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
