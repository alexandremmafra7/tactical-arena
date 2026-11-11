import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import type {
  Club,
  CustomChampionshipConfig,
  TournamentFormatType,
  DivisionRoundsFormat,
  CupTieFormat,
} from '@tactical-arena/shared';
import {
  COUNTRIES,
  validateCustomChampionshipConfig,
} from '@tactical-arena/shared';
import { listAllClubsForEditor, createCustomChampionship } from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { TrophyIcon, StarIcon, GlobeIcon } from '../components/icons/AppIcons.js';

function normalizeKey(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getClubPower(club: Club): number {
  if (!club.players || club.players.length === 0) return 50;
  const overalls = club.players.map((p) => p.overall || 50).sort((a, b) => b - a);
  const top11 = overalls.slice(0, 11);
  return top11.reduce((sum, val) => sum + val, 0) / top11.length;
}

function isOfficialClub(c: Club): boolean {
  if (!c.slug) return false;
  const s = c.slug.toLowerCase();
  const n = c.name.toLowerCase();
  if (s.startsWith('test-') || s.startsWith('slug-real-') || s.includes('exemplo')) return false;
  if (n.includes('bot') || n.includes('estudantil') || n.includes('exemplo') || n.includes('abandoned') || n.includes('vendedor')) return false;
  return true;
}

const BRAZIL_ELITE_KEYS = [
  'flamengo', 'palmeiras', 'sao-paulo', 'saopaulo', 'corinthians', 'santos',
  'gremio', 'internacional', 'cruzeiro', 'atletico-mg', 'atleticomineiro', 'fluminense',
  'botafogo', 'vasco-da-gama', 'vasco', 'vascodagama', 'bahia',
  'atletico-paranaense', 'athletico-pr', 'athleticopr', 'athleticoparanaense', 'fortaleza',
  'rb-bragantino', 'bragantino', 'vitoria', 'coritiba', 'coritiba_bra',
  'sport', 'sport-recife', 'sportrecife', 'goias', 'ceara', 'ceara_bra',
  'cuiaba', 'criciuma', 'juventude', 'atletico-goianiense', 'atleticogoianiense',
  'america-mg', 'americamg_bra', 'americamg', 'chapecoense', 'chapecoense_bra',
  'mirassol', 'avai', 'avai_bra', 'figueirense', 'ponte-preta', 'pontepreta_bra',
  'novorizontino', 'novorinzontino_sp', 'crb', 'crb_bra', 'vila-nova', 'vilago',
  'remo', 'paysandu', 'nautico', 'santa-cruz', 'santa', 'parana'
];

const EURO_ELITE_KEYS = [
  'real-madrid', 'realmadrid', 'manchester-city', 'manchestercity', 'bayern', 'bayernmunique',
  'barcelona', 'liverpool', 'arsenal', 'psg', 'parissaintgermain', 'parissaintgermain_fr',
  'inter-milan', 'interdemilao', 'chelsea', 'atletico-madrid', 'atleticodemadrid',
  'juventus', 'ac-milan', 'milan', 'borussia-dortmund', 'dortmund', 'tottenham',
  'manchester-united', 'manchesterunited', 'leverkusen', 'bayer-leverkusen', 'bayerleverkusen',
  'napoli', 'aston-villa', 'astonvilla', 'roma', 'asroma', 'rb-leipzig', 'rbleipzig',
  'lazio', 'atalanta', 'porto', 'fcporto', 'benfica', 'benfica_por', 'slbenfica',
  'sporting', 'sporting_por', 'sportingcp', 'ajax', 'ajax_hol', 'afcajax',
  'monaco', 'marseille', 'lyon', 'newcastle', 'athletic-club', 'athleticbilbao',
  'real-sociedad', 'realsociedad', 'villarreal', 'sevilla', 'eintracht-frankfurt',
  'stuttgart', 'fiorentina', 'lille', 'feyenoord', 'psv', 'galatasaray', 'fenerbahce'
];

const SOUTH_AMERICA_ELITE_KEYS = [
  'boca-juniors', 'bocajuniors_arg', 'bocajuniors', 'river-plate', 'riverplate_arg', 'riverplate',
  'flamengo', 'palmeiras', 'sao-paulo', 'saopaulo', 'corinthians', 'santos',
  'gremio', 'internacional', 'cruzeiro', 'atletico-mg', 'atleticomineiro', 'fluminense',
  'botafogo', 'vasco-da-gama', 'vasco', 'penarol', 'nacional', 'olimpia', 'olimpia_par',
  'cerro-porteno', 'cerroporteno', 'colo-colo', 'colocolo_chi', 'colocolo',
  'racing-club', 'racing_arg', 'racing', 'independiente_arg', 'independiente',
  'sanlorenzo_ar', 'sanlorenzo', 'velezsarsfield_arg', 'velez', 'estudiantes_ar', 'estudiantes',
  'bahia', 'atletico-paranaense', 'fortaleza', 'atletico-nacional', 'nacional_col',
  'millonarios_col', 'ldu-quito', 'lduquito', 'barcelona-sc', 'barcelonasc',
  'independiente-del-valle', 'junior-fc', 'deportes-tolima', 'alianza-lima', 'universitario'
];

const GLOBAL_ELITE_KEYS = [
  'real-madrid', 'manchester-city', 'bayern', 'barcelona', 'liverpool',
  'arsenal', 'psg', 'inter-milan', 'chelsea', 'atletico-madrid',
  'juventus', 'ac-milan', 'borussia-dortmund', 'tottenham', 'manchester-united',
  'flamengo', 'palmeiras', 'boca-juniors', 'bocajuniors_arg', 'river-plate', 'riverplate_arg',
  'leverkusen', 'napoli', 'porto', 'sao-paulo', 'corinthians', 'al-hilal', 'al-nassr',
  'inter-miami-cf', 'benfica', 'benfica_por', 'sporting', 'sporting_por', 'ajax', 'ajax_hol'
];

function rankClubsWithPriority(candidateClubs: Club[], priorityKeys: string[]): Club[] {
  const priorityIndex = new Map<string, number>();
  priorityKeys.forEach((key, idx) => {
    priorityIndex.set(normalizeKey(key), idx);
  });

  const getPriorityScore = (c: Club): number => {
    if (c.slug && priorityIndex.has(normalizeKey(c.slug))) {
      return priorityIndex.get(normalizeKey(c.slug))!;
    }
    const cleanName = normalizeKey(c.name);
    if (priorityIndex.has(cleanName)) {
      return priorityIndex.get(cleanName)!;
    }
    return 9999;
  };

  return [...candidateClubs].sort((a, b) => {
    const pA = getPriorityScore(a);
    const pB = getPriorityScore(b);
    if (pA !== pB) return pA - pB;

    const officialA = isOfficialClub(a) ? 1 : 0;
    const officialB = isOfficialClub(b) ? 1 : 0;
    if (officialA !== officialB) return officialB - officialA;

    const divA = a.division ?? 1;
    const divB = b.division ?? 1;
    if (divA !== divB) return divA - divB;

    const powerA = getClubPower(a);
    const powerB = getClubPower(b);
    if (Math.abs(powerB - powerA) > 0.05) return powerB - powerA;

    return (b.stadiumCapacity || 0) - (a.stadiumCapacity || 0);
  });
}

export function CustomChampionshipWizard() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 state
  const [championshipName, setChampionshipName] = useState('Superliga Mundial 2026');
  const [formatType, setFormatType] = useState<TournamentFormatType>('LEAGUE_WITH_PLAYOFFS');
  const [divisionCount, setDivisionCount] = useState<number>(1);
  const [clubsPerDivision, setClubsPerDivision] = useState<number>(10);
  const [roundsFormat, setRoundsFormat] = useState<DivisionRoundsFormat>('DOUBLE');
  const [playoffSpots, setPlayoffSpots] = useState<4 | 8>(4);
  const [playoffTieFormat, setPlayoffTieFormat] = useState<CupTieFormat>('SINGLE_LEG');
  const [cupEnabled, setCupEnabled] = useState<boolean>(true);
  const [cupTieFormat, setCupTieFormat] = useState<CupTieFormat>('SINGLE_LEG');

  // Step 2 state: Club selection
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [selectedClubIdsByDivision, setSelectedClubIdsByDivision] = useState<Record<number, string[]>>({ 1: [], 2: [], 3: [], 4: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountryAdd, setSelectedCountryAdd] = useState('BRA');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countryFilterText, setCountryFilterText] = useState('');
  const [targetDivisionAdd, setTargetDivisionAdd] = useState<number>(1);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Step 3 state: User club & manager
  const [userClubId, setUserClubId] = useState<string>('');
  const [managerName, setManagerName] = useState('Técnico Campeão');

  // General state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function getCountryName(code: string): string {
    if (!code) return '';
    const clean = code.toUpperCase();
    const found = COUNTRIES.find((c) => c.code.toUpperCase() === clean);
    return found?.name || clean;
  }

  // Click outside to close country dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCountryDropdownOpen]);

  useEffect(() => {
    (async () => {
      try {
        const clubs = await listAllClubsForEditor();
        setAllClubs(clubs);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar base de clubes.');
      } finally {
        setLoadingClubs(false);
      }
    })();
  }, []);

  const countryOptions = useMemo(() => {
    const codeCounts = new Map<string, number>();
    for (const c of allClubs) {
      codeCounts.set(c.country, (codeCounts.get(c.country) || 0) + 1);
    }
    return Array.from(codeCounts.entries())
      .map(([code, count]) => ({
        code,
        name: getCountryName(code),
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allClubs]);

  const filteredCountryOptions = useMemo(() => {
    const query = countryFilterText.trim().toLowerCase();
    if (!query) return countryOptions;
    return countryOptions.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [countryOptions, countryFilterText]);

  // Quick Presets
  function applyPreset(preset: 'TOP_20_GLOBAL' | 'BRAZIL_SERIE_A' | 'EURO_ELITE' | 'SOUTH_AMERICA') {
    let chosen: Club[] = [];
    if (preset === 'TOP_20_GLOBAL') {
      chosen = rankClubsWithPriority(allClubs, GLOBAL_ELITE_KEYS);
    } else if (preset === 'BRAZIL_SERIE_A') {
      const braClubs = allClubs.filter((c) => c.country === 'BRA');
      chosen = rankClubsWithPriority(braClubs, BRAZIL_ELITE_KEYS);
    } else if (preset === 'EURO_ELITE') {
      const euroCountries = ['ENG', 'ESP', 'ITA', 'GER', 'FRA', 'POR', 'NED', 'SCO', 'TUR', 'BEL'];
      const euroClubs = allClubs.filter((c) => euroCountries.includes(c.country));
      chosen = rankClubsWithPriority(euroClubs, EURO_ELITE_KEYS);
    } else if (preset === 'SOUTH_AMERICA') {
      const saCountries = ['BRA', 'ARG', 'URU', 'COL', 'CHI', 'PAR', 'ECU', 'PER', 'BOL', 'VEN'];
      const saClubs = allClubs.filter((c) => saCountries.includes(c.country));
      chosen = rankClubsWithPriority(saClubs, SOUTH_AMERICA_ELITE_KEYS);
    }

    if (chosen.length < 2) {
      setError('O preset selecionado não encontrou clubes suficientes.');
      return;
    }

    // Populate all configured divisions sequentially
    const newDivisionMap: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
    let offset = 0;
    for (let d = 1; d <= divisionCount; d++) {
      const slice = chosen.slice(offset, offset + clubsPerDivision).map((c) => c.id);
      newDivisionMap[d] = slice;
      offset += slice.length;
    }

    setSelectedClubIdsByDivision(newDivisionMap);
    if (newDivisionMap[1]?.length > 0) {
      setUserClubId(newDivisionMap[1][0]);
    }
    setError(null);
  }

  function addCountryToDivision(countryCode: string, divNum: number) {
    const rawClubs = allClubs.filter((c) => c.country === countryCode);
    const keys =
      countryCode === 'BRA'
        ? BRAZIL_ELITE_KEYS
        : ['ARG', 'URU', 'PAR', 'CHI', 'COL', 'ECU', 'PER', 'BOL', 'VEN'].includes(countryCode)
        ? SOUTH_AMERICA_ELITE_KEYS
        : EURO_ELITE_KEYS;
    const countryClubs = rankClubsWithPriority(rawClubs, keys);
    const current = selectedClubIdsByDivision[divNum] || [];
    const needed = clubsPerDivision - current.length;
    if (needed <= 0) {
      setError(`A divisão ${divNum} já atingiu o limite de ${clubsPerDivision} clubes.`);
      return;
    }
    const toAdd = countryClubs.filter((c) => !current.includes(c.id)).slice(0, needed).map((c) => c.id);
    const updated = [...current, ...toAdd];
    setSelectedClubIdsByDivision({ ...selectedClubIdsByDivision, [divNum]: updated });
    if (!userClubId && updated.length > 0) setUserClubId(updated[0]);
    setError(null);
  }

  function toggleClubSelection(clubId: string, divNum: number) {
    const current = selectedClubIdsByDivision[divNum] || [];
    if (current.includes(clubId)) {
      setSelectedClubIdsByDivision({
        ...selectedClubIdsByDivision,
        [divNum]: current.filter((id) => id !== clubId),
      });
    } else {
      if (current.length >= clubsPerDivision) {
        setError(`A divisão ${divNum} já tem o máximo de ${clubsPerDivision} clubes.`);
        return;
      }
      const updatedMap = { ...selectedClubIdsByDivision };
      for (const d of Object.keys(updatedMap)) {
        updatedMap[Number(d)] = updatedMap[Number(d)].filter((id) => id !== clubId);
      }
      updatedMap[divNum] = [...(updatedMap[divNum] || []), clubId];
      setSelectedClubIdsByDivision(updatedMap);
      if (!userClubId) setUserClubId(clubId);
      setError(null);
    }
  }

  function buildConfig(): CustomChampionshipConfig {
    const activeDivisions = [];
    for (let i = 1; i <= divisionCount; i++) {
      const clubIds = selectedClubIdsByDivision[i] || [];
      activeDivisions.push({
        division: i,
        name: divisionCount === 1 ? championshipName : `Divisão ${i} - ${championshipName}`,
        clubIds,
        roundsFormat,
        promotionCount: i < divisionCount ? 2 : 0,
        relegationCount: i > 1 ? 2 : 0,
        playoffs: formatType === 'LEAGUE_WITH_PLAYOFFS' && i === 1 ? {
          qualifyingSpots: playoffSpots,
          tieFormat: playoffTieFormat,
          hasThirdPlaceMatch: true,
          neutralFinal: true,
        } : undefined,
      });
    }

    const allAssignedClubIds = activeDivisions.flatMap((d) => d.clubIds);
    const cupConfig = cupEnabled && allAssignedClubIds.length >= 8 ? {
      name: `Copa ${championshipName}`,
      clubIds: allAssignedClubIds.slice(0, 16).length >= 16 ? allAssignedClubIds.slice(0, 16) : allAssignedClubIds.slice(0, 8),
      tieFormat: cupTieFormat,
    } : undefined;

    return {
      id: `custom_${Date.now()}`,
      name: championshipName,
      formatType,
      divisions: activeDivisions,
      cup: cupConfig,
      settings: {
        isContinuousCareer: true,
        allowTransfers: true,
        injuriesAndSuspensions: true,
      },
    };
  }

  function handleNextStep() {
    setError(null);
    if (step === 1) {
      if (!championshipName.trim()) {
        setError('Informe o nome do campeonato.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const totalSelected = Array.from({ length: divisionCount }, (_, i) => selectedClubIdsByDivision[i + 1] || []).flat();
      if (totalSelected.length < 2) {
        setError('Selecione pelo menos 2 clubes no total para iniciar o campeonato.');
        return;
      }
      for (let i = 1; i <= divisionCount; i++) {
        const count = (selectedClubIdsByDivision[i] || []).length;
        if (count < 2 || count % 2 !== 0) {
          setError(`A Divisão ${i} precisa de um número par de clubes (mínimo 2). Atual: ${count}.`);
          return;
        }
      }
      if (!userClubId || !totalSelected.includes(userClubId)) {
        setUserClubId(totalSelected[0]);
      }
      setStep(3);
    } else if (step === 3) {
      if (!userClubId) {
        setError('Selecione o clube que você irá treinar.');
        return;
      }
      if (!managerName.trim()) {
        setError('Informe o nome do treinador.');
        return;
      }
      setStep(4);
    }
  }

  async function handleFinish() {
    setError(null);
    setSubmitting(true);
    try {
      const config = buildConfig();
      const validation = validateCustomChampionshipConfig(config);
      if (!validation.valid) {
        setError(validation.errors.join('; '));
        setSubmitting(false);
        return;
      }
      const allSelectedClubIds = new Set<string>();
      for (let d = 1; d <= divisionCount; d++) {
        for (const cid of selectedClubIdsByDivision[d] || []) {
          allSelectedClubIds.add(cid);
        }
      }
      if (userClubId) allSelectedClubIds.add(userClubId);

      const selectedClubs = allClubs.filter((c) => allSelectedClubIds.has(c.id));
      const result = await createCustomChampionship(config, userClubId, managerName, selectedClubs);
      if (result.token && result.userId) {
        signIn(result.token, result.userId);
      }
      navigate(`/clubs/${result.club.id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar campeonato personalizado.');
      setSubmitting(false);
    }
  }

  const assignedDivisionByClubId = useMemo(() => {
    const map = new Map<string, number>();
    for (let d = 1; d <= divisionCount; d++) {
      for (const id of selectedClubIdsByDivision[d] || []) {
        map.set(id, d);
      }
    }
    return map;
  }, [selectedClubIdsByDivision, divisionCount]);

  const allAssignedIds = useMemo(() => new Set(assignedDivisionByClubId.keys()), [assignedDivisionByClubId]);

  const filteredClubs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = allClubs;
    if (term) {
      list = allClubs.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(term);
        const codeMatch = c.country.toLowerCase().includes(term);
        const countryNameMatch = getCountryName(c.country).toLowerCase().includes(term);
        return nameMatch || codeMatch || countryNameMatch;
      });
    }
    return [...list].sort((a, b) => {
      // Selected clubs first
      const aSel = allAssignedIds.has(a.id) ? 1 : 0;
      const bSel = allAssignedIds.has(b.id) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;

      // Division preference (div 1 first)
      const divA = a.division ?? 1;
      const divB = b.division ?? 1;
      if (divA !== divB) return divA - divB;

      // Top 11 squad power
      const powerA = getClubPower(a);
      const powerB = getClubPower(b);
      if (Math.abs(powerB - powerA) > 0.1) return powerB - powerA;

      return (b.stadiumCapacity || 0) - (a.stadiumCapacity || 0);
    });
  }, [allClubs, searchTerm, allAssignedIds]);

  const selectedUserClub = useMemo(() => {
    return allClubs.find((c) => c.id === userClubId) || null;
  }, [allClubs, userClubId]);

  if (loadingClubs) {
    return <div className="page" style={{ textAlign: 'center', padding: 60 }}>Carregando clubes e dados do mundo...</div>;
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#16141d',
    border: '1px solid #383142',
    borderRadius: 6,
    color: '#f8fafc',
    fontSize: '0.95rem',
    colorScheme: 'dark',
  };

  const optionStyle: React.CSSProperties = {
    background: '#1a1722',
    color: '#f8fafc',
  };

  return (
    <div className="page" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      <header className="topbar" style={{ marginBottom: 20 }}>
        <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <TrophyIcon size={24} color="var(--accent, #f59e0b)" />
          Criar Campeonato Personalizado
        </h1>
        <div className="topbar-actions">
          <Link className="btn-secondary" to="/">
            ← Menu Principal
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { num: 1, label: '1. Estrutura' },
          { num: 2, label: '2. Clubes' },
          { num: 3, label: '3. Técnico' },
          { num: 4, label: '4. Confirmação' },
        ].map((s) => (
          <div
            key={s.num}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              textAlign: 'center',
              fontWeight: 600,
              background: step === s.num ? 'var(--accent)' : 'var(--bg-card)',
              color: step === s.num ? '#000' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {s.label}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--error)', color: 'var(--error)', padding: 12, borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2>Estrutura e Formato do Torneio</h2>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nome do Campeonato</label>
            <input
              type="text"
              value={championshipName}
              onChange={(e) => setChampionshipName(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Tipo de Competição</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { id: 'LEAGUE_WITH_PLAYOFFS', label: 'Pontos Corridos + Playoffs', desc: 'Liga regular seguida de mata-mata final' },
                { id: 'LEAGUE_PURE', label: 'Pontos Corridos Puro', desc: 'Campeonato tradicional por pontos' },
                { id: 'CUSTOM_PYRAMID', label: 'Pirâmide com Divisões', desc: 'Múltiplas divisões com acesso e descenso' },
                { id: 'CUP_KNOCKOUT', label: 'Copa Eliminatória Pura', desc: 'Mata-mata de 8, 16 ou 32 clubes' },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setFormatType(t.id as TournamentFormatType)}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: formatType === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: formatType === t.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-card)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {formatType === 'CUSTOM_PYRAMID' && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Número de Divisões (1 a 4)</label>
              <select
                value={divisionCount}
                onChange={(e) => setDivisionCount(Number(e.target.value))}
                style={fieldStyle}
              >
                <option value={2} style={optionStyle}>2 Divisões</option>
                <option value={3} style={optionStyle}>3 Divisões</option>
                <option value={4} style={optionStyle}>4 Divisões</option>
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Clubes por Divisão</label>
              <select
                value={clubsPerDivision}
                onChange={(e) => setClubsPerDivision(Number(e.target.value))}
                style={fieldStyle}
              >
                <option value={8} style={optionStyle}>8 Clubes</option>
                <option value={10} style={optionStyle}>10 Clubes</option>
                <option value={12} style={optionStyle}>12 Clubes</option>
                <option value={16} style={optionStyle}>16 Clubes</option>
                <option value={20} style={optionStyle}>20 Clubes</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Formato de Confrontos</label>
              <select
                value={roundsFormat}
                onChange={(e) => setRoundsFormat(e.target.value as DivisionRoundsFormat)}
                style={fieldStyle}
              >
                <option value="DOUBLE" style={optionStyle}>Ida e Volta (Turno e Returno)</option>
                <option value="SINGLE" style={optionStyle}>Turno Único</option>
              </select>
            </div>
          </div>

          {formatType === 'LEAGUE_WITH_PLAYOFFS' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Vagas para Playoffs</label>
                <select
                  value={playoffSpots}
                  onChange={(e) => setPlayoffSpots(Number(e.target.value) as 4 | 8)}
                  style={fieldStyle}
                >
                  <option value={4} style={optionStyle}>Top 4 (Semifinais e Final)</option>
                  <option value={8} style={optionStyle}>Top 8 (Quartas, Semis e Final)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Formato do Mata-Mata</label>
                <select
                  value={playoffTieFormat}
                  onChange={(e) => setPlayoffTieFormat(e.target.value as CupTieFormat)}
                  style={fieldStyle}
                >
                  <option value="SINGLE_LEG" style={optionStyle}>Jogo Único</option>
                  <option value="TWO_LEGS" style={optionStyle}>Ida e Volta</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn-primary-action" onClick={handleNextStep}>
              Avançar para Seleção de Clubes →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2>Seleção de Clubes</h2>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Presets Rápidos em 1 Clique</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary" onClick={() => applyPreset('TOP_20_GLOBAL')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <StarIcon size={16} fill="var(--accent, #f59e0b)" color="var(--accent, #f59e0b)" /> Top 20 Mundial
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyPreset('BRAZIL_SERIE_A')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CountryFlag code="BRA" size={16} /> Gigantes do Brasil
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyPreset('EURO_ELITE')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <GlobeIcon size={16} color="var(--accent, #f59e0b)" /> Elite Europeia
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyPreset('SOUTH_AMERICA')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <GlobeIcon size={16} color="var(--accent, #f59e0b)" /> Clássicos Sul-Americanos
              </button>
            </div>
          </div>

          {/* Adicionar País Inteiro com CountryPicker customizado em dark theme e com bandeiras */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              background: '#16141d',
              border: '1px solid #383142',
              padding: 12,
              borderRadius: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>Adicionar País Inteiro:</span>

            {/* Custom Dropdown Trigger */}
            <div style={{ position: 'relative' }} ref={countryDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  background: '#1a1722',
                  border: '1px solid #3d3548',
                  borderRadius: 6,
                  color: '#f8fafc',
                  cursor: 'pointer',
                  fontSize: '0.92rem',
                  minWidth: 230,
                  textAlign: 'left',
                }}
              >
                <CountryFlag code={selectedCountryAdd} size={18} title={getCountryName(selectedCountryAdd)} />
                <span style={{ fontWeight: 600, flex: 1 }}>{getCountryName(selectedCountryAdd)}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: 6 }}>({selectedCountryAdd})</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>▾</span>
              </button>

              {/* Floating Dropdown Panel */}
              {isCountryDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    zIndex: 1000,
                    width: 320,
                    background: '#16141e',
                    border: '1px solid #4a3e59',
                    borderRadius: 8,
                    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: 8, borderBottom: '1px solid #2d2638', background: '#121018' }}>
                    <input
                      type="text"
                      placeholder="Filtrar país por nome ou sigla..."
                      value={countryFilterText}
                      onChange={(e) => setCountryFilterText(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: '#1c1826',
                        border: '1px solid #383142',
                        borderRadius: 6,
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: 280 }}>
                    {filteredCountryOptions.length === 0 ? (
                      <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                        Nenhum país encontrado
                      </div>
                    ) : (
                      filteredCountryOptions.map((c) => {
                        const isCurrent = selectedCountryAdd === c.code;
                        return (
                          <div
                            key={c.code}
                            onClick={() => {
                              setSelectedCountryAdd(c.code);
                              setIsCountryDropdownOpen(false);
                              setCountryFilterText('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              background: isCurrent ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                              borderLeft: isCurrent ? '3px solid var(--accent, #f59e0b)' : '3px solid transparent',
                              color: '#f8fafc',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = '#241f30';
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <CountryFlag code={c.code} size={18} title={c.name} />
                            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name}</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>({c.code})</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--accent, #f59e0b)' }}>
                              {c.count} {c.count === 1 ? 'clube' : 'clubes'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Divisão destino se houver mais de 1 divisão */}
            {divisionCount > 1 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>para a</span>
                <select
                  value={targetDivisionAdd}
                  onChange={(e) => setTargetDivisionAdd(Number(e.target.value))}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: '#1a1722',
                    border: '1px solid #383142',
                    color: '#f8fafc',
                    colorScheme: 'dark',
                  }}
                >
                  {Array.from({ length: divisionCount }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d} style={optionStyle}>
                      Divisão {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              className="btn-primary-action"
              onClick={() => addCountryToDivision(selectedCountryAdd, targetDivisionAdd)}
            >
              + Adicionar à Divisão {targetDivisionAdd} ({allClubs.filter((c) => c.country === selectedCountryAdd).length} clubes)
            </button>
          </div>

          {Array.from({ length: divisionCount }, (_, i) => i + 1).map((divNum) => {
            const assigned = selectedClubIdsByDivision[divNum] || [];
            return (
              <div key={divNum} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ color: 'var(--accent)' }}>Divisão {divNum}</h4>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: assigned.length === clubsPerDivision ? 'var(--success)' : 'var(--text-muted)' }}>
                    [ {assigned.length} / {clubsPerDivision} clubes preenchidos ]
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 40, alignItems: 'center' }}>
                  {assigned.length === 0 ? (
                    <span className="muted" style={{ fontSize: '0.85rem' }}>Nenhum clube selecionado nesta divisão ainda. Clique abaixo para adicionar.</span>
                  ) : (
                    assigned.map((id) => {
                      const club = allClubs.find((c) => c.id === id);
                      if (!club) return null;
                      return (
                        <div
                          key={id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#16141d',
                            padding: '4px 10px',
                            borderRadius: 20,
                            border: '1px solid #383142',
                            fontSize: '0.85rem',
                            color: '#f8fafc',
                          }}
                        >
                          <ClubCrest club={club} size={16} />
                          <CountryFlag code={club.country} size={12} title={getCountryName(club.country)} />
                          <span>{club.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleClubSelection(id, divNum)}
                            style={{ background: 'none', border: 'none', color: 'var(--error, #ef4444)', cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}
                            title="Remover clube"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <label style={{ fontWeight: 600 }}>Buscar Clubes na Base ({allClubs.length} disponíveis)</label>
              <input
                type="text"
                placeholder="Buscar por nome, país ou sigla..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px 12px', width: 280, background: '#16141d', border: '1px solid #383142', borderRadius: 6, color: '#f8fafc', colorScheme: 'dark' }}
              />
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {filteredClubs.slice(0, 60).map((club) => {
                const assignedDiv = assignedDivisionByClubId.get(club.id);
                const isSelected = assignedDiv !== undefined;
                return (
                  <div
                    key={club.id}
                    onClick={() => toggleClubSelection(club.id, assignedDiv ?? targetDivisionAdd)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(34, 197, 94, 0.15)' : '#16141d',
                      border: isSelected ? '1px solid var(--success, #22c55e)' : '1px solid #2f2838',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ClubCrest club={club} size={28} />
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f8fafc' }}>
                        {club.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <CountryFlag code={club.country} size={13} title={getCountryName(club.country)} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getCountryName(club.country)}
                        </span>
                        <span style={{ opacity: 0.6 }}>({club.country})</span>
                      </div>
                    </div>
                    {isSelected && (
                      <span style={{ color: 'var(--success, #22c55e)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        ✓ {divisionCount > 1 ? `D${assignedDiv}` : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              ← Voltar
            </button>
            <button type="button" className="btn-primary-action" onClick={handleNextStep}>
              Avançar para Técnico e Clube →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2>Escolha do Seu Clube & Treinador</h2>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Selecione o Clube que você irá comandar</label>

            {selectedUserClub && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: '#16141d',
                  border: '1px solid #383142',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 12,
                }}
              >
                <ClubCrest club={selectedUserClub} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>{selectedUserClub.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#94a3b8', marginTop: 3 }}>
                    <CountryFlag code={selectedUserClub.country} size={15} title={getCountryName(selectedUserClub.country)} />
                    <span>{getCountryName(selectedUserClub.country)} ({selectedUserClub.country})</span>
                    <span>•</span>
                    <span style={{ color: 'var(--accent, #f59e0b)' }}>{selectedUserClub.players?.length ?? 0} jogadores</span>
                  </div>
                </div>
              </div>
            )}

            <select
              value={userClubId}
              onChange={(e) => setUserClubId(e.target.value)}
              style={fieldStyle}
            >
              {Array.from({ length: divisionCount }, (_, i) => i + 1).flatMap((divNum) =>
                (selectedClubIdsByDivision[divNum] || []).map((id) => {
                  const club = allClubs.find((c) => c.id === id);
                  if (!club) return null;
                  return (
                    <option key={id} value={id} style={optionStyle}>
                      [Divisão {divNum}] {club.name} — {getCountryName(club.country)} ({club.country})
                    </option>
                  );
                })
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nome do Treinador</label>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
              ← Voltar
            </button>
            <button type="button" className="btn-primary-action" onClick={handleNextStep}>
              Avançar para Confirmação →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2>Resumo e Confirmação do Campeonato</h2>
          <div style={{ background: '#16141d', border: '1px solid #383142', padding: 18, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12, color: '#f8fafc' }}>
            <div><strong>Nome:</strong> {championshipName}</div>
            <div><strong>Formato:</strong> {formatType}</div>
            <div><strong>Divisões:</strong> {divisionCount}</div>
            <div><strong>Total de Clubes Participantes:</strong> {Array.from({ length: divisionCount }, (_, i) => selectedClubIdsByDivision[i + 1] || []).flat().length}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>Seu Clube:</strong>
              {selectedUserClub ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <ClubCrest club={selectedUserClub} size={20} />
                  <CountryFlag code={selectedUserClub.country} size={14} title={getCountryName(selectedUserClub.country)} />
                  <span>{selectedUserClub.name} ({getCountryName(selectedUserClub.country)})</span>
                </span>
              ) : (
                userClubId
              )}
            </div>
            <div><strong>Treinador:</strong> {managerName}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => setStep(3)}>
              ← Voltar
            </button>
            <button
              type="button"
              className="btn-primary-action"
              onClick={handleFinish}
              disabled={submitting}
              style={{
                background: 'var(--success, #22c55e)',
                color: '#000',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {submitting ? (
                'Criando...'
              ) : (
                <>
                  <TrophyIcon size={18} color="#000" />
                  Iniciar Campeonato Personalizado
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
