import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptDir = path.resolve(__dirname, '..');
const contentDir = path.join(scriptDir, 'content');
const clubsPath = path.join(contentDir, 'clubs.csv');
const playersPath = path.join(contentDir, 'players.csv');

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

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitCsvLine(line);
    rows.push(cells);
  }
  return { header, rows };
}

const VIP_MIN_RATINGS = {
  'jorginho': 82,
  'saúl ñíguez': 78,
  'saul niguez': 78,
  'giorgian de arrascaeta': 85,
  'arrascaeta': 85,
  'lucas paquetá': 84,
  'lucas paqueta': 84,
  'pedro': 83,
  'hulk': 83,
  'neymar': 88,
  'lionel messi': 92,
  'cristiano ronaldo': 90,
  'kylian mbappe': 91,
  'vinicius junior': 90,
  'erling haaland': 90,
  'jude bellingham': 89,
  'raphinha': 86,
  'lamine yamal': 88,
  'robert lewandowski': 88,
  'harry kane': 88,
  'mohamed salah': 88,
  'kevin de bruyne': 88,
  'rodri': 89,
  'estêvão': 84,
  'estevao': 84,
  'raphael veiga': 82,
  'gustavo gómez': 81,
  'gustavo gomez': 81,
  'memphis depay': 83,
  'lucas moura': 82,
  'jonathan calleri': 81,
  'rodrigo garro': 82,
  'luiz henrique': 83,
  'thiago almada': 83,
  'philippe coutinho': 81,
  'dimitri payet': 81,
  'alan patrick': 82,
};

function isVip(name) {
  if (!name) return 0;
  const norm = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  for (const [key, minR] of Object.entries(VIP_MIN_RATINGS)) {
    if (norm === key || norm.includes(key)) return minR;
  }
  return 0;
}

function calibrateWorld() {
  console.log('🌍 Iniciando recalibragem global de jogadores baseada na reputação dos clubes...');

  if (!fs.existsSync(clubsPath) || !fs.existsSync(playersPath)) {
    console.error('❌ Arquivos clubs.csv ou players.csv não encontrados em content/');
    process.exit(1);
  }

  const clubsText = fs.readFileSync(clubsPath, 'utf8');
  const playersText = fs.readFileSync(playersPath, 'utf8');

  const clubsParsed = parseCsv(clubsText);
  const clubMap = new Map();
  // slug,name,country,division,stadium_capacity,skill_level
  for (const row of clubsParsed.rows) {
    const slug = row[0];
    const country = row[2];
    const skillLevel = Number(row[5]) || (country === 'BRA' ? 70 : country === 'ESP' || country === 'ENG' || country === 'ITA' || country === 'GER' ? 80 : 72);
    clubMap.set(slug, { skillLevel, country });
  }

  const playersParsed = parseCsv(playersText);
  // club_slug,name,position,age,nationality,rating,star_level,diferenciado
  const clubPlayers = new Map();

  for (const row of playersParsed.rows) {
    const clubSlug = row[0];
    if (!clubPlayers.has(clubSlug)) clubPlayers.set(clubSlug, []);
    clubPlayers.get(clubSlug).push({
      row,
      name: row[1],
      position: row[2],
      age: Number(row[3]) || 25,
      nationality: row[4],
      rating: Number(row[5]) || 70,
      starLevel: row[6] || 'NONE',
      diferenciado: row[7] || 'NONE',
    });
  }

  const newRows = [];

  for (const [clubSlug, squad] of clubPlayers.entries()) {
    const clubInfo = clubMap.get(clubSlug) || { skillLevel: 70, country: 'BRA' };
    const baseSkill = clubInfo.skillLevel;
    const isEurope = ['ESP', 'ENG', 'ITA', 'GER', 'FRA'].includes(clubInfo.country);
    const maxCap = isEurope ? 92 : 87;

    // Ordenar elenco por relevância (rating atual descendente, starLevel, diferenciado, idade)
    squad.sort((a, b) => {
      const aVip = isVip(a.name) > 0 ? 1 : 0;
      const bVip = isVip(b.name) > 0 ? 1 : 0;
      if (aVip !== bVip) return bVip - aVip;
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (a.starLevel !== 'NONE' && b.starLevel === 'NONE') return -1;
      if (b.starLevel !== 'NONE' && a.starLevel === 'NONE') return 1;
      return b.age - a.age;
    });

    const total = squad.length;
    // Pirâmide:
    // Top 10-15% (2 a 3 jogadores): Protagonistas (skill + 4 a + 7)
    // Próximos 8 jogadores: Espinha Dorsal (skill + 0 a + 3)
    // Próximos 7-9 jogadores: Reservas Imediatos (skill - 2 a - 5)
    // Restante: Jovens / Elenco (skill - 6 a - 10)

    const countProtagonists = Math.max(2, Math.min(3, Math.round(total * 0.12)));
    const countStarters = Math.min(8, Math.max(5, total - countProtagonists - 5));

    squad.forEach((player, idx) => {
      let targetRating = baseSkill;
      if (idx < countProtagonists) {
        targetRating = baseSkill + 5 + (countProtagonists - idx);
      } else if (idx < countProtagonists + countStarters) {
        targetRating = baseSkill + Math.floor(Math.random() * 4); // 0 a +3
      } else if (idx < countProtagonists + countStarters + 8) {
        targetRating = baseSkill - 2 - Math.floor(Math.random() * 4); // -2 a -5
      } else {
        targetRating = baseSkill - 6 - Math.floor(Math.random() * 5); // -6 a -10
      }

      // Proteger VIPs / Estrelas Internacionais
      const vipMin = isVip(player.name);
      if (vipMin > 0) {
        targetRating = Math.max(targetRating, vipMin);
      }

      if (player.starLevel === 'NATURAL' && targetRating < 80) {
        targetRating = Math.max(targetRating, 80);
      }

      // Aplicar limites e cap
      targetRating = Math.min(maxCap, Math.max(52, targetRating));

      player.row[5] = String(targetRating);
      newRows.push(player.row);
    });
  }

  // Reescrever content/players.csv
  const headerLine = playersParsed.header.join(',');
  const lines = [headerLine, ...newRows.map((r) => r.join(','))];
  fs.writeFileSync(playersPath, lines.join('\n'), 'utf8');

  console.log(`✅ Recalibragem global concluída com sucesso! ${newRows.length} jogadores recalibrados em ${clubPlayers.size} clubes.`);
}

calibrateWorld();
