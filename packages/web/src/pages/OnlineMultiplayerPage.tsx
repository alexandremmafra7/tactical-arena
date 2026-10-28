import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Club, OnlineLobbyState, OnlineTournamentType, P2PMessagePayload } from '@tactical-arena/shared';
import { createOnlineLobby, generateRoomCode } from '@tactical-arena/shared';
import { listAllClubsForEditor } from '../api/client.js';
import { P2PConnector } from '../lib/p2pConnector.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { GlobeIcon } from '../components/icons/AppIcons.js';

export function OnlineMultiplayerPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'lobby'>('create');
  const [playerName, setPlayerName] = useState('Técnico Online');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [tournamentType, setTournamentType] = useState<OnlineTournamentType>('1V1_DUEL');

  const [connector, setConnector] = useState<P2PConnector | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');
  const [offerToken, setOfferToken] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [answerToken, setAnswerToken] = useState('');

  const [lobbyState, setLobbyState] = useState<OnlineLobbyState | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await listAllClubsForEditor();
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

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    try {
      const p2p = new P2PConnector();
      p2p.setOnStatusChange(setConnectionStatus);
      p2p.setOnMessage(handleP2PMessage);

      const token = await p2p.createRoom();
      setOfferToken(token);
      setConnector(p2p);

      const initialLobby = createOnlineLobby('host-peer', playerName, selectedClub, tournamentType);
      setLobbyState(initialLobby);
      setActiveTab('lobby');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClub) return;
    setError(null);
    try {
      const p2p = new P2PConnector();
      p2p.setOnStatusChange(setConnectionStatus);
      p2p.setOnMessage(handleP2PMessage);

      const ansToken = await p2p.joinRoom(offerInput);
      setAnswerToken(ansToken);
      setConnector(p2p);

      setLobbyState({
        roomCode: generateRoomCode(),
        tournamentType: '1V1_DUEL',
        participants: [
          { peerId: 'host-peer', name: 'Host', club: selectedClub, isHost: true, isReady: true, avatar: '👑' },
          { peerId: 'guest-peer', name: playerName, club: selectedClub, isHost: false, isReady: true, avatar: '⚽' },
        ],
        status: 'LOBBY',
      });
      setActiveTab('lobby');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleConnectAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!connector) return;
    try {
      await connector.acceptAnswer(answerInput);
      if (lobbyState) {
        connector.send({ type: 'LOBBY_STATE', state: lobbyState });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleP2PMessage(payload: P2PMessagePayload) {
    if (payload.type === 'LOBBY_STATE') {
      setLobbyState(payload.state);
    } else if (payload.type === 'CHAT_REACTION') {
      setChatMessages((prev) => [...prev, { sender: payload.sender, text: `${payload.emoji} ${payload.text ?? ''}` }]);
    }
  }

  function sendChat(emoji: string, text?: string) {
    if (!connector) return;
    const msg: P2PMessagePayload = { type: 'CHAT_REACTION', sender: playerName, emoji, text };
    connector.send(msg);
    setChatMessages((prev) => [...prev, { sender: playerName, text: `${emoji} ${text ?? ''}` }]);
  }

  if (loading) return <div className="page">Carregando Multiplayer...</div>;

  return (
    <div className="page">
      <header className="topbar" style={{ marginBottom: 20 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlobeIcon size={24} color="#38bdf8" /> Modo Online Multiplayer (P2P WebRTC)
        </h1>
        <div className="topbar-actions">
          <Link className="btn-secondary" to="/">
            ← Menu Principal
          </Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {activeTab !== 'lobby' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            className={activeTab === 'create' ? 'btn-primary-action' : 'btn-secondary'}
            onClick={() => setActiveTab('create')}
          >
            Criar Sala Online
          </button>
          <button
            type="button"
            className={activeTab === 'join' ? 'btn-primary-action' : 'btn-secondary'}
            onClick={() => setActiveTab('join')}
          >
            Entrar em Sala
          </button>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2>Criar Sala de Jogo Hospedada</h2>
          <p className="muted">Seu navegador será o Host coordenador da partida. Compartilhe o token de conexão gerado com seu amigo.</p>

          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Seu Nome de Técnico</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Escolha seu Clube</label>
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
                <option value="1V1_DUEL">Duelo 1v1 (Ida e Volta)</option>
                <option value="KNOCKOUT_4">Mata-Mata (4 Jogadores)</option>
                <option value="KNOCKOUT_8">Mata-Mata (8 Jogadores)</option>
                <option value="FANTASY_DRAFT">Fantasy Draft (Copa das Estrelas)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary-action" style={{ padding: '12px' }}>
              Gerar Sala e Conexão P2P
            </button>
          </form>
        </div>
      )}

      {activeTab === 'join' && (
        <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2>Entrar em Sala de Amigo</h2>
          <p className="muted">Cole o token de oferta enviado pelo Host para estabelecer a conexão direta P2P.</p>

          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Seu Nome de Técnico</label>
              <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Escolha seu Clube</label>
              <select value={selectedClubId} onChange={(e) => setSelectedClubId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Token de Oferta do Host (Base64)</label>
              <textarea
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                placeholder="Cole o token aqui..."
                rows={4}
                required
                style={{ width: '100%', padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </div>

            <button type="submit" className="btn-primary-action" style={{ padding: '12px' }}>
              Conectar à Sala
            </button>
          </form>

          {answerToken && (
            <div className="card" style={{ marginTop: 16, background: 'rgba(0,0,0,0.4)' }}>
              <h3>Seu Token de Resposta (Envie de volta para o Host):</h3>
              <textarea readOnly value={answerToken} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'lobby' && lobbyState && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0 }}>Sala: {lobbyState.roomCode}</h2>
              <span className="muted">Status de Rede: <strong style={{ color: 'var(--accent)' }}>{connectionStatus}</strong></span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setActiveTab('create')}>
              Sair da Sala
            </button>
          </div>

          {offerToken && (
            <div className="card" style={{ marginBottom: 20, background: 'rgba(0,0,0,0.3)' }}>
              <h3>1. Envie este Token de Oferta para o seu Amigo:</h3>
              <textarea readOnly value={offerToken} rows={2} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: 12 }} />

              <h3>2. Cole o Token de Resposta do seu Amigo aqui:</h3>
              <form onSubmit={handleConnectAnswer} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  placeholder="Cole a resposta aqui..."
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}
                />
                <button type="submit" className="btn-primary-action">Aceitar Conexão</button>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <div className="card">
              <h3>Participantes Conectados ({lobbyState.participants.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {lobbyState.participants.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.4rem' }}>{p.avatar}</span>
                      <div>
                        <strong>{p.name}</strong> {p.isHost && <span className="badge" style={{ background: 'var(--accent)', color: '#000', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4 }}>Host</span>}
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

              {lobbyState.participants.length >= 2 && (
                <button type="submit" className="btn-primary-action" style={{ width: '100%', marginTop: 20, padding: 12, fontSize: '1rem' }}>
                  INICIAR PARTIDA ONLINE
                </button>
              )}
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Chat & Reações</h3>
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
