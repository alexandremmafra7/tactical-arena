import type { KitPattern } from './club.js';

export interface ClubKitConfig {
  primaryColor: string;
  secondaryColor: string;
  kitPattern: KitPattern;
  awayPrimaryColor: string;
  awaySecondaryColor: string;
  awayKitPattern: KitPattern;
}

export interface ClubLike {
  slug?: string | null;
  name?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  kitPattern?: KitPattern | null;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
  awayKitPattern?: KitPattern | null;
}

/**
 * Registro Canônico de Uniformes Profissionais dos Clubes.
 * Cores hexadecimais autênticas e padrões gráficos oficiais (listras, faixas, degradês).
 */
export const CANONICAL_CLUB_KITS: Record<string, ClubKitConfig> = {
  // --- BRASIL: GIGANTES E SÉRIE A/B ---
  flamengo: {
    primaryColor: '#c8102e', // Vermelho rubro-negro
    secondaryColor: '#111111', // Preto
    kitPattern: 'STRIPES_HORIZONTAL', // Manto tradicional listrado horizontalmente
    awayPrimaryColor: '#ffffff', // Manto 2 branco
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  palmeiras: {
    primaryColor: '#028b4c', // Verde esmeralda
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#028b4c',
    awayKitPattern: 'SOLID',
  },
  'sao-paulo': {
    primaryColor: '#ffffff', // Branco com faixas tricolores
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#c8102e',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  saopaulo: {
    primaryColor: '#ffffff',
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#c8102e',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  corinthians: {
    primaryColor: '#ffffff', // Alvinegro
    secondaryColor: '#111111',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  santos: {
    primaryColor: '#ffffff', // Alvinegro praiano
    secondaryColor: '#111111',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  gremio: {
    primaryColor: '#0d80f2', // Azul celeste tricolor
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#0d80f2',
    awayKitPattern: 'SOLID',
  },
  internacional: {
    primaryColor: '#c8102e', // Colorado
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  cruzeiro: {
    primaryColor: '#003399', // Azul celeste estrelado
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#003399',
    awayKitPattern: 'SOLID',
  },
  'atletico-mg': {
    primaryColor: '#111111', // Alvinegro mineiro listrado
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  atleticomineiro: {
    primaryColor: '#111111',
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  fluminense: {
    primaryColor: '#7a1326', // Grená e verde tricolor das laranjeiras
    secondaryColor: '#0f5a34',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#7a1326',
    awayKitPattern: 'SOLID',
  },
  botafogo: {
    primaryColor: '#111111', // Glorioso listrado preto e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'SOLID',
  },
  'vasco-da-gama': {
    primaryColor: '#111111', // Cruzmaltino com faixa diagonal clássica
    secondaryColor: '#ffffff',
    kitPattern: 'DIAGONAL_SASH',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'DIAGONAL_SASH',
  },
  vasco: {
    primaryColor: '#111111',
    secondaryColor: '#ffffff',
    kitPattern: 'DIAGONAL_SASH',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'DIAGONAL_SASH',
  },
  bahia: {
    primaryColor: '#005bac', // Tricolor de aço
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#c8102e',
    awaySecondaryColor: '#005bac',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  'atletico-paranaense': {
    primaryColor: '#c8102e', // Furacão rubro-negro
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'athletico-pr': {
    primaryColor: '#c8102e',
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  fortaleza: {
    primaryColor: '#003399', // Tricolor do Pici listrado
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#003399',
    awayKitPattern: 'SOLID',
  },
  'rb-bragantino': {
    primaryColor: '#ffffff', // Massa bruta
    secondaryColor: '#c8102e',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'SOLID',
  },
  vitoria: {
    primaryColor: '#c8102e', // Leão da barra rubro-negro listrado
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  cuiaba: {
    primaryColor: '#005a2b', // Dourado
    secondaryColor: '#ffcc00',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#005a2b',
    awayKitPattern: 'SOLID',
  },
  criciuma: {
    primaryColor: '#ffcc00', // Tigre carvoeiro amarelo e preto
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
  juventude: {
    primaryColor: '#008033', // Papo verde e branco listrado
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#008033',
    awayKitPattern: 'SOLID',
  },
  'atletico-goianiense': {
    primaryColor: '#c8102e', // Dragão rubro-negro listrado
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  coritiba: {
    primaryColor: '#ffffff', // Coxa com duas listras horizontais verdes
    secondaryColor: '#005522',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#005522',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  coritiba_bra: {
    primaryColor: '#ffffff',
    secondaryColor: '#005522',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#005522',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  sport: {
    primaryColor: '#c8102e', // Leão da Ilha rubro-negro listrado
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'sport-recife': {
    primaryColor: '#c8102e',
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  goias: {
    primaryColor: '#005522', // Esmeraldino
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#005522',
    awayKitPattern: 'SOLID',
  },
  ceara: {
    primaryColor: '#111111', // Vozão alvinegro listrado
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  ceara_bra: {
    primaryColor: '#111111',
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  chapecoense: {
    primaryColor: '#006633', // Chape verde
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#006633',
    awayKitPattern: 'SOLID',
  },
  chapecoense_bra: {
    primaryColor: '#006633',
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#006633',
    awayKitPattern: 'SOLID',
  },
  'america-mg': {
    primaryColor: '#006633', // Coelho listrado verde e preto
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#006633',
    awayKitPattern: 'SOLID',
  },
  americamg_bra: {
    primaryColor: '#006633',
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#006633',
    awayKitPattern: 'SOLID',
  },
  'ponte-preta': {
    primaryColor: '#ffffff', // Macaca com faixa diagonal preta
    secondaryColor: '#111111',
    kitPattern: 'DIAGONAL_SASH',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'DIAGONAL_SASH',
  },
  pontepreta_bra: {
    primaryColor: '#ffffff',
    secondaryColor: '#111111',
    kitPattern: 'DIAGONAL_SASH',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'DIAGONAL_SASH',
  },
  avai: {
    primaryColor: '#005bac', // Leão da Ilha listrado azul e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#005bac',
    awayKitPattern: 'SOLID',
  },
  avai_bra: {
    primaryColor: '#005bac',
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#005bac',
    awayKitPattern: 'SOLID',
  },
  figueirense: {
    primaryColor: '#111111', // Figueira listrado preto e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  mirassol: {
    primaryColor: '#ffcc00', // Leão amarelo e verde
    secondaryColor: '#005522',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#005522',
    awayKitPattern: 'SOLID',
  },
  novorizontino: {
    primaryColor: '#ffcc00', // Tigre do Vale listrado
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
  novorinzontino_sp: {
    primaryColor: '#ffcc00',
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
  crb: {
    primaryColor: '#c8102e', // Galo da Pajuçara
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  crb_bra: {
    primaryColor: '#c8102e',
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'vila-nova': {
    primaryColor: '#c8102e', // Tigrão vermelho
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  vilago: {
    primaryColor: '#c8102e',
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  paysandu: {
    primaryColor: '#007acc', // Papão listrado azul e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#007acc',
    awayKitPattern: 'SOLID',
  },
  remo: {
    primaryColor: '#001c38', // Leão Azul marinho
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#001c38',
    awayKitPattern: 'SOLID',
  },
  nautico: {
    primaryColor: '#c8102e', // Timbu alvirrubro listrado
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'santa-cruz': {
    primaryColor: '#c8102e', // Coral tricolor listrado horizontal
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  santa: {
    primaryColor: '#c8102e',
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  parana: {
    primaryColor: '#c8102e', // Tricolor da Vila meio a meio
    secondaryColor: '#003399',
    kitPattern: 'HALVES',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#003399',
    awayKitPattern: 'SOLID',
  },

  // --- SUL-AMÉRICA: CLÁSSICOS ---
  'boca-juniors': {
    primaryColor: '#002b66', // Azul com faixa horizontal ouro
    secondaryColor: '#ffcc00',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#002b66',
    awayKitPattern: 'SOLID',
  },
  bocajuniors_arg: {
    primaryColor: '#002b66',
    secondaryColor: '#ffcc00',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#002b66',
    awayKitPattern: 'SOLID',
  },
  'river-plate': {
    primaryColor: '#ffffff', // Branco com faixa diagonal vermelha
    secondaryColor: '#c8102e',
    kitPattern: 'DIAGONAL_SASH',
    awayPrimaryColor: '#c8102e',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  riverplate_arg: {
    primaryColor: '#ffffff',
    secondaryColor: '#c8102e',
    kitPattern: 'DIAGONAL_SASH',
    awayPrimaryColor: '#c8102e',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  'racing-club': {
    primaryColor: '#6cb4ee', // La Academia listrado celeste e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#6cb4ee',
    awayKitPattern: 'SOLID',
  },
  racing_arg: {
    primaryColor: '#6cb4ee',
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#6cb4ee',
    awayKitPattern: 'SOLID',
  },
  independiente_arg: {
    primaryColor: '#c8102e', // Rei de Copas vermelho
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  sanlorenzo_ar: {
    primaryColor: '#002b66', // Azulgrana listrado
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#002b66',
    awayKitPattern: 'SOLID',
  },
  penarol: {
    primaryColor: '#ffcc00', // Carbonero listrado ouro e preto
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
  nacional: {
    primaryColor: '#ffffff', // Bolso tricolor
    secondaryColor: '#002b66',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#c8102e',
    awaySecondaryColor: '#002b66',
    awayKitPattern: 'SOLID',
  },
  'colo-colo': {
    primaryColor: '#ffffff', // Cacique branco e preto
    secondaryColor: '#111111',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'SOLID',
  },
  colocolo_chi: {
    primaryColor: '#ffffff',
    secondaryColor: '#111111',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'SOLID',
  },
  olimpia: {
    primaryColor: '#ffffff', // Decano com faixa horizontal preta
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'STRIPES_HORIZONTAL',
  },
  olimpia_par: {
    primaryColor: '#ffffff',
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'STRIPES_HORIZONTAL',
  },
  'cerro-porteno': {
    primaryColor: '#002b66', // Ciclón listrado azul e vermelho
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#002b66',
    awayKitPattern: 'SOLID',
  },

  // --- EUROPA: GIGANTES MUNDIAIS ---
  'real-madrid': {
    primaryColor: '#ffffff', // Merengue
    secondaryColor: '#d4af37',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#001c38',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
  barcelona: {
    primaryColor: '#a50044', // Blaugrana listrado
    secondaryColor: '#004d98',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffcc00',
    awaySecondaryColor: '#a50044',
    awayKitPattern: 'SOLID',
  },
  'atletico-madrid': {
    primaryColor: '#c8102e', // Colchonero listrado
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#001c38',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'manchester-city': {
    primaryColor: '#6cabdd', // Sky Blue
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#6cabdd',
    awayKitPattern: 'STRIPES_VERTICAL',
  },
  liverpool: {
    primaryColor: '#c8102e', // The Reds
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#005a2b',
    awayKitPattern: 'SOLID',
  },
  arsenal: {
    primaryColor: '#c8102e', // Gunners
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  chelsea: {
    primaryColor: '#034694', // The Blues
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#034694',
    awayKitPattern: 'SOLID',
  },
  tottenham: {
    primaryColor: '#ffffff', // Spurs
    secondaryColor: '#132257',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#132257',
    awaySecondaryColor: '#ffffff',
    awayKitPattern: 'SOLID',
  },
  'manchester-united': {
    primaryColor: '#c8102e', // Red Devils
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#111111',
    awayKitPattern: 'SOLID',
  },
  bayern: {
    primaryColor: '#dc052d', // Die Roten
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#8b5cf6',
    awayKitPattern: 'SOLID',
  },
  'borussia-dortmund': {
    primaryColor: '#fde100', // BVB Auri-negro
    secondaryColor: '#111111',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#fde100',
    awayKitPattern: 'SOLID',
  },
  leverkusen: {
    primaryColor: '#c8102e', // Werkself
    secondaryColor: '#111111',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'ac-milan': {
    primaryColor: '#c8102e', // Rossoneri listrado vermelho e preto
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  'inter-milan': {
    primaryColor: '#0040aa', // Nerazzurri listrado azul e preto
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#0040aa',
    awayKitPattern: 'SOLID',
  },
  juventus: {
    primaryColor: '#ffffff', // Bianconeri listrado
    secondaryColor: '#111111',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffcc00',
    awaySecondaryColor: '#002b66',
    awayKitPattern: 'SOLID',
  },
  psg: {
    primaryColor: '#001c38', // Rouge et Bleu com faixa central
    secondaryColor: '#da291c',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#001c38',
    awayKitPattern: 'SOLID',
  },
  parissaintgermain_fr: {
    primaryColor: '#001c38',
    secondaryColor: '#da291c',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffffff',
    awaySecondaryColor: '#001c38',
    awayKitPattern: 'SOLID',
  },
  celtic: {
    primaryColor: '#008044', // Green & White Hoops (listras horizontais)
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#ffcc00',
    awaySecondaryColor: '#008044',
    awayKitPattern: 'SOLID',
  },
  sporting: {
    primaryColor: '#008044', // Listras horizontais verde e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#008044',
    awayKitPattern: 'SOLID',
  },
  sporting_por: {
    primaryColor: '#008044',
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_HORIZONTAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#008044',
    awayKitPattern: 'SOLID',
  },
  porto: {
    primaryColor: '#0040aa', // Dragões listrado azul e branco
    secondaryColor: '#ffffff',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#ffcc00',
    awaySecondaryColor: '#0040aa',
    awayKitPattern: 'SOLID',
  },
  benfica: {
    primaryColor: '#c8102e', // Águias vermelhas
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  benfica_por: {
    primaryColor: '#c8102e',
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#c8102e',
    awayKitPattern: 'SOLID',
  },
  ajax: {
    primaryColor: '#ffffff', // Faixa larga vertical vermelha
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
  ajax_hol: {
    primaryColor: '#ffffff',
    secondaryColor: '#c8102e',
    kitPattern: 'STRIPES_VERTICAL',
    awayPrimaryColor: '#111111',
    awaySecondaryColor: '#ffcc00',
    awayKitPattern: 'SOLID',
  },
};

function normalizeSlug(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve o uniforme do clube priorizando customizações do usuário,
 * e aplicando os dados canônicos oficiais e contrastes harmônicos para o uniforme reserva.
 */
export function resolveClubKit(club?: ClubLike | null): ClubKitConfig {
  const defaultFallback: ClubKitConfig = {
    primaryColor: '#1e293b',
    secondaryColor: '#ffffff',
    kitPattern: 'SOLID',
    awayPrimaryColor: '#f8fafc',
    awaySecondaryColor: '#1e293b',
    awayKitPattern: 'SOLID',
  };

  if (!club) return defaultFallback;

  // Busca na base canônica por slug ou nome normalizado
  let canonical: ClubKitConfig | undefined;
  if (club.slug) {
    const rawSlug = club.slug.toLowerCase().trim();
    if (CANONICAL_CLUB_KITS[rawSlug]) {
      canonical = CANONICAL_CLUB_KITS[rawSlug];
    } else {
      const normSlug = normalizeSlug(club.slug);
      for (const [key, val] of Object.entries(CANONICAL_CLUB_KITS)) {
        if (normalizeSlug(key) === normSlug) {
          canonical = val;
          break;
        }
      }
    }
  }

  if (!canonical && club.name) {
    const normName = normalizeSlug(club.name);
    for (const [key, val] of Object.entries(CANONICAL_CLUB_KITS)) {
      if (normalizeSlug(key) === normName) {
        canonical = val;
        break;
      }
    }
  }

  const primaryColor = club.primaryColor || canonical?.primaryColor || defaultFallback.primaryColor;
  const secondaryColor = club.secondaryColor || canonical?.secondaryColor || defaultFallback.secondaryColor;
  const kitPattern = club.kitPattern || canonical?.kitPattern || defaultFallback.kitPattern;

  const awayPrimaryColor =
    club.awayPrimaryColor ||
    canonical?.awayPrimaryColor ||
    (primaryColor === '#ffffff' || primaryColor === '#f8fafc' ? '#0f172a' : '#ffffff');

  const awaySecondaryColor =
    club.awaySecondaryColor ||
    canonical?.awaySecondaryColor ||
    (primaryColor === '#ffffff' ? secondaryColor : primaryColor);

  const awayKitPattern = club.awayKitPattern || canonical?.awayKitPattern || 'SOLID';

  return {
    primaryColor,
    secondaryColor,
    kitPattern,
    awayPrimaryColor,
    awaySecondaryColor,
    awayKitPattern,
  };
}
