import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  Club,
  MatchEvent,
  OnlineLobbyState,
  OnlineParticipant,
  OnlineTournamentType,
  P2PMessagePayload,
} from '@tactical-arena/shared';
import {
  addParticipantToLobby,
  autoSimulateQuickMatch,
  createOnlineLobby,
  generateRoomCode,
} from '@tactical-arena/shared';
import {
  checkServerHealth,
  getApiBase,
  listAllClubsForEditor,
  listAvailableClubs,
  setCustomApiBase,
  setOfflineMode,
} from '../api/client.js';
import { prepareOfflineWorld } from '../api/localEngine.js';
import { P2PConnector } from '../lib/p2pConnector.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { GlobeIcon } from '../components/icons/AppIcons.js';

interface P2PMatchView {
  homeClub: Club;
  awayClub: Club;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}

interface InviteLinkItem {
  label: string;
  ip: string;
  url: string;
  isVpn: boolean;
}

interface OnlineHostStatus {
  ok: boolean;
  running: boolean;
  port?: number;
  hostUrl?: string;
  inviteLinks?: InviteLinkItem[];
  error?: string;
}

export function OnlineMultiplayerPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'career_server' | 'create' | 'join' | 'lobby'>('career_server');
  const [playerName, setPlayerName] = useState('Técnico Online');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [tournamentType, setTournamentType] = useState<OnlineTournamentType>('1V1_DUEL');

  // Shared Career Server state
  const [serverUrl, setServerUrl] = useState(() => getApiBase() || 'http://localhost:3001');
  const [testingServer, setTestingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [startingHost, setStartingHost] = useState(false);
  const [hostStatus, setHostStatus] = useState<OnlineHostStatus | null>(null);

  // P2P WebRTC state
  const [connector, setConnector] = useState<P2PConnector | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const [offerToken, setOfferToken] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [answerToken, setAnswerToken] = useState('');
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);

  const [lobbyState, setLobbyState] = useState<OnlineLobbyState | null>(null);
  const lobbyRef = useRef<OnlineLobbyState | null>(null);
  lobbyRef.current = lobbyState;

  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [matchView, setMatchView] = useState<P2PMatchView | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const electronApi = (window as unknown as { electronAPI?: { getOnlineHostStatus?: () => Promise<OnlineHostStatus> } }).electronAPI;
        if (electronApi?.getOnlineHostStatus) {
          const status = await electronApi.getOnlineHostStatus().catch(() => null);
          if (status) setHostStatus(status);
        }
        await prepareOfflineWorld().catch(() => undefined);
        let list = await listAllClubsForEditor().catch(() => [] as Club[]);
        if (!list || list.length === 0) {
          list = await listAvailableClubs().catch(() => [] as Club[]);
        }
        setClubs(list);
        if (list.length > 0) setSelectedClubId(list[0].id);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedClub = clubs.find((c) => c.id === selectedClubId) ?? null;

  async function handleStartHostServer() {
    setStartingHost(true);
    setError(null);
    try {
      const electronApi = (window as unknown as { electronAPI?: { startOnlineHost?: () => Promise<OnlineHostStatus> } }).electronAPI;
      if (electronApi?.startOnlineHost) {
        const res = await electronApi.startOnlineHost();
        setHostStatus(res);
        if (!res.ok) {
          setError(res.error || 'Não foi possível iniciar o servidor online.');
        }
      } else {
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
        const ok = await checkServerHealth(currentOrigin);
        setHostStatus({
          ok,
          running: ok,
          port: Number(window.location.port || 3001),
          hostUrl: currentOrigin,
          inviteLinks: [
            {
              label: 'Link Direto do Navegador',
              ip: window.location.hostname,
              url: currentOrigin,
              isVpn: currentOrigin.startsWith('https://'),
            },
          ],
          error: ok ? undefined : 'Rode "npm run start:hosted" para abrir a sala fora do aplicativo Desktop.',
        });
        if (!ok) {
          setError('Atualize o aplicativo Desktop para iniciar a sala com 1 clique, ou rode "npm run start:hosted" no terminal.');
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStartingHost(false);
    }
  }

  async function handleTestAndConnectServer(goToLoginAfter: boolean) {
    setTestingServer(true);
    setServerStatus(null);
    setError(null);
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    const ok = await checkServerHealth(cleanUrl);
    setTestingServer(false);
    if (ok) {
      setCustomApiBase(cleanUrl);
      setOfflineMode(false);
      setServerStatus({
        ok: true,
        msg: `Conectado com sucesso à sala (${cleanUrl})!`,
      });
      if (goToLoginAfter) {
        if (window.location.origin !== cleanUrl) {
          window.location.href = `${cleanUrl}/login`;
        } else {
          navigate('/login');
        }
      }
    } else {
      setServerStatus({
        ok: false,
        msg: `Não foi possível conectar em ${cleanUrl}. Peça ao Host para clicar em "Criar Sala Online" e verifique se vocês estão no mesmo Wi-Fi ou Radmin VPN / Tailscale.`,
      });
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedMsg(label);
    setTimeout(() => setCopiedMsg(null), 2200);
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    setMatchView(null);
    try {
      const initialLobby = createOnlineLobby('host-peer', playerName, selectedClub, tournamentType);
      setLobbyState(initialLobby);
      lobbyRef.current = initialLobby;

      const p2p = new P2PConnector();
      p2p.setOnStatusChange(setConnectionStatus);
      p2p.setOnMessage((payload) => handleP2PMessage(payload, p2p));
      p2p.setOnOpen(() => {
        if (lobbyRef.current) {
          p2p.send({ type: 'LOBBY_STATE', state: lobbyRef.current });
        }
      });

      const token = await p2p.createRoom();
      setOfferToken(token);
      setConnector(p2p);
      setActiveTab('lobby');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    setMatchView(null);
    try {
      const guestParticipant: OnlineParticipant = {
        peerId: `guest-${Date.now()}`,
        name: playerName,
        club: selectedClub,
        isHost: false,
        isReady: true,
        avatar: '⚽',
      };

      const p2p = new P2PConnector();
      p2p.setOnStatusChange(setConnectionStatus);
      p2p.setOnMessage((payload) => handleP2PMessage(payload, p2p));
      p2p.setOnOpen(() => {
        p2p.send({ type: 'JOIN_LOBBY', participant: guestParticipant });
      });

      const ansToken = await p2p.joinRoom(offerInput.trim());
      setAnswerToken(ansToken);
      setConnector(p2p);

      const provisionalLobby: OnlineLobbyState = {
        roomCode: generateRoomCode(),
        tournamentType: '1V1_DUEL',
        participants: [guestParticipant],
        status: 'LOBBY',
      };
      setLobbyState(provisionalLobby);
      lobbyRef.current = provisionalLobby;
    } catch (err) {
      setError('Token de oferta inválido. Copie todo o código enviado pelo Host.');
    }
  }

  async function handleConnectAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!connector || !answerInput.trim()) return;
    setError(null);
    try {
      await connector.acceptAnswer(answerInput.trim());
      if (lobbyRef.current) {
        connector.send({ type: 'LOBBY_STATE', state: lobbyRef.current });
      }
    } catch {
      setError('Token de resposta inválido. Verifique se seu amigo copiou o código inteiro.');
    }
  }

  function handleP2PMessage(payload: P2PMessagePayload, activeP2p?: P2PConnector) {
    const conn = activeP2p ?? connector;
    if (payload.type === 'JOIN_LOBBY') {
      const current = lobbyRef.current;
      if (current) {
        const updated = addParticipantToLobby(current, payload.participant);
        setLobbyState(updated);
        lobbyRef.current = updated;
        conn?.send({ type: 'LOBBY_STATE', state: updated });
      }
    } else if (payload.type === 'LOBBY_STATE') {
      setLobbyState(payload.state);
      lobbyRef.current = payload.state;
      setActiveTab('lobby');
    } else if (payload.type === 'CHAT_REACTION') {
      setChatMessages((prev) => [...prev, { sender: payload.sender, text: `${payload.emoji} ${payload.text ?? ''}` }]);
    } else if (payload.type === 'MATCH_TICK') {
      const current = lobbyRef.current;
      const home = current?.participants[0]?.club;
      const away = current?.participants[1]?.club ?? current?.participants[0]?.club;
      if (home && away) {
        setMatchView({
          homeClub: home,
          awayClub: away,
          homeGoals: payload.homeGoals,
          awayGoals: payload.awayGoals,
          events: payload.events,
        });
      }
    }
  }

  function handleStartOnlineMatch() {
    if (!lobbyState || lobbyState.participants.length === 0) return;
    const home = lobbyState.participants[0].club;
    const away =
      lobbyState.participants[1]?.club ??
      clubs.find((c) => c.id !== home.id) ??
      home;

    const sim = autoSimulateQuickMatch(home, away, true, 'Duelo Online P2P');
    if (!sim.result) return;

    const view: P2PMatchView = {
      homeClub: home,
      awayClub: away,
      homeGoals: sim.result.homeGoals,
      awayGoals: sim.result.awayGoals,
      events: sim.result.events,
    };
    setMatchView(view);

    connector?.send({
      type: 'MATCH_TICK',
      minute: 90,
      homeGoals: sim.result.homeGoals,
      awayGoals: sim.result.awayGoals,
      events: sim.result.events,
    });
  }

  function sendChat(emoji: string, text?: string) {
    if (!connector) return;
    const msg: P2PMessagePayload = { type: 'CHAT_REACTION', sender: playerName, emoji, text };
    connector.send(msg);
    setChatMessages((prev) => [...prev, { sender: playerName, text: `${emoji} ${text ?? ''}` }]);
  }

  if (loading) return <div className="page">Carregando Central Online...</div>;

  return (
    <div className="page">
      <header className="topbar" style={{ marginBottom: 20 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlobeIcon size={24} color="#38bdf8" /> Central Online &amp; Multiplayer
        </h1>
        <div className="topbar-actions">
          <Link className="btn-secondary" to="/">
            ← Menu Principal
          </Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {copiedMsg && (
        <div className="card" style={{ borderColor: '#4ade80', color: '#86efac', marginBottom: 14, padding: '8px 14px' }}>
          ✓ {copiedMsg}
        </div>
      )}

      {activeTab !== 'lobby' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          <button
            type="button"
            className={activeTab === 'career_server' ? 'btn-primary-action' : 'btn-secondary'}
            onClick={() => setActiveTab('career_server')}
          >
            🌐 Carreira no Mesmo Mundo (Servidor)
          </button>
          <button
            type="button"
            className={activeTab === 'create' ? 'btn-primary-action' : 'btn-secondary'}
            onClick={() => setActiveTab('create')}
          >
            ⚡ Criar Sala P2P (Duelo 1v1)
          </button>
          <button
            type="button"
            className={activeTab === 'join' ? 'btn-primary-action' : 'btn-secondary'}
            onClick={() => setActiveTab('join')}
          >
            🔑 Entrar em Sala P2P
          </button>
        </div>
      )}

      {/* TAB 1: CARREIRA COMPARTILHADA NO SERVIDOR */}
      {activeTab === 'career_server' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, maxWidth: 980, margin: '0 auto' }}>
          {/* CARD 1: HOST (CRIAR SALA E GERAR LINK DE CONVITE) */}
          <div className="card" style={{ border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <h2 style={{ color: '#38bdf8' }}>👑 1. Sou o Host (Criar Sala e Convite)</h2>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5, fontSize: '0.9rem' }}>
              Clique no botão abaixo para abrir a sala online no seu PC e gerar automaticamente o <strong>Link de Convite</strong> para enviar ao seu amigo.
            </p>

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <button
                type="button"
                className="btn-primary-action"
                style={{ width: '100%', padding: '12px 16px', fontSize: '1rem' }}
                disabled={startingHost}
                onClick={handleStartHostServer}
              >
                {startingHost
                  ? '⏳ Abrindo Sala Online...'
                  : hostStatus?.running
                    ? '🔄 Atualizar Links da Sala Online'
                    : '🚀 CRIAR SALA ONLINE E GERAR LINK DE CONVITE'}
              </button>
            </div>

            {hostStatus?.running && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid #4ade80',
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ color: '#4ade80', fontWeight: 800, marginBottom: 10 }}>
                  🟢 SALA ONLINE ABERTA! Envie um dos links abaixo para seu amigo:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(hostStatus.inviteLinks ?? []).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: item.isVpn ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', color: item.isVpn ? '#38bdf8' : '#94a3b8', fontWeight: 700, marginBottom: 4 }}>
                        {item.isVpn ? '⭐ Recomendado p/ Internet — ' : '🏠 Mesma Rede — '}
                        {item.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <code style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700 }}>{item.url}</code>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => copyToClipboard(item.url, `Link de convite copiado: ${item.url}`)}
                        >
                          📋 Copiar Link de Convite
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    className="btn-primary-action"
                    style={{ width: '100%', background: '#16a34a' }}
                    onClick={() => {
                      const target = hostStatus.hostUrl || 'http://127.0.0.1:3001';
                      setCustomApiBase(target);
                      setOfflineMode(false);
                      window.location.href = `${target}/login`;
                    }}
                  >
                    🎮 Entrar na Minha Sala Agora (Escolher Clube) →
                  </button>
                </div>
              </div>
            )}

            <p className="muted" style={{ marginTop: 12, fontSize: '0.8rem', lineHeight: 1.4 }}>
              💡 <strong>Dica:</strong> Se vocês estiverem em casas diferentes, basta os dois estarem conectados na mesma rede gratuita do <strong>Radmin VPN</strong> ou <strong>Tailscale</strong> (leva 1 minuto) e usar o link acima.
            </p>
          </div>

          {/* CARD 2: CONVIDADO (ENTRAR COM LINK DO HOST) */}
          <div className="card">
            <h2>🤝 2. Sou Convidado (Entrar com Link)</h2>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.5, fontSize: '0.9rem' }}>
              Recebeu o <strong>Link de Convite</strong> do seu amigo? Cole o link abaixo para entrar no mesmo mundo de carreira que ele! (Você também pode abrir o link direto no navegador).
            </p>

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>
                Cole aqui o Link de Convite enviado pelo Host:
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="Ex: http://26.45.12.88:3001 ou http://192.168.1.15:3001"
                style={{ width: '100%', padding: '10px 12px' }}
              />
            </div>

            {serverStatus && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  background: serverStatus.ok ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                  border: `1px solid ${serverStatus.ok ? '#4ade80' : '#f87171'}`,
                  color: serverStatus.ok ? '#86efac' : '#fca5a5',
                  fontSize: '0.88rem',
                }}
              >
                {serverStatus.msg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn-primary-action"
                disabled={testingServer}
                onClick={() => handleTestAndConnectServer(true)}
              >
                {testingServer ? 'Conectando à Sala...' : '🔗 Conectar pelo Link e Entrar na Sala →'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={testingServer}
                onClick={() => handleTestAndConnectServer(false)}
              >
                Testar Link Antes de Entrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CRIAR SALA P2P */}
      {activeTab === 'create' && (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2>Criar Sala de Duelo Rápido (P2P WebRTC)</h2>
          <p className="muted">
            Conexão direta entre navegadores sem precisar abrir portas. Gere o Token de Oferta e envie para o seu amigo no WhatsApp/Discord.
          </p>

          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Seu Nome de Técnico</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Escolha seu Clube ({clubs.length} disponíveis)</label>
              <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Tipo de Torneio Online</label>
              <select value={tournamentType} onChange={(e) => setTournamentType(e.target.value as OnlineTournamentType)} style={{ width: '100%', padding: 8 }}>
                <option value="1V1_DUEL">Duelo 1v1 Direto</option>
                <option value="KNOCKOUT_4">Mata-Mata (4 Jogadores)</option>
                <option value="KNOCKOUT_8">Mata-Mata (8 Jogadores)</option>
                <option value="FANTASY_DRAFT">Fantasy Draft (Copa das Estrelas)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary-action" style={{ padding: '12px' }}>
              Gerar Sala e Código P2P
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: ENTRAR EM SALA P2P */}
      {activeTab === 'join' && (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2>Entrar em Sala de Amigo (P2P)</h2>
          <p className="muted">Cole o Token de Oferta enviado pelo Host para gerar seu Token de Resposta.</p>

          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Seu Nome de Técnico</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Escolha seu Clube ({clubs.length} disponíveis)</label>
              <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>1. Cole aqui o Token de Oferta do Host:</label>
              <textarea
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                placeholder="Cole o código Base64 que o Host te enviou..."
                rows={3}
                required
                style={{ width: '100%', padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </div>

            <button type="submit" className="btn-primary-action" style={{ padding: '12px' }}>
              Gerar Código de Resposta
            </button>
          </form>

          {answerToken && (
            <div className="card" style={{ marginTop: 16, background: 'rgba(0,0,0,0.4)', border: '1px solid #38bdf8' }}>
              <h3 style={{ marginTop: 0 }}>2. Envie este Código de Resposta de volta para o Host:</h3>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Assim que o Host colar este código e clicar em <strong>Aceitar Conexão</strong>, vocês dois entrarão automaticamente na sala!
              </p>
              <textarea readOnly value={answerToken} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => copyToClipboard(answerToken, 'Código de Resposta copiado! Envie para o Host.')}
                >
                  📋 Copiar Código de Resposta
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveTab('lobby')}
                >
                  Ir para o Lobby da Sala →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LOBBY DA SALA P2P */}
      {activeTab === 'lobby' && lobbyState && (
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0 }}>Sala: {lobbyState.roomCode}</h2>
              <span className="muted">
                Status de Rede: <strong style={{ color: 'var(--accent)' }}>{connectionStatus}</strong>
              </span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setActiveTab('create')}>
              Sair da Sala
            </button>
          </div>

          {offerToken && (
            <div className="card" style={{ marginBottom: 20, background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>1. Envie este Token de Oferta para o seu Amigo:</h3>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => copyToClipboard(offerToken, 'Token de Oferta copiado! Envie para o seu amigo.')}
                >
                  📋 Copiar Token de Oferta
                </button>
              </div>
              <textarea readOnly value={offerToken} rows={2} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: 12 }} />

              <h3 style={{ margin: '0 0 6px 0' }}>2. Cole o Token de Resposta que seu Amigo te devolveu:</h3>
              <form onSubmit={handleConnectAnswer} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="Cole a resposta do amigo aqui..."
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
                <button type="submit" className="btn-primary-action">
                  Aceitar Conexão
                </button>
              </form>
            </div>
          )}

          {matchView && (
            <div className="card" style={{ marginBottom: 20, border: '1.5px solid var(--accent)', background: 'rgba(15, 23, 42, 0.85)' }}>
              <h3 style={{ textAlign: 'center', color: '#ffd700', marginTop: 0 }}>⚡ Resultado do Confronto Online</h3>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, fontSize: '1.4rem', fontWeight: 800, margin: '14px 0' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <ClubCrest club={matchView.homeClub} size={36} />
                  {matchView.homeClub.name}
                </span>
                <span style={{ background: '#0f172a', padding: '6px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', color: '#ffd700' }}>
                  {matchView.homeGoals} x {matchView.awayGoals}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {matchView.awayClub.name}
                  <ClubCrest club={matchView.awayClub} size={36} />
                </span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', background: 'rgba(0,0,0,0.35)', borderRadius: 8, padding: 10, fontSize: '0.85rem' }}>
                {matchView.events
                  .filter((ev) => ev.type === 'goal' || ev.type === 'card' || ev.type === 'injury')
                  .map((ev, idx) => (
                    <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <strong>{ev.minute}&apos;</strong> — {ev.description}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <div className="card">
              <h3>Participantes Conectados ({lobbyState.participants.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {lobbyState.participants.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.04)',
                      padding: 10,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.4rem' }}>{p.avatar}</span>
                      <div>
                        <strong>{p.name}</strong>{' '}
                        {p.isHost && (
                          <span
                            className="badge"
                            style={{ background: 'var(--accent)', color: '#000', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4 }}
                          >
                            Host
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
                          <ClubCrest club={p.club} size={20} />
                          {p.club.name}
                        </div>
                      </div>
                    </div>
                    <span style={{ color: p.isReady ? '#4ade80' : 'var(--muted)', fontWeight: 600 }}>
                      {p.isReady ? 'Pronto' : 'Aguardando...'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-primary-action"
                onClick={handleStartOnlineMatch}
                style={{ width: '100%', marginTop: 20, padding: 12, fontSize: '1rem' }}
              >
                ⚽ {lobbyState.participants.length >= 2 ? 'INICIAR PARTIDA ONLINE (1v1)' : 'SIMULAR PARTIDA DE TESTE'}
              </button>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Chat &amp; Reações</h3>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10, overflowY: 'auto', marginBottom: 10, fontSize: '0.85rem' }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <strong>{m.sender}:</strong> {m.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => sendChat('⚽', 'Golaço!')}>⚽</button>
                <button type="button" className="btn-secondary" onClick={() => sendChat('🧤', 'Boa defesa!')}>🧤</button>
                <button type="button" className="btn-secondary" onClick={() => sendChat('🔥', 'Pressão total!')}>🔥</button>
                <button type="button" className="btn-secondary" onClick={() => sendChat('😂', 'Joga muito!')}>😂</button>
                <button type="button" className="btn-secondary" onClick={() => sendChat('🏆', 'Campeão!')}>🏆</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      sendChat('💬', chatInput.trim());
                      setChatInput('');
                    }
                  }}
                  placeholder="Enviar mensagem..."
                  style={{ flex: 1, padding: 6, fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => {
                    if (chatInput.trim()) {
                      sendChat('💬', chatInput.trim());
                      setChatInput('');
                    }
                  }}
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
