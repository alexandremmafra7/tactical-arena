/** Crest + title ribbon shared by the start screen and the login screen — the game's visual identity. */
export function GameHeader() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <img src="/logo.png" alt="Tactical Arena FC" className="start-crest" />
      <div className="start-banner">Tactical Arena FC</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, opacity: 0.9 }}>
        <img src="/logo-mythra.png" alt="MYTHRA" style={{ height: 18, objectFit: 'contain' }} />
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          MYTHRA Apps & Games
        </span>
      </div>
    </div>
  );
}

