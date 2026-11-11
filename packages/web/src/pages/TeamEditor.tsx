import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COUNTRIES } from '@tactical-arena/shared';
import type { Club, KitPattern, ModPack, Player, PlayerAttributes, Position, PreferredFoot } from '@tactical-arena/shared';
import {
  PlayerEditPatch,
  autoGenerateEditorSquad,
  createEditorClub,
  createEditorPlayer,
  deleteEditorPlayer,
  exportModPack,
  importModPack,
  listAllClubsForEditor,
  moveEditorTransfer,
  updateEditorClubIdentity,
  updateEditorPlayer,
  uploadEditorCrest,
} from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { TeamJersey } from '../components/TeamJersey.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { positionLabel } from '../lib/positionLabel.js';

const POSITIONS: Position[] = ['GK', 'DEF', 'LAT', 'MID', 'ATT'];
const ATTRIBUTE_KEYS: (keyof PlayerAttributes)[] = ['pace', 'finishing', 'passing', 'defending', 'physical', 'goalkeeping'];
const ATTRIBUTE_LABELS: Record<keyof PlayerAttributes, string> = {
  pace: 'Vel.',
  finishing: 'Fin.',
  passing: 'Pas.',
  defending: 'Mar.',
  physical: 'Fís.',
  goalkeeping: 'Gol.',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

interface PlayerRowProps {
  player: Player;
  onChange: (patch: PlayerEditPatch) => void;
  onDelete: () => void;
}

function PlayerRow({ player, onChange, onDelete }: PlayerRowProps) {
  const [local, setLocal] = useState({
    name: player.name,
    age: player.age,
    nationality: player.nationality,
    position: player.position,
    preferredFoot: player.preferredFoot,
    attributes: { ...player.attributes },
  });

  useEffect(() => {
    setLocal({
      name: player.name,
      age: player.age,
      nationality: player.nationality,
      position: player.position,
      preferredFoot: player.preferredFoot,
      attributes: { ...player.attributes },
    });
  }, [player]);

  return (
    <tr>
      <td>
        <input
          value={local.name}
          onChange={(e) => setLocal((prev) => ({ ...prev, name: e.target.value }))}
          onBlur={() => local.name !== player.name && onChange({ name: local.name })}
          style={{ width: 150 }}
        />
      </td>
      <td>
        <input
          type="number"
          value={local.age}
          onChange={(e) => setLocal((prev) => ({ ...prev, age: Number(e.target.value) }))}
          onBlur={() => local.age !== player.age && onChange({ age: local.age })}
          style={{ width: 52 }}
        />
      </td>
      <td>
        <input
          value={local.nationality}
          onChange={(e) => setLocal((prev) => ({ ...prev, nationality: e.target.value.toUpperCase() }))}
          onBlur={() => local.nationality !== player.nationality && onChange({ nationality: local.nationality })}
          style={{ width: 48 }}
        />
      </td>
      <td>
        <select
          value={local.position}
          onChange={(e) => {
            const position = e.target.value as Position;
            setLocal((prev) => ({ ...prev, position }));
            onChange({ position });
          }}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {positionLabel(p)}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={local.preferredFoot}
          onChange={(e) => {
            const preferredFoot = e.target.value as PreferredFoot;
            setLocal((prev) => ({ ...prev, preferredFoot }));
            onChange({ preferredFoot });
          }}
        >
          <option value="RIGHT">D</option>
          <option value="LEFT">E</option>
          <option value="BOTH">Amb.</option>
        </select>
      </td>
      {ATTRIBUTE_KEYS.map((key) => (
        <td key={key}>
          <input
            type="number"
            min={1}
            max={99}
            value={local.attributes[key]}
            onChange={(e) => setLocal((prev) => ({ ...prev, attributes: { ...prev.attributes, [key]: Number(e.target.value) } }))}
            onBlur={() => local.attributes[key] !== player.attributes[key] && onChange({ attributes: { [key]: local.attributes[key] } })}
            style={{ width: 44 }}
          />
        </td>
      ))}
      <td>
        <strong>{player.overall}</strong>
      </td>
      <td className="muted">{(player.marketValue ?? 0).toLocaleString('pt-BR')}</td>
      <td>
        <button type="button" onClick={onDelete} title="Remover jogador" className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
          Remover
        </button>
      </td>
    </tr>
  );
}

const DEFAULT_NEW_PLAYER_ATTRIBUTES: PlayerAttributes = { pace: 50, finishing: 50, passing: 50, defending: 50, physical: 50, goalkeeping: 10 };

export function TeamEditorPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'squad' | 'kits' | 'stadium' | 'mods'>('squad');

  const [newClub, setNewClub] = useState({ name: '', slug: '', country: 'BRA', division: 1 });
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    age: 20,
    nationality: 'BRA',
    position: 'MID' as Position,
    preferredFoot: 'RIGHT' as PreferredFoot,
    attributes: DEFAULT_NEW_PLAYER_ATTRIBUTES,
  });
  const [transferPlayerId, setTransferPlayerId] = useState('');
  const [transferToClubId, setTransferToClubId] = useState('');

  // Kit designer state
  const [kitPattern, setKitPattern] = useState<KitPattern>('SOLID');
  const [primaryColor, setPrimaryColor] = useState('#1e293b');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');

  // Stadium & Identity state
  const [clubName, setClubName] = useState('');
  const [stadiumName, setStadiumName] = useState('');
  const [stadiumCapacity, setStadiumCapacity] = useState(20000);
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState(5000000);

  async function refresh() {
    setLoading(true);
    try {
      setClubs(await listAllClubsForEditor());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
        if (!isInput && !confirmModal.isOpen) {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/');
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal.isOpen, navigate]);

  const selectedClub = clubs.find((c) => c.id === selectedClubId) ?? null;
  const filteredClubs = clubs.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (selectedClub) {
      setKitPattern(selectedClub.kitPattern ?? 'SOLID');
      setPrimaryColor(selectedClub.primaryColor ?? '#1e293b');
      setSecondaryColor(selectedClub.secondaryColor ?? '#ffffff');
      setClubName(selectedClub.name);
      setStadiumName(selectedClub.stadiumName ?? '');
      setStadiumCapacity(selectedClub.stadiumCapacity ?? 20000);
      setCity(selectedClub.city ?? '');
      setBudget(selectedClub.budget ?? 5000000);
    }
  }, [selectedClubId, selectedClub]);

  function replaceClub(updated: Club) {
    setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handlePlayerChange(playerId: string, patch: PlayerEditPatch) {
    if (!selectedClub) return;
    setError(null);
    try {
      replaceClub(await updateEditorPlayer(selectedClub.id, playerId, patch));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleDeletePlayer(playerId: string) {
    if (!selectedClub) return;
    setConfirmModal({
      isOpen: true,
      title: 'Remover Jogador',
      message: 'Tem certeza que deseja remover este jogador do elenco do clube?',
      variant: 'danger',
      confirmLabel: 'Remover',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setError(null);
        try {
          replaceClub(await deleteEditorPlayer(selectedClub.id, playerId));
        } catch (err) {
          setError((err as Error).message);
        }
      },
    });
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    try {
      const updated = await createEditorPlayer(selectedClub.id, newPlayer);
      replaceClub(updated);
      setNewPlayer((prev) => ({ ...prev, name: '' }));
      setFeedback('Jogador adicionado com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreateClub(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const club = await createEditorClub(newClub);
      setClubs((prev) => [...prev, club]);
      setSelectedClubId(club.id);
      setNewClub((prev) => ({ ...prev, name: '', slug: '' }));
      setFeedback('Clube criado com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleTransfer() {
    if (!selectedClub || !transferPlayerId || !transferToClubId) return;
    setError(null);
    try {
      const { from, to } = await moveEditorTransfer(transferPlayerId, selectedClub.id, transferToClubId);
      replaceClub(from);
      replaceClub(to);
      setTransferPlayerId('');
      setTransferToClubId('');
      setFeedback('Transferência realizada com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveKits(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    try {
      const updated = await updateEditorClubIdentity(selectedClub.id, {
        kitPattern,
        primaryColor,
        secondaryColor,
      });
      replaceClub(updated);
      setFeedback('Uniformes salvos com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveStadium(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    try {
      const updated = await updateEditorClubIdentity(selectedClub.id, {
        name: clubName,
        stadiumName,
        stadiumCapacity: Number(stadiumCapacity),
        city,
        budget: Number(budget),
      });
      replaceClub(updated);
      setFeedback('Identidade e finanças salvas com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleAutoSquad() {
    if (!selectedClub) return;
    setConfirmModal({
      isOpen: true,
      title: 'Gerar Elenco Automático',
      message: 'Gerar um elenco novo balanceado automaticamente? Os jogadores atuais serão substituídos.',
      variant: 'warning',
      confirmLabel: 'Gerar Elenco',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setError(null);
        try {
          const updated = await autoGenerateEditorSquad(selectedClub.id);
          replaceClub(updated);
          setFeedback('Elenco gerado com sucesso!');
        } catch (err) {
          setError((err as Error).message);
        }
      },
    });
  }

  async function handleCrestUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedClub?.slug) return;
    setError(null);
    try {
      await uploadEditorCrest(selectedClub.slug, await fileToBase64(file));
      setFeedback('Escudo atualizado.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const pack = await exportModPack();
      const blob = new Blob([JSON.stringify(pack)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tactical-arena-mod-pack.json`;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback(`Pacote exportado com ${pack.clubs.length} clube(s).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const parsed = JSON.parse(await file.text()) as ModPack;
      if (parsed.version !== 1 || !Array.isArray(parsed.clubs)) {
        throw new Error('Arquivo de pacote inválido.');
      }
      const result = await importModPack(parsed);
      setFeedback(
        `Pacote aplicado: ${result.created.length} clube(s) criado(s), ${result.updated.length} atualizado(s), ` +
          `${result.skippedOwned.length} pulado(s) (gerenciados por outro técnico).`,
      );
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <header className="topbar" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Modding Suite & Editor In-Game</h1>
          <div className="topbar-actions">
            <Link className="btn-secondary" to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              ← Voltar ao Menu
            </Link>
          </div>
        </header>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>Carregando dados do editor...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Modding Suite & Editor In-Game</h1>
          <p className="muted" style={{ margin: '6px 0 0 0' }}>
            Ferramenta profissional de modding e customização: altere elencos, projete uniformes (Kit Designer SVG), gerencie estádios, finanças e pacotes da comunidade.
          </p>
        </div>
        <div className="topbar-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: 8,
            }}
            title="Voltar à tela anterior (ou pressione Esc)"
          >
            ← Voltar
          </button>
          <Link
            className="btn-secondary"
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              borderRadius: 8,
            }}
            title="Ir para o Menu Principal"
          >
            🏠 Menu Principal
          </Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {feedback && <p className="muted" style={{ color: '#4ade80' }}>{feedback}</p>}

      <section className="card">
        <h2>Criar novo clube</h2>
        <form onSubmit={handleCreateClub} className="inline-form" style={{ flexWrap: 'wrap' }}>
          <input placeholder="Nome do clube" value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} required />
          <input
            placeholder="slug-do-clube"
            value={newClub.slug}
            onChange={(e) => setNewClub({ ...newClub, slug: e.target.value.toLowerCase() })}
            required
          />
          <select value={newClub.country} onChange={(e) => setNewClub({ ...newClub, country: e.target.value })}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={newClub.division}
            onChange={(e) => setNewClub({ ...newClub, division: Number(e.target.value) })}
            style={{ width: 70 }}
            title="Divisão"
          />
          <button type="submit">Criar Clube</button>
        </form>
      </section>

      <section className="card">
        <h2>Seleção de Clube</h2>
        <input
          placeholder="Buscar clube..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} size={6} style={{ width: '100%' }}>
          <option value="" disabled>
            Selecione um clube para editar...
          </option>
          {filteredClubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.slug ? `• ${c.slug}` : '(sem slug)'} — Div {c.division ?? 1}
            </option>
          ))}
        </select>
      </section>

      {selectedClub && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ClubCrest club={selectedClub} size={48} />
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CountryFlag code={selectedClub.country} size={22} />
                  {selectedClub.name}
                </h2>
                <span className="muted">Estádio: {selectedClub.stadiumName ?? 'Estádio Municipal'} • Cidade: {selectedClub.city ?? 'Sede'} • Orçamento: R$ {(selectedClub.budget ?? 0).toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAutoSquad}
                title="Gera 18-22 atletas balanceados por posição instantaneamente"
              >
                Gerar Elenco Automático (1-Clique)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', margin: '16px 0', borderBottom: '1px solid var(--border)', paddingBottom: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={activeTab === 'squad' ? 'btn-primary-action' : 'btn-secondary'}
              onClick={() => setActiveTab('squad')}
            >
              Elenco & Atletas ({selectedClub.players.length})
            </button>
            <button
              type="button"
              className={activeTab === 'kits' ? 'btn-primary-action' : 'btn-secondary'}
              onClick={() => setActiveTab('kits')}
            >
              Kit Designer
            </button>
            <button
              type="button"
              className={activeTab === 'stadium' ? 'btn-primary-action' : 'btn-secondary'}
              onClick={() => setActiveTab('stadium')}
            >
              Estádio & Identidade
            </button>
            <button
              type="button"
              className={activeTab === 'mods' ? 'btn-primary-action' : 'btn-secondary'}
              onClick={() => setActiveTab('mods')}
            >
              Mod Packs & Comunidade
            </button>
          </div>

          {activeTab === 'squad' && (
            <>
              <section className="card">
                <h2>Elenco Atual ({selectedClub.players.length})</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Idade</th>
                        <th>Nac.</th>
                        <th>Pos.</th>
                        <th>Pé</th>
                        {ATTRIBUTE_KEYS.map((key) => (
                          <th key={key}>{ATTRIBUTE_LABELS[key]}</th>
                        ))}
                        <th>Força</th>
                        <th>Valor</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClub.players.map((p) => (
                        <PlayerRow key={p.id} player={p} onChange={(patch) => handlePlayerChange(p.id, patch)} onDelete={() => handleDeletePlayer(p.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <h2>Contratar / Adicionar Atleta</h2>
                <form onSubmit={handleCreatePlayer} className="inline-form" style={{ flexWrap: 'wrap' }}>
                  <input placeholder="Nome" value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })} required />
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={newPlayer.age}
                    onChange={(e) => setNewPlayer({ ...newPlayer, age: Number(e.target.value) })}
                    style={{ width: 60 }}
                    title="Idade"
                  />
                  <input
                    placeholder="Nac."
                    value={newPlayer.nationality}
                    onChange={(e) => setNewPlayer({ ...newPlayer, nationality: e.target.value.toUpperCase() })}
                    style={{ width: 60 }}
                  />
                  <select value={newPlayer.position} onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value as Position })}>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {positionLabel(p)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newPlayer.preferredFoot}
                    onChange={(e) => setNewPlayer({ ...newPlayer, preferredFoot: e.target.value as PreferredFoot })}
                  >
                    <option value="RIGHT">Destro</option>
                    <option value="LEFT">Canhoto</option>
                    <option value="BOTH">Ambidestro</option>
                  </select>
                  {ATTRIBUTE_KEYS.map((key) => (
                    <input
                      key={key}
                      type="number"
                      min={1}
                      max={99}
                      title={ATTRIBUTE_LABELS[key]}
                      value={newPlayer.attributes[key]}
                      onChange={(e) => setNewPlayer({ ...newPlayer, attributes: { ...newPlayer.attributes, [key]: Number(e.target.value) } })}
                      style={{ width: 50 }}
                    />
                  ))}
                  <button type="submit">Adicionar Atleta</button>
                </form>
              </section>

              <section className="card">
                <h2>Transferência Direta (In-Game)</h2>
                <p className="muted">Move um jogador direto entre clubes, sem burocracia de orçamento ou negociação.</p>
                <div className="inline-form" style={{ flexWrap: 'wrap' }}>
                  <select value={transferPlayerId} onChange={(e) => setTransferPlayerId(e.target.value)}>
                    <option value="">Selecione o jogador...</option>
                    {selectedClub.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)}) - OVR {p.overall}
                      </option>
                    ))}
                  </select>
                  <span className="muted">para</span>
                  <select value={transferToClubId} onChange={(e) => setTransferToClubId(e.target.value)}>
                    <option value="">Clube de destino...</option>
                    {clubs
                      .filter((c) => c.id !== selectedClub.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  <button type="button" onClick={handleTransfer} disabled={!transferPlayerId || !transferToClubId}>
                    Efetuar Transferência
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === 'kits' && (
            <section className="card">
              <h2>Kit Designer (Uniformes Titular & Reserva)</h2>
              <p className="muted">Customize o padrão e as cores dos uniformes em tempo real com pré-visualização instantânea.</p>

              <form onSubmit={handleSaveKits} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Padrão do Uniforme</label>
                    <select
                      value={kitPattern}
                      onChange={(e) => setKitPattern(e.target.value as KitPattern)}
                      style={{ width: '100%', padding: '8px', borderRadius: 8 }}
                    >
                      <option value="SOLID">Cor Sólida</option>
                      <option value="STRIPES_VERTICAL">Listras Verticais</option>
                      <option value="STRIPES_HORIZONTAL">Listras Horizontais</option>
                      <option value="DIAGONAL_SASH">Faixa Diagonal (Sash)</option>
                      <option value="HALVES">Metade / Metade (Halves)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Cor Primária</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        style={{ width: 44, height: 38, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Cor Secundária / Detalhes</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        style={{ width: 44, height: 38, border: 'none', background: 'none', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 32, margin: '20px 0', padding: 20, background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Uniforme Titular (Home)</div>
                    <div style={{ width: 90, height: 110, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TeamJersey
                        clubSlug={selectedClub.slug}
                        kitPattern={kitPattern}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        size={85}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>Uniforme Goleiro</div>
                    <div style={{ width: 90, height: 110, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TeamJersey
                        isKeeper
                        size={85}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <button type="submit" className="btn-primary-action">
                    Salvar Uniformes
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'stadium' && (
            <section className="card">
              <h2>Estádio, Identidade & Finanças</h2>
              <p className="muted">Configure o nome oficial, estádio, capacidade de público, cidade-sede e finanças do clube.</p>

              <form onSubmit={handleSaveStadium} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nome do Clube</label>
                  <input
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nome do Estádio</label>
                    <input
                      value={stadiumName}
                      onChange={(e) => setStadiumName(e.target.value)}
                      placeholder="Ex: Arena Monumental"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Capacidade de Público</label>
                    <input
                      type="number"
                      min={1000}
                      max={200000}
                      value={stadiumCapacity}
                      onChange={(e) => setStadiumCapacity(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Cidade-Sede</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: São Paulo"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Orçamento Inicial (R$)</label>
                    <input
                      type="number"
                      min={0}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Escudo Customizado (PNG)</label>
                  {selectedClub.slug ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <ClubCrest club={selectedClub} size={48} />
                      <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        Enviar Novo Escudo (PNG)
                        <input type="file" accept="image/png" onChange={handleCrestUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                  ) : (
                    <p className="muted">Clube sem slug. Atribua um slug ao criar o clube para poder enviar escudos customizados.</p>
                  )}
                </div>

                <div>
                  <button type="submit" className="btn-primary-action">
                    Salvar Identidade & Estádio
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'mods' && (
            <section className="card">
              <h2>Pacotes de Mod da Comunidade (Mod Packs)</h2>
              <p className="muted">Exporte todos os clubes customizados da sua save como um arquivo `.json` para compartilhar, ou importe um patch completo da comunidade.</p>

              <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleExport} disabled={busy} className="btn-primary-action">
                  Exportar Mod Pack (.json)
                </button>
                <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                  Importar Mod Pack (.json)
                  <input type="file" accept="application/json" onChange={handleImport} disabled={busy} style={{ display: 'none' }} />
                </label>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
