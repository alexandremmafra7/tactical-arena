import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { AuthProvider } from './auth/AuthContext.js';
import { CrashReport } from './components/CrashReport.js';
import { isOfflineMode } from './api/client.js';
import { prepareOfflineWorld } from './api/localEngine.js';
import { initUiScale } from './lib/uiScale.js';
import './styles.css';

/**
 * O mundo offline é lido antes de qualquer tela desenhar.
 *
 * Isto vivia só na tela inicial, o que basta para quem entra pela porta da frente e falha para quem não
 * entra: o Android restaura o app na tela onde ele foi fechado, e aí a primeira coisa a tocar no save é uma
 * tela interna. O mundo então nascia com os clubes inventados, sem segunda divisão, e a tela de fundar clube
 * respondia "nenhum país deste mundo tem divisão de acesso".
 *
 * Bloqueia a primeira pintura, que é o que se quer: são 37 ms de leitura e não há tela que faça sentido
 * desenhar antes de saber em que mundo ela está. Um erro aqui não impede o jogo de abrir, porque
 * `prepareOfflineWorld` guarda os clubes inventados como reserva.
 */
async function bootstrap() {
  initUiScale();
  if (isOfflineMode()) await prepareOfflineWorld().catch(() => undefined);

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {/*
        Outside the router and the auth provider on purpose: a crash in either of those is exactly the kind
        that leaves a blank screen, and a boundary underneath them would go down with the tree it was meant
        to report on.
      */}
      <CrashReport>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </CrashReport>
    </React.StrictMode>,
  );
}

void bootstrap();
