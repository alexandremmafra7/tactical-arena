import React, { useState } from 'react';
import { useCutscene } from '../context/CutsceneContext.js';
import { CutscenePlayer } from '../components/cutscenes/CutscenePlayer.js';

export const DevCutscenesPage: React.FC = () => {
  const { playCutscene } = useCutscene();
  const [cutsceneType, setCutsceneType] = useState<any>('primeiro-contrato');
  const [clubName, setClubName] = useState('Flamengo');
  const [primaryColor, setPrimaryColor] = useState('#e11d48');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [competition, setCompetition] = useState('Campeonato Brasileiro Série A');

  const handleTest = () => {
    playCutscene({
      type: cutsceneType,
      club: {
        name: clubName,
        slug: clubName.toLowerCase().replace(/\s+/g, '_'),
        primaryColor,
        secondaryColor,
        country: 'BRA'
      },
      competition,
      data: {
        managerName: 'Carlos Alberto',
        salary: 200000,
        playerName: 'Estrela Dourada',
        playerOverall: 91,
        playerPosition: 'ATA',
        divisionName: 'Série A do Brasileirão',
        message: 'Agradecemos pelos serviços prestados.'
      }
    });
  };

  return (
    <div style={{ padding: '40px', color: '#fff', backgroundColor: '#0f172a', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <h1>Painel de Testes de Cutscenes (Dev Mode)</h1>
      <p>Teste o tingimento dinâmico, troféus e tempos de cada cutscene.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', marginTop: '24px' }}>
        <label>
          Tipo de Cutscene:
          <select
            value={cutsceneType}
            onChange={e => setCutsceneType(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1e293b', color: '#fff', borderRadius: '4px' }}
          >
            <option value="primeiro-contrato">Primeiro Contrato</option>
            <option value="campeao">Campeão</option>
            <option value="contratacao-galactica">Contratação Galáctica</option>
            <option value="joia-da-base">Joia da Base</option>
            <option value="aposentadoria">Aposentadoria</option>
            <option value="subimos">Subimos (Acesso)</option>
            <option value="rescisao">Rescisão</option>
          </select>
        </label>

        <label>
          Nome do Clube:
          <input
            type="text"
            value={clubName}
            onChange={e => setClubName(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1e293b', color: '#fff', borderRadius: '4px', border: '1px solid #475569' }}
          />
        </label>

        <label>
          Cor Primária:
          <input
            type="color"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            style={{ width: '100%', height: '40px', marginTop: '4px', cursor: 'pointer' }}
          />
        </label>

        <label>
          Cor Secundária:
          <input
            type="color"
            value={secondaryColor}
            onChange={e => setSecondaryColor(e.target.value)}
            style={{ width: '100%', height: '40px', marginTop: '4px', cursor: 'pointer' }}
          />
        </label>

        <label>
          Competição / Troféu:
          <input
            type="text"
            value={competition}
            onChange={e => setCompetition(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#1e293b', color: '#fff', borderRadius: '4px', border: '1px solid #475569' }}
          />
        </label>

        <button
          onClick={handleTest}
          style={{ padding: '12px', backgroundColor: '#34d399', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '12px' }}
        >
          ▶ Executar Cutscene
        </button>
      </div>

      <CutscenePlayer />
    </div>
  );
};
