#!/usr/bin/env node
/**
 * Atualização incremental de elencos via API-Football (api-sports.io), respeitando a cota diária.
 *
 *   API_FOOTBALL_KEY=xxxx node tools/squad-sync/apifootball.mjs sync    busca os elencos mais desatualizados
 *   node tools/squad-sync/apifootball.mjs apply                          reescreve esses elencos em content/players.csv
 *
 * A API só diz QUEM está no clube (nome, idade, posição ampla) — não traz nota. Por isso o `apply` preserva
 * rating/star_level/diferenciado de quem já está no CSV (casado pelo nome) e dá aos recém-chegados a mediana
 * do elenco menos 4. Posições: Goalkeeper→GK, Defender→DEF, Midfielder→MID, Attacker→ATT (a API não separa LAT).
 * Plano grátis ≈ 100 req/dia; cada clube custa 1 req (2 na primeira vez, para descobrir o id do time).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY, norm, readTable, toCsv } from './sync.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(here, '..', '..', 'content');
const outDir = path.join(here, 'cache', 'apifootball');
const statePath = path.join(here, 'cache', 'apifootball-state.json');
const KEY = process.env.API_FOOTBALL_KEY;
const BUDGET = Number(process.env.API_FOOTBALL_DAILY_BUDGET ?? 90);
const POS = { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Attacker: 'ATT' };
const COUNTRY_NAME = Object.fromEntries(Object.entries(COUNTRY).reverse().map(([n, c]) => [c, n]));

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { teams: {} };
const save = () => { fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); };

async function api(endpoint) {
  const res = await fetch(`https://v3.football.api-sports.io/${endpoint}`, { headers: { 'x-apisports-key': KEY } });
  if (!res.ok) throw new Error(`API-Football ${endpoint}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length) throw new Error(`API-Football ${endpoint}: ${JSON.stringify(body.errors)}`);
  return body.response;
}

async function sync() {
  if (!KEY) throw new Error('Defina API_FOOTBALL_KEY (chave gratuita em https://dashboard.api-football.com).');
  fs.mkdirSync(outDir, { recursive: true });
  const clubs = readTable(path.join(contentDir, 'clubs.csv')).filter((c) => !c.slug.startsWith('exemplo-'));
  // Quem nunca sincronizou vem primeiro, depois os mais antigos.
  clubs.sort((a, b) => (state.teams[a.slug]?.lastSync ?? '') .localeCompare(state.teams[b.slug]?.lastSync ?? ''));
  let used = 0;
  for (const club of clubs) {
    const entry = (state.teams[club.slug] ??= {});
    const need = entry.id ? 1 : 2;
    if (used + need > BUDGET) break;
    try {
      if (!entry.id) {
        const found = await api(`teams?search=${encodeURIComponent(club.name.slice(0, 40))}`); used++;
        const hit = found.find((t) => t.team.country === COUNTRY_NAME[club.country]) ?? null;
        if (!hit) { entry.id = -1; entry.lastSync = new Date().toISOString(); continue; }
        entry.id = hit.team.id;
      }
      if (entry.id < 0) continue;
      const squad = await api(`players/squads?team=${entry.id}`); used++;
      fs.writeFileSync(path.join(outDir, `${club.slug}.json`), JSON.stringify(squad[0]?.players ?? [], null, 1));
      entry.lastSync = new Date().toISOString();
    } finally { save(); }
  }
  console.log(`requisições usadas: ${used}/${BUDGET}`);
}

function apply() {
  const file = path.join(contentDir, 'players.csv');
  const head = ['club_slug', 'name', 'position', 'age', 'nationality', 'rating', 'star_level', 'diferenciado'];
  const all = readTable(file);
  const clubs = new Map(readTable(path.join(contentDir, 'clubs.csv')).map((c) => [c.slug, c]));
  const synced = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
  if (!synced.length) throw new Error('Nenhum elenco em cache — rode "sync" antes.');
  const keep = all.filter((p) => !synced.includes(p.club_slug));
  const added = [];
  for (const slug of synced) {
    const incoming = JSON.parse(fs.readFileSync(path.join(outDir, `${slug}.json`), 'utf8'));
    const old = all.filter((p) => p.club_slug === slug);
    if (incoming.length < 11) { keep.push(...old); continue; } // elenco incompleto: mantém o que já existe
    const byName = new Map(old.map((p) => [norm(p.name), p]));
    const ratings = old.map((p) => Number(p.rating)).sort((a, b) => a - b);
    const fallback = (ratings[Math.floor(ratings.length / 2)] ?? 64) - 4;
    for (const p of incoming) {
      const prev = byName.get(norm(p.name));
      added.push({
        club_slug: slug, name: p.name, position: prev?.position ?? POS[p.position] ?? 'MID', age: p.age ?? prev?.age ?? 25,
        nationality: prev?.nationality ?? clubs.get(slug)?.country ?? 'BRA', rating: prev?.rating ?? fallback,
        star_level: prev?.star_level ?? 'NONE', diferenciado: prev?.diferenciado ?? 'NONE',
      });
    }
  }
  fs.copyFileSync(file, `${file}.bak-apifootball-${new Date().toISOString().slice(0, 10)}`);
  fs.writeFileSync(file, toCsv(head, [...keep, ...added]));
  console.log(`players.csv: ${added.length} jogadores atualizados em ${synced.length} clubes`);
}

const cmd = process.argv[2];
if (cmd === 'sync') await sync();
else if (cmd === 'apply') apply();
else { console.error('uso: apifootball.mjs sync | apply'); process.exit(1); }
