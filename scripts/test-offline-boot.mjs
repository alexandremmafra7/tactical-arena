import fs from 'fs';

const FOREIGN_POSITIONS = {
  GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'ATT', DEF: 'DEF', LAT: 'LAT', MID: 'MID', ATT: 'ATT'
};

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

function rows(text) {
  return text.replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(l => l.trim().length > 0).map(splitCsvLine);
}

function readPlayerRow(cells) {
  const numeric = (value) => /^\d+$/.test((value ?? '').trim());
  const [age, rawPosition, rating] = numeric(cells[3])
    ? [Number(cells[3]), cells[2], Number(cells[5])]
    : [Number(cells[2]), cells[3], Number(cells[4])];

  const position = FOREIGN_POSITIONS[(rawPosition ?? '').toUpperCase().trim()];
  if (!position || !Number.isInteger(age) || age < 15 || age > 45) return null;
  if (!Number.isFinite(rating) || rating < 1 || rating > 99) return null;

  return { name: cells[1] || 'Jogador', position, age, rating };
}

const playersText = fs.readFileSync('packages/web/public/players.csv', 'utf8');
const squads = new Map();
for (const cells of rows(playersText)) {
  const player = readPlayerRow(cells);
  if (!player || !cells[0]) continue;
  const list = squads.get(cells[0]) ?? [];
  if (list.length < 26) list.push(player);
  squads.set(cells[0], list);
}

const clubsText = fs.readFileSync('packages/web/public/clubs.csv', 'utf8');
const clubRows = rows(clubsText);
const braRows = clubRows.filter(c => c[2] === 'BRA');
console.log('Total BRA clubs:', braRows.length);

const div1 = braRows.filter(c => c[3] === '1');
console.log('Div 1 clubs count:', div1.length);
for (const c of div1) {
  const s = squads.get(c[0]);
  console.log(c[0], 'squad size:', s ? s.length : 0, 'skill_level:', c[5]);
}

const div2 = braRows.filter(c => c[3] === '2');
console.log('Div 2 clubs count:', div2.length);
for (const c of div2) {
  const s = squads.get(c[0]);
  console.log(c[0], 'squad size:', s ? s.length : 0, 'skill_level:', c[5]);
}
