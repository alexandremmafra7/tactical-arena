const fs = require('fs');
const path = require('path');

const artDir = 'D:\\Code\\Imagens\\Patrocinadores';
const files = fs.readdirSync(artDir);

function normalize(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const artByNorm = new Map();
for (const f of files) {
  const stem = f.replace(/\.(png|PNG)$/, '');
  artByNorm.set(normalize(stem), f);
}

// Sponsor names copied from packages/shared/src/domain/finance.ts SPONSOR_TYPES
const SPONSOR_TYPES = {
  MASTER: [
    'TechNova', 'Banco Meridiano', 'Seguros Horizonte', 'Grupo Atlas', 'Banco Zênite',
    'Conglomerado Aurora', 'Seguradora Nortel', 'Banco Vanguarda', 'Holding Prisma', 'Grupo Realce',
    'Banco Confiança', 'Seguros Constelação', 'Grupo Titânio', 'Banco Fortaleza', 'Holding Meridian',
    'Seguradora Zafira', 'Grupo Ouro Negro', 'Banco Estrela do Sul',
  ],
  KIT_SUPPLIER: [
    'Rincon Sports', 'Vortex Athletic', 'Prisma Sportswear', 'Fúria Esportes', 'Titan Sport',
    'Apex Athletics', 'Condor Sports', 'Elite Wear', 'Rasante Esportivo', 'Trinca Sports',
    'Impacto Athletic', 'Garra Esportes', 'Máxima Sportswear', 'Zenit Sports', 'Braza Athletic',
    'Fênix Sport', 'Raio Esportivo', 'Vigor Sports',
  ],
  STADIUM_NAMING: [
    'Construtora Atlas', 'Energia Solar Vitória', 'Telecom Estrela', 'Construtora Horizonte', 'Energia Vórtice',
    'Telecom Nexus', 'Construtora Pilar', 'Energia Meridiana', 'Telecom Conecta', 'Construtora Fundação',
    'Energia Lumen', 'Telecom Sinal Forte', 'Construtora Marco', 'Energia Ventus', 'Telecom Órbita',
    'Construtora Alicerce', 'Energia Raio', 'Telecom Ponte',
    'Construtora Alfa', 'Construtora Forte', 'Construtora Gama', 'Construtora Nova Era', 'Construtora Ômega',
    'Construtora Prime', 'Energia Brava', 'Energia do Amanhã', 'Energia Nova', 'Energia Toral',
    'Energia Viva', 'Pura Energia', 'Telecom Leste', 'Telecom Norte', 'Telecom Sul',
  ],
  REGIONAL: [
    'AutoPeças Vale', 'Bebidas Cristal', 'Mercado Bom Preço', 'Farmácia Vitalis', 'Padaria Trigo Dourado',
    'AutoCenter Rota', 'Distribuidora Sabor', 'Mercadinho Economia', 'Bebidas Cascata', 'AutoPeças Rodante',
    'Farmácia Popular Vida', 'Mercado Central', 'Distribuidora Vale Verde', 'Bebidas Fonte Pura', 'AutoPeças Motriz',
    'Mercadão Regional', 'Farmácia Bem Estar', 'Padaria Aroma',
  ],
  TECH_EQUIPMENT: [
    'ByteForce', 'NanoFit Performance', 'DataGoal Analytics', 'PulseTech Sports', 'VectorPlay',
    'Sensora Analytics', 'CodeField Sports', 'MétricaGoal', 'NeuroSport Tech', 'QuantumPlay',
    'SprintData', 'HyperFit Systems', 'TáticaData', 'VisãoTech Sports', 'AgilTech',
    'PerformaLab', 'EstatísticaPro', 'SkillSync',
  ],
};

const matched = {};
const unmatchedNames = {};
const usedArt = new Set();

for (const [type, names] of Object.entries(SPONSOR_TYPES)) {
  matched[type] = [];
  unmatchedNames[type] = [];
  for (const name of names) {
    const norm = normalize(name);
    if (artByNorm.has(norm)) {
      matched[type].push({ name, file: artByNorm.get(norm) });
      usedArt.add(artByNorm.get(norm));
    } else {
      unmatchedNames[type].push(name);
    }
  }
}

const orphanArt = files.filter((f) => !usedArt.has(f));

console.log('=== MATCHED ===');
console.log(JSON.stringify(matched, null, 2));
console.log('=== UNMATCHED SPONSOR NAMES (no art) ===');
console.log(JSON.stringify(unmatchedNames, null, 2));
console.log('=== ORPHAN ART FILES (no matching sponsor name) ===');
console.log(JSON.stringify(orphanArt, null, 2));
