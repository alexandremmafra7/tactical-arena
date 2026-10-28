const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const novosDir = 'D:/Code/Documentação/Elencos/Novos';
const crestsDir = path.join(repoRoot, 'content', 'crests');
const clubsCsvPath = path.join(repoRoot, 'content', 'clubs.csv');
const playersCsvPath = path.join(repoRoot, 'content', 'players.csv');

fs.mkdirSync(crestsDir, { recursive: true });

const NEW_CLUBS = [
  // --- LA LIGA (ESP) ---
  { slug: 'real-madrid', name: 'Real Madrid', country: 'ESP', division: 1, stadiumCapacity: 81044, skillLevel: 85, logoNames: ['logo-Real-Madrid.png', 'LaLiga-logo-Real-Madrid.png'] },
  { slug: 'barcelona', name: 'Barcelona', country: 'ESP', division: 1, stadiumCapacity: 99354, skillLevel: 84, jsonFile: 'LaLiga-squad-Barcelona.json', logoNames: ['logo-Barcelona.png', 'LaLiga-logo-Barcelona.png'] },
  { slug: 'atletico-madrid', name: 'Atlético de Madrid', country: 'ESP', division: 1, stadiumCapacity: 70460, skillLevel: 82, jsonFile: 'LaLiga-squad-Atletico-Madrid.json', logoNames: ['logo-Atletico-Madrid.png', 'LaLiga-logo-Atletico-Madrid.png'] },
  { slug: 'athletic-club', name: 'Athletic Club', country: 'ESP', division: 1, stadiumCapacity: 53289, skillLevel: 78, jsonFile: 'LaLiga-squad-Athletic-Club.json', logoNames: ['logo-Athletic-Club.png', 'LaLiga-logo-Athletic-Club.png'] },
  { slug: 'real-sociedad', name: 'Real Sociedad', country: 'ESP', division: 1, stadiumCapacity: 39500, skillLevel: 77, logoNames: ['logo-Real-Sociedad.png', 'LaLiga-logo-Real-Sociedad.png'] },
  { slug: 'villarreal', name: 'Villarreal', country: 'ESP', division: 1, stadiumCapacity: 23500, skillLevel: 77, jsonFile: 'LaLiga-squad-Villarreal.json', logoNames: ['logo-Villarreal.png', 'LaLiga-logo-Villarreal.png'] },
  { slug: 'real-betis', name: 'Real Betis', country: 'ESP', division: 1, stadiumCapacity: 60721, skillLevel: 76, logoNames: ['logo-Real-Betis.png', 'LaLiga-logo-Real-Betis.png'] },
  { slug: 'girona', name: 'Girona', country: 'ESP', division: 1, stadiumCapacity: 14624, skillLevel: 76, logoNames: ['logo-Girona.png', 'LaLiga-logo-Girona.png'] },
  { slug: 'sevilla', name: 'Sevilla', country: 'ESP', division: 1, stadiumCapacity: 43883, skillLevel: 75, jsonFile: 'LaLiga-squad-Sevilla.json', logoNames: ['logo-Sevilla.png', 'LaLiga-logo-Sevilla.png'] },
  { slug: 'valencia', name: 'Valencia', country: 'ESP', division: 1, stadiumCapacity: 49430, skillLevel: 74, jsonFile: 'LaLiga-squad-Valencia.json', logoNames: ['logo-Valencia.png', 'LaLiga-logo-Valencia.png'] },
  { slug: 'osasuna', name: 'Osasuna', country: 'ESP', division: 1, stadiumCapacity: 23576, skillLevel: 73, logoNames: ['logo-Osasuna.png', 'LaLiga-logo-Osasuna.png'] },
  { slug: 'celta-vigo', name: 'Celta de Vigo', country: 'ESP', division: 1, stadiumCapacity: 29000, skillLevel: 73, jsonFile: 'LaLiga-squad-Celta-Vigo.json', logoNames: ['logo-Celta-Vigo.png', 'LaLiga-logo-Celta-Vigo.png'] },
  { slug: 'mallorca', name: 'Mallorca', country: 'ESP', division: 1, stadiumCapacity: 23142, skillLevel: 72, logoNames: ['logo-Mallorca.png', 'LaLiga-logo-Mallorca.png'] },
  { slug: 'rayo-vallecano', name: 'Rayo Vallecano', country: 'ESP', division: 1, stadiumCapacity: 14708, skillLevel: 72, logoNames: ['logo-Rayo-Vallecano.png', 'LaLiga-logo-Rayo-Vallecano.png'] },
  { slug: 'alaves', name: 'Alavés', country: 'ESP', division: 1, stadiumCapacity: 19840, skillLevel: 71, logoNames: ['logo-Alaves.png', 'LaLiga-logo-Alaves.png'] },
  { slug: 'getafe', name: 'Getafe', country: 'ESP', division: 1, stadiumCapacity: 16500, skillLevel: 71, logoNames: ['logo-Getafe.png', 'LaLiga-logo-Getafe.png'] },
  { slug: 'las-palmas', name: 'Las Palmas', country: 'ESP', division: 1, stadiumCapacity: 32400, skillLevel: 70, jsonFile: 'LaLiga-squad-Las-Palmas.json', logoNames: ['logo-Las-Palmas.png', 'LaLiga-logo-Las-Palmas.png'] },
  { slug: 'espanyol', name: 'Espanyol', country: 'ESP', division: 1, stadiumCapacity: 40000, skillLevel: 70, logoNames: ['logo-Espanyol.png', 'LaLiga-logo-Espanyol.png'] },
  { slug: 'leganes', name: 'Leganés', country: 'ESP', division: 1, stadiumCapacity: 12454, skillLevel: 69, jsonFile: 'LaLiga-squad-Leganes.json', logoNames: ['logo-Leganes.png', 'LaLiga-logo-Leganes.png'] },
  { slug: 'valladolid', name: 'Real Valladolid', country: 'ESP', division: 1, stadiumCapacity: 27618, skillLevel: 68, logoNames: ['logo-Valladolid.png', 'LaLiga-logo-Valladolid.png'] },

  // --- PREMIER LEAGUE (ENG) ---
  { slug: 'manchester-city', name: 'Manchester City', country: 'ENG', division: 1, stadiumCapacity: 53400, skillLevel: 86, logoNames: ['PremierLeague-logo-Manchester-City.png'] },
  { slug: 'arsenal', name: 'Arsenal', country: 'ENG', division: 1, stadiumCapacity: 60704, skillLevel: 85, jsonFile: 'PremierLeague-squad-Arsenal.json', logoNames: ['PremierLeague-logo-Arsenal.png'] },
  { slug: 'liverpool', name: 'Liverpool', country: 'ENG', division: 1, stadiumCapacity: 61276, skillLevel: 85, jsonFile: 'PremierLeague-squad-Liverpool.json', logoNames: ['PremierLeague-logo-Liverpool.png'] },
  { slug: 'chelsea', name: 'Chelsea', country: 'ENG', division: 1, stadiumCapacity: 40341, skillLevel: 81, logoNames: ['PremierLeague-logo-Chelsea.png'] },
  { slug: 'tottenham', name: 'Tottenham Hotspur', country: 'ENG', division: 1, stadiumCapacity: 62850, skillLevel: 80, logoNames: ['PremierLeague-logo-Tottenham.png'] },
  { slug: 'aston-villa', name: 'Aston Villa', country: 'ENG', division: 1, stadiumCapacity: 42682, skillLevel: 80, logoNames: ['PremierLeague-logo-Aston-Villa.png'] },
  { slug: 'newcastle', name: 'Newcastle United', country: 'ENG', division: 1, stadiumCapacity: 52305, skillLevel: 80, jsonFile: 'PremierLeague-squad-Newcastle.json', logoNames: ['PremierLeague-logo-Newcastle.png'] },
  { slug: 'manchester-united', name: 'Manchester United', country: 'ENG', division: 1, stadiumCapacity: 74310, skillLevel: 79, jsonFile: 'PremierLeague-squad-Manchester-United.json', logoNames: ['PremierLeague-logo-Manchester-United.png'] },
  { slug: 'brighton', name: 'Brighton & Hove Albion', country: 'ENG', division: 1, stadiumCapacity: 31800, skillLevel: 76, logoNames: ['PremierLeague-logo-Brighton.png'] },
  { slug: 'west-ham', name: 'West Ham United', country: 'ENG', division: 1, stadiumCapacity: 62500, skillLevel: 76, logoNames: ['PremierLeague-logo-West-Ham.png'] },
  { slug: 'fulham', name: 'Fulham', country: 'ENG', division: 1, stadiumCapacity: 25700, skillLevel: 75, jsonFile: 'PremierLeague-squad-Fulham.json', logoNames: ['PremierLeague-logo-Fulham.png'] },
  { slug: 'bournemouth', name: 'Bournemouth', country: 'ENG', division: 1, stadiumCapacity: 11307, skillLevel: 74, jsonFile: 'PremierLeague-squad-Bournemouth.json', logoNames: ['PremierLeague-logo-Bournemouth.png'] },
  { slug: 'brentford', name: 'Brentford', country: 'ENG', division: 1, stadiumCapacity: 17250, skillLevel: 74, logoNames: ['PremierLeague-logo-Brentford.png'] },
  { slug: 'crystal-palace', name: 'Crystal Palace', country: 'ENG', division: 1, stadiumCapacity: 25486, skillLevel: 74, logoNames: ['PremierLeague-logo-Crystal-Palace.png'] },
  { slug: 'wolves', name: 'Wolverhampton Wanderers', country: 'ENG', division: 1, stadiumCapacity: 32050, skillLevel: 73, jsonFile: 'PremierLeague-squad-Wolves.json', logoNames: ['PremierLeague-logo-Wolves.png'] },
  { slug: 'everton', name: 'Everton', country: 'ENG', division: 1, stadiumCapacity: 39571, skillLevel: 73, jsonFile: 'PremierLeague-squad-Everton.json', logoNames: ['PremierLeague-logo-Everton.png'] },
  { slug: 'nottingham-forest', name: 'Nottingham Forest', country: 'ENG', division: 1, stadiumCapacity: 30445, skillLevel: 72, logoNames: ['PremierLeague-logo-Nottingham-Forest.png'] },
  { slug: 'leicester', name: 'Leicester City', country: 'ENG', division: 1, stadiumCapacity: 32261, skillLevel: 71, logoNames: ['PremierLeague-logo-Leicester.png'] },
  { slug: 'southampton', name: 'Southampton', country: 'ENG', division: 1, stadiumCapacity: 32384, skillLevel: 70, jsonFile: 'PremierLeague-squad-Southampton.json', logoNames: ['PremierLeague-logo-Southampton.png'] },
  { slug: 'ipswich', name: 'Ipswich Town', country: 'ENG', division: 1, stadiumCapacity: 29673, skillLevel: 68, logoNames: ['PremierLeague-logo-Ipswich.png'] },
];

console.log('--- 1. Copying Club Logos ---');
for (const club of NEW_CLUBS) {
  let copied = false;
  for (const logoName of club.logoNames) {
    const src = path.join(novosDir, logoName);
    if (fs.existsSync(src)) {
      const dest = path.join(crestsDir, `${club.slug}.png`);
      fs.copyFileSync(src, dest);
      console.log(`+ Crest: ${club.slug}.png`);
      copied = true;
      break;
    }
  }
  if (!copied) {
    console.warn(`! Crest not found for ${club.slug}`);
  }
}

console.log('\n--- 2. Updating content/clubs.csv ---');
const existingClubsContent = fs.readFileSync(clubsCsvPath, 'utf8');
const existingClubLines = existingClubsContent.split(/\r?\n/).filter(l => l.trim().length > 0);
const existingSlugs = new Set(existingClubLines.slice(1).map(l => l.split(',')[0].trim()));

const newClubLines = [];
for (const club of NEW_CLUBS) {
  if (!existingSlugs.has(club.slug)) {
    newClubLines.push(`${club.slug},"${club.name}",${club.country},${club.division},${club.stadiumCapacity},${club.skillLevel}`);
    existingSlugs.add(club.slug);
  }
}

const updatedClubsCsv = [...existingClubLines, ...newClubLines].join('\n') + '\n';
fs.writeFileSync(clubsCsvPath, updatedClubsCsv, 'utf8');
console.log(`+ Added ${newClubLines.length} new clubs to content/clubs.csv (Total: ${existingSlugs.size})`);

console.log('\n--- 3. Extracting Real Players to content/players.csv ---');
const existingPlayersContent = fs.existsSync(playersCsvPath) ? fs.readFileSync(playersCsvPath, 'utf8') : 'club_slug,name,position,age,nationality,rating\n';
const existingPlayerLines = existingPlayersContent.split(/\r?\n/).filter(l => l.trim().length > 0);

// Keep players from clubs that are NOT in NEW_CLUBS (e.g. example clubs)
const newClubSlugs = new Set(NEW_CLUBS.map(c => c.slug));
const preservedPlayerLines = existingPlayerLines.filter((l, i) => {
  if (i === 0) return true; // header
  const clubSlug = l.split(',')[0].trim();
  return !newClubSlugs.has(clubSlug);
});

const addedPlayerLines = [];

for (const club of NEW_CLUBS) {
  if (!club.jsonFile) continue;
  const jsonPath = path.join(novosDir, club.jsonFile);
  if (!fs.existsSync(jsonPath)) continue;

  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  const players = data.response?.[0]?.players || [];

  let defCount = 0;
  for (const p of players) {
    const rawPos = p.position || 'Midfielder';
    let position = 'MID';
    if (rawPos === 'Goalkeeper') {
      position = 'GK';
    } else if (rawPos === 'Defender') {
      defCount++;
      position = (defCount % 2 === 0) ? 'LAT' : 'DEF';
    } else if (rawPos === 'Midfielder') {
      position = 'MID';
    } else if (rawPos === 'Attacker') {
      position = 'ATT';
    }

    const age = Number(p.age) || 24;
    const nationality = club.country;
    
    let rating = club.skillLevel;
    if (p.number && p.number <= 11) {
      rating += 3;
    } else if (age <= 20) {
      rating -= 4;
    } else if (age >= 34) {
      rating -= 1;
    } else {
      rating += (Math.abs(p.id % 7) - 3);
    }
    rating = Math.max(60, Math.min(92, rating));

    const cleanName = (p.name || 'Jogador').replace(/"/g, '""');
    addedPlayerLines.push(`${club.slug},"${cleanName}",${position},${age},${nationality},${rating}`);
  }
}

const updatedPlayersCsv = [...preservedPlayerLines, ...addedPlayerLines].join('\n') + '\n';
fs.writeFileSync(playersCsvPath, updatedPlayersCsv, 'utf8');
console.log(`+ Extracted & added ${addedPlayerLines.length} real players to content/players.csv (Total rows: ${preservedPlayerLines.length - 1 + addedPlayerLines.length})`);

