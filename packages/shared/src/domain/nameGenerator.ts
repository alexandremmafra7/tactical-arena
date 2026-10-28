import { Continent } from './country.js';

const NAME_POOLS: Record<Continent, { first: string[]; last: string[] }> = {
  SOUTH_AMERICA: {
    first: ['Ricardo', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Fabio', 'Gustavo', 'Hugo', 'Igor', 'Junior', 'Leandro'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins'],
  },
  EUROPE: {
    first: ['James', 'Thomas', 'Daniel', 'Marco', 'Luca', 'Hans', 'Pierre', 'Antoine', 'Nikola', 'Ivan'],
    last: ['Smith', 'Müller', 'Rossi', 'Dubois', 'Kowalski', 'Novak', 'Ivanov', 'Van Dijk', 'Johansson', 'García'],
  },
  AFRICA: {
    first: ['Kwame', 'Kofi', 'Emmanuel', 'Ibrahim', 'Mohamed', 'Samuel', 'Victor', 'Ahmed', 'Sadio', 'Yaya'],
    last: ['Mensah', 'Osei', 'Diallo', 'Toure', 'Traore', 'Okafor', 'Abubakar', 'Nkomo', 'Adebayo', 'Keita'],
  },
  ASIA: {
    first: ['Hiroshi', 'Kenji', 'Takumi', 'Min-jun', 'Wei', 'Jian', 'Yusuf', 'Ali', 'Amir', 'Hassan'],
    last: ['Tanaka', 'Sato', 'Kim', 'Park', 'Wang', 'Li', 'Al-Farsi', 'Al-Amin', 'Rahimi', 'Nakamura'],
  },
  NORTH_AMERICA: {
    first: ['Carlos', 'Miguel', 'Jose', 'Michael', 'John', 'Robert', 'Alejandro', 'David'],
    last: ['Hernandez', 'Rodriguez', 'Gonzalez', 'Johnson', 'Williams', 'Martinez', 'Lopez', 'Perez'],
  },
  OCEANIA: {
    first: ['Jack', 'Liam', 'Cooper', 'Riley', 'Ethan', 'Lucas', 'Noah', 'Mason'],
    last: ['Smith', 'Taylor', 'Brown', 'Wilson', 'Anderson', 'Thompson', 'White', 'Martin'],
  },
};

export function generatePlayerName(continent: Continent, rng: () => number): string {
  const pool = NAME_POOLS[continent];
  const first = pool.first[Math.floor(rng() * pool.first.length)];
  const last = pool.last[Math.floor(rng() * pool.last.length)];
  return `${first} ${last}`;
}
