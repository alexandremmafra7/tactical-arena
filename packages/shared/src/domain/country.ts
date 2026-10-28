export type Continent = 'SOUTH_AMERICA' | 'EUROPE' | 'AFRICA' | 'ASIA' | 'NORTH_AMERICA' | 'OCEANIA';

export interface Country {
  code: string;
  name: string;
  continent: Continent;
  flag: string;
}

/** A club is founded in one of these countries (and joins that country's league); a player's nationality is separate. */
export const COUNTRIES: Country[] = [
  // South America
  { code: 'BRA', name: 'Brasil', continent: 'SOUTH_AMERICA', flag: '🇧🇷' },
  { code: 'ARG', name: 'Argentina', continent: 'SOUTH_AMERICA', flag: '🇦🇷' },
  { code: 'URU', name: 'Uruguai', continent: 'SOUTH_AMERICA', flag: '🇺🇾' },
  { code: 'CHI', name: 'Chile', continent: 'SOUTH_AMERICA', flag: '🇨🇱' },
  { code: 'COL', name: 'Colômbia', continent: 'SOUTH_AMERICA', flag: '🇨🇴' },
  { code: 'PAR', name: 'Paraguai', continent: 'SOUTH_AMERICA', flag: '🇵🇾' },
  { code: 'PER', name: 'Peru', continent: 'SOUTH_AMERICA', flag: '🇵🇪' },
  { code: 'ECU', name: 'Equador', continent: 'SOUTH_AMERICA', flag: '🇪🇨' },
  { code: 'BOL', name: 'Bolívia', continent: 'SOUTH_AMERICA', flag: '🇧🇴' },
  { code: 'VEN', name: 'Venezuela', continent: 'SOUTH_AMERICA', flag: '🇻🇪' },
  // Europe
  { code: 'ENG', name: 'Inglaterra', continent: 'EUROPE', flag: '🏴' },
  { code: 'ESP', name: 'Espanha', continent: 'EUROPE', flag: '🇪🇸' },
  { code: 'ITA', name: 'Itália', continent: 'EUROPE', flag: '🇮🇹' },
  { code: 'GER', name: 'Alemanha', continent: 'EUROPE', flag: '🇩🇪' },
  { code: 'FRA', name: 'França', continent: 'EUROPE', flag: '🇫🇷' },
  { code: 'POR', name: 'Portugal', continent: 'EUROPE', flag: '🇵🇹' },
  { code: 'NED', name: 'Holanda', continent: 'EUROPE', flag: '🇳🇱' },
  { code: 'BEL', name: 'Bélgica', continent: 'EUROPE', flag: '🇧🇪' },
  { code: 'SCO', name: 'Escócia', continent: 'EUROPE', flag: '🏴' },
  { code: 'CRO', name: 'Croácia', continent: 'EUROPE', flag: '🇭🇷' },
  { code: 'SRB', name: 'Sérvia', continent: 'EUROPE', flag: '🇷🇸' },
  { code: 'TUR', name: 'Turquia', continent: 'EUROPE', flag: '🇹🇷' },
  { code: 'AUT', name: 'Áustria', continent: 'EUROPE', flag: '🇦🇹' },
  { code: 'DEN', name: 'Dinamarca', continent: 'EUROPE', flag: '🇩🇰' },
  { code: 'SUI', name: 'Suíça', continent: 'EUROPE', flag: '🇨🇭' },
  { code: 'SWE', name: 'Suécia', continent: 'EUROPE', flag: '🇸🇪' },
  { code: 'CZE', name: 'República Checa', continent: 'EUROPE', flag: '🇨🇿' },
  { code: 'NOR', name: 'Noruega', continent: 'EUROPE', flag: '🇳🇴' },
  { code: 'BIH', name: 'Bósnia e Herzegovina', continent: 'EUROPE', flag: '🇧🇦' },
  { code: 'POL', name: 'Polônia', continent: 'EUROPE', flag: '🇵🇱' },
  { code: 'HUN', name: 'Hungria', continent: 'EUROPE', flag: '🇭🇺' },
  { code: 'UKR', name: 'Ucrânia', continent: 'EUROPE', flag: '🇺🇦' },
  { code: 'ISL', name: 'Islândia', continent: 'EUROPE', flag: '🇮🇸' },
  { code: 'SVN', name: 'Eslovênia', continent: 'EUROPE', flag: '🇸🇮' },
  { code: 'SVK', name: 'Eslováquia', continent: 'EUROPE', flag: '🇸🇰' },
  { code: 'EST', name: 'Estônia', continent: 'EUROPE', flag: '🇪🇪' },
  { code: 'FIN', name: 'Finlândia', continent: 'EUROPE', flag: '🇫🇮' },
  { code: 'LUX', name: 'Luxemburgo', continent: 'EUROPE', flag: '🇱🇺' },
  { code: 'GRE', name: 'Grécia', continent: 'EUROPE', flag: '🇬🇷' },
  { code: 'WAL', name: 'País de Gales', continent: 'EUROPE', flag: '🏴' },
  { code: 'BUL', name: 'Bulgária', continent: 'EUROPE', flag: '🇧🇬' },
  { code: 'GEO', name: 'Geórgia', continent: 'EUROPE', flag: '🇬🇪' },
  { code: 'KOS', name: 'Kosovo', continent: 'EUROPE', flag: '🇽🇰' },
  { code: 'ARM', name: 'Armênia', continent: 'EUROPE', flag: '🇦🇲' },
  { code: 'ISR', name: 'Israel', continent: 'EUROPE', flag: '🇮🇱' },
  // Africa
  { code: 'NGA', name: 'Nigéria', continent: 'AFRICA', flag: '🇳🇬' },
  { code: 'GHA', name: 'Gana', continent: 'AFRICA', flag: '🇬🇭' },
  { code: 'SEN', name: 'Senegal', continent: 'AFRICA', flag: '🇸🇳' },
  { code: 'MAR', name: 'Marrocos', continent: 'AFRICA', flag: '🇲🇦' },
  { code: 'EGY', name: 'Egito', continent: 'AFRICA', flag: '🇪🇬' },
  { code: 'CMR', name: 'Camarões', continent: 'AFRICA', flag: '🇨🇲' },
  { code: 'CIV', name: 'Costa do Marfim', continent: 'AFRICA', flag: '🇨🇮' },
  { code: 'RSA', name: 'África do Sul', continent: 'AFRICA', flag: '🇿🇦' },
  { code: 'ALG', name: 'Argélia', continent: 'AFRICA', flag: '🇩🇿' },
  { code: 'TUN', name: 'Tunísia', continent: 'AFRICA', flag: '🇹🇳' },
  { code: 'MLI', name: 'Mali', continent: 'AFRICA', flag: '🇲🇱' },
  { code: 'BFA', name: 'Burkina Faso', continent: 'AFRICA', flag: '🇧🇫' },
  { code: 'BEN', name: 'Benim', continent: 'AFRICA', flag: '🇧🇯' },
  { code: 'GUI', name: 'Guiné', continent: 'AFRICA', flag: '🇬🇳' },
  { code: 'TOG', name: 'Togo', continent: 'AFRICA', flag: '🇹🇬' },
  { code: 'COD', name: 'RD do Congo', continent: 'AFRICA', flag: '🇨🇩' },
  { code: 'COM', name: 'Comores', continent: 'AFRICA', flag: '🇰🇲' },
  { code: 'LBY', name: 'Líbia', continent: 'AFRICA', flag: '🇱🇾' },
  { code: 'GAM', name: 'Gâmbia', continent: 'AFRICA', flag: '🇬🇲' },
  // Asia
  { code: 'JPN', name: 'Japão', continent: 'ASIA', flag: '🇯🇵' },
  { code: 'KOR', name: 'Coreia do Sul', continent: 'ASIA', flag: '🇰🇷' },
  { code: 'KSA', name: 'Arábia Saudita', continent: 'ASIA', flag: '🇸🇦' },
  { code: 'IRN', name: 'Irã', continent: 'ASIA', flag: '🇮🇷' },
  { code: 'CHN', name: 'China', continent: 'ASIA', flag: '🇨🇳' },
  { code: 'IDN', name: 'Indonésia', continent: 'ASIA', flag: '🇮🇩' },
  { code: 'SYR', name: 'Síria', continent: 'ASIA', flag: '🇸🇾' },
  // North America
  { code: 'MEX', name: 'México', continent: 'NORTH_AMERICA', flag: '🇲🇽' },
  { code: 'USA', name: 'Estados Unidos', continent: 'NORTH_AMERICA', flag: '🇺🇸' },
  { code: 'CRC', name: 'Costa Rica', continent: 'NORTH_AMERICA', flag: '🇨🇷' },
  { code: 'CAN', name: 'Canadá', continent: 'NORTH_AMERICA', flag: '🇨🇦' },
  { code: 'SUR', name: 'Suriname', continent: 'NORTH_AMERICA', flag: '🇸🇷' },
  // Oceania
  { code: 'AUS', name: 'Austrália', continent: 'OCEANIA', flag: '🇦🇺' },

  // Every country the shipped club database actually contains. Without these, the importer silently
  // dropped every club in them — 84 of the 144 country codes in content/clubs.csv, including Russia,
  // Denmark, Ireland and a New Zealand league of 33 clubs.
  { code: 'RUS', name: 'Rússia', continent: 'EUROPE', flag: '🇷🇺' },
  { code: 'IRL', name: 'Irlanda', continent: 'EUROPE', flag: '🇮🇪' },
  { code: 'ROU', name: 'Romênia', continent: 'EUROPE', flag: '🇷🇴' },
  { code: 'BLR', name: 'Bielorrússia', continent: 'EUROPE', flag: '🇧🇾' },
  { code: 'MNE', name: 'Montenegro', continent: 'EUROPE', flag: '🇲🇪' },
  { code: 'MDA', name: 'Moldávia', continent: 'EUROPE', flag: '🇲🇩' },
  { code: 'CYP', name: 'Chipre', continent: 'EUROPE', flag: '🇨🇾' },
  { code: 'ALB', name: 'Albânia', continent: 'EUROPE', flag: '🇦🇱' },
  { code: 'MKD', name: 'Macedônia do Norte', continent: 'EUROPE', flag: '🇲🇰' },
  { code: 'MLT', name: 'Malta', continent: 'EUROPE', flag: '🇲🇹' },
  { code: 'LTU', name: 'Lituânia', continent: 'EUROPE', flag: '🇱🇹' },
  { code: 'LVA', name: 'Letônia', continent: 'EUROPE', flag: '🇱🇻' },
  { code: 'FRO', name: 'Ilhas Faroe', continent: 'EUROPE', flag: '🇫🇴' },
  { code: 'GIB', name: 'Gibraltar', continent: 'EUROPE', flag: '🇬🇮' },
  { code: 'AND', name: 'Andorra', continent: 'EUROPE', flag: '🇦🇩' },
  { code: 'SMR', name: 'San Marino', continent: 'EUROPE', flag: '🇸🇲' },
  { code: 'LIE', name: 'Liechtenstein', continent: 'EUROPE', flag: '🇱🇮' },
  { code: 'KAZ', name: 'Cazaquistão', continent: 'EUROPE', flag: '🇰🇿' },
  { code: 'AZE', name: 'Azerbaijão', continent: 'EUROPE', flag: '🇦🇿' },
  { code: 'QAT', name: 'Catar', continent: 'ASIA', flag: '🇶🇦' },
  { code: 'THA', name: 'Tailândia', continent: 'ASIA', flag: '🇹🇭' },
  { code: 'UAE', name: 'Emirados Árabes', continent: 'ASIA', flag: '🇦🇪' },
  { code: 'IRQ', name: 'Iraque', continent: 'ASIA', flag: '🇮🇶' },
  { code: 'LBN', name: 'Líbano', continent: 'ASIA', flag: '🇱🇧' },
  { code: 'JOR', name: 'Jordânia', continent: 'ASIA', flag: '🇯🇴' },
  { code: 'IND', name: 'Índia', continent: 'ASIA', flag: '🇮🇳' },
  { code: 'VIE', name: 'Vietnã', continent: 'ASIA', flag: '🇻🇳' },
  { code: 'UZB', name: 'Uzbequistão', continent: 'ASIA', flag: '🇺🇿' },
  { code: 'TJK', name: 'Tajiquistão', continent: 'ASIA', flag: '🇹🇯' },
  { code: 'MYS', name: 'Malásia', continent: 'ASIA', flag: '🇲🇾' },
  { code: 'HKG', name: 'Hong Kong', continent: 'ASIA', flag: '🇭🇰' },
  { code: 'MMR', name: 'Mianmar', continent: 'ASIA', flag: '🇲🇲' },
  { code: 'SGP', name: 'Singapura', continent: 'ASIA', flag: '🇸🇬' },
  { code: 'PHI', name: 'Filipinas', continent: 'ASIA', flag: '🇵🇭' },
  { code: 'PRK', name: 'Coreia do Norte', continent: 'ASIA', flag: '🇰🇵' },
  { code: 'ANG', name: 'Angola', continent: 'AFRICA', flag: '🇦🇴' },
  { code: 'COG', name: 'Congo', continent: 'AFRICA', flag: '🇨🇬' },
  { code: 'ZIM', name: 'Zimbábue', continent: 'AFRICA', flag: '🇿🇼' },
  { code: 'ZAM', name: 'Zâmbia', continent: 'AFRICA', flag: '🇿🇲' },
  { code: 'SDN', name: 'Sudão', continent: 'AFRICA', flag: '🇸🇩' },
  { code: 'MOZ', name: 'Moçambique', continent: 'AFRICA', flag: '🇲🇿' },
  { code: 'ETH', name: 'Etiópia', continent: 'AFRICA', flag: '🇪🇹' },
  { code: 'TAN', name: 'Tanzânia', continent: 'AFRICA', flag: '🇹🇿' },
  { code: 'UGA', name: 'Uganda', continent: 'AFRICA', flag: '🇺🇬' },
  { code: 'GUA', name: 'Guatemala', continent: 'NORTH_AMERICA', flag: '🇬🇹' },
  { code: 'NIC', name: 'Nicarágua', continent: 'NORTH_AMERICA', flag: '🇳🇮' },
  { code: 'PAN', name: 'Panamá', continent: 'NORTH_AMERICA', flag: '🇵🇦' },
  { code: 'HAI', name: 'Haiti', continent: 'NORTH_AMERICA', flag: '🇭🇹' },
  { code: 'DOM', name: 'República Dominicana', continent: 'NORTH_AMERICA', flag: '🇩🇴' },
  { code: 'SLV', name: 'El Salvador', continent: 'NORTH_AMERICA', flag: '🇸🇻' },
  { code: 'HON', name: 'Honduras', continent: 'NORTH_AMERICA', flag: '🇭🇳' },
  { code: 'CUB', name: 'Cuba', continent: 'NORTH_AMERICA', flag: '🇨🇺' },
  { code: 'BLZ', name: 'Belize', continent: 'NORTH_AMERICA', flag: '🇧🇿' },
  { code: 'JAM', name: 'Jamaica', continent: 'NORTH_AMERICA', flag: '🇯🇲' },
  { code: 'TRI', name: 'Trinidad e Tobago', continent: 'NORTH_AMERICA', flag: '🇹🇹' },
  { code: 'NZL', name: 'Nova Zelândia', continent: 'OCEANIA', flag: '🇳🇿' },
  { code: 'VAN', name: 'Vanuatu', continent: 'OCEANIA', flag: '🇻🇺' },
  { code: 'PNG', name: 'Papua-Nova Guiné', continent: 'OCEANIA', flag: '🇵🇬' },
  { code: 'NCL', name: 'Nova Caledônia', continent: 'OCEANIA', flag: '🇳🇨' },
  { code: 'SOL', name: 'Ilhas Salomão', continent: 'OCEANIA', flag: '🇸🇧' },
  { code: 'FIJ', name: 'Fiji', continent: 'OCEANIA', flag: '🇫🇯' },
];

export function isValidCountryCode(code: string): boolean {
  return COUNTRIES.some((c) => c.code === code);
}

export function getCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/**
 * Country codes the club database spells differently from the registry above.
 *
 * The shipped data uses Portuguese-flavoured codes — DIN for Denmark, SUE for Sweden, NIG for Nigeria —
 * and in several cases two different codes for the same country (AZE and AZB, TCH and REP, ELV and ESL).
 * Registering each spelling as its own country would be worse than dropping them: Nigeria would exist
 * twice, each half with its own league, and neither would be the Nigerian championship.
 *
 * So they are resolved to one canonical country on the way in (see `canonicalCountryCode`), and the game
 * only ever stores the canonical code.
 */
export const COUNTRY_CODE_ALIASES: Record<string, string> = {
  'UCR': 'UKR',
  'DIN': 'DEN',
  'SUE': 'SWE',
  'SLK': 'SVK',
  'SER': 'SRB',
  'BOS': 'BIH',
  'TCH': 'CZE',
  'REP': 'CZE',
  'ELV': 'SVN',
  'ESL': 'SVN',
  'COS': 'CRC',
  'NIG': 'NGA',
  'CAM': 'CMR',
  'CMA': 'CIV',
  'ARL': 'ALG',
  'LIB': 'LBY',
  'RDC': 'COD',
  'SIR': 'SYR',
  'CHP': 'CYP',
  'CAZ': 'KAZ',
  'AZB': 'AZE',
  'ROM': 'ROU',
  'BIE': 'BLR',
  'MON': 'MNE',
  'MOL': 'MDA',
  'MTA': 'MLT',
  'LIT': 'LTU',
  'LET': 'LVA',
  'CAT': 'QAT',
  'TAI': 'THA',
  'EMI': 'UAE',
  'IRA': 'IRQ',
  'LEB': 'LBN',
  'UBZ': 'UZB',
  'TAJ': 'TJK',
  'MAL': 'MYS',
  'MIA': 'MMR',
  'SIN': 'SGP',
  'FIL': 'PHI',
  'CRN': 'PRK',
  'CON': 'COG',
  'SUD': 'SDN',
  'MOC': 'MOZ',
  'ETI': 'ETH',
  'RDO': 'DOM',
  'ELS': 'SLV',
  'TTB': 'TRI',
  'NZE': 'NZL',
  'PAP': 'PNG',
  'NCA': 'NCL'
};

/** The registry's code for a country, whichever spelling arrived. Unknown codes are returned unchanged. */
export function canonicalCountryCode(code: string): string {
  return COUNTRY_CODE_ALIASES[code] ?? code;
}
