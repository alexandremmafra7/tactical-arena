import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.js';
import { StartPage } from './pages/Start.js';
import { LoginPage } from './pages/Login.js';
import { DashboardPage } from './pages/Dashboard.js';
import { LiveMatchPage } from './pages/LiveMatch.js';
import { MatchResultPage } from './pages/MatchResult.js';
import { RoundSummaryPage } from './pages/RoundSummary.js';
import { TransfersHubPage } from './pages/TransfersHub.js';
import { LeaguePage } from './pages/League.js';
import { CupPage } from './pages/Cup.js';
import { ClubTacticsPage } from './pages/ClubTactics.js';
import { SquadPage } from './pages/Squad.js';
import { SponsorsPage } from './pages/Sponsors.js';
import { ContractsPage } from './pages/Contracts.js';
import { AgendaHubPage } from './pages/AgendaHub.js';
import { CompetitionsHubPage } from './pages/CompetitionsHub.js';
import { MatchBriefingPage } from './pages/MatchBriefing.js';
import { HistoryHubPage } from './pages/HistoryHub.js';
import { HistoryChampionsPage } from './pages/HistoryChampions.js';
import { HistoryTopScorersPage } from './pages/HistoryTopScorers.js';
import { HallOfFamePage } from './pages/HallOfFamePage.js';
import { ClubHomePage } from './pages/ClubHome.js';
import { TrainingPage } from './pages/Training.js';
import { StadiumPage } from './pages/Stadium.js';
import { FinancePage } from './pages/Finance.js';
import { AcademyPage } from './pages/Academy.js';
import { StaffPage } from './pages/Staff.js';
import { PlayerDetailPage } from './pages/PlayerDetail.js';
import { CareerPage } from './pages/Career.js';
import { TeamEditorPage } from './pages/TeamEditor.js';
import { QuickPlayPage } from './pages/QuickPlay.js';
import { CustomChampionshipWizard } from './pages/CustomChampionshipWizard.js';
import { OnlineMultiplayerPage } from './pages/OnlineMultiplayerPage.js';
import { TrophyRoom } from './pages/TrophyRoom.js';
import { LockerRoomPage } from './pages/LockerRoom.js';
import { PressConferencePage } from './pages/PressConference.js';
import { NationalTeamHubPage } from './pages/NationalTeamHub.js';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary.js';
import { ScrollToTop } from './components/ScrollToTop.js';
import { CutsceneProvider } from './context/CutsceneContext.js';
import { ViewModeProvider } from './context/ViewModeContext.js';
import { CutscenePlayer } from './components/cutscenes/CutscenePlayer.js';
import { DevCutscenesPage } from './pages/DevCutscenes.js';
import { isOfflineMode } from './api/client.js';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { token } = useAuth();
  if (!token) {
    if (isOfflineMode() || (typeof window !== 'undefined' && !import.meta.env['VITE_API_BASE'])) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  return children;
}

function LegacyClubRedirect({ destination }: { destination: 'squad' | 'finance' }) {
  const { clubId } = useParams<{ clubId: string }>();
  return <Navigate to={clubId ? `/clubs/${clubId}/${destination}` : '/dashboard'} replace />;
}

export function App() {
  return (
    <GlobalErrorBoundary>
      <CutsceneProvider>
        <ViewModeProvider>
          <ScrollToTop />
          <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/career"
          element={
            <RequireAuth>
              <CareerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/team-editor"
          element={<TeamEditorPage />}
        />
        <Route
          path="/quick-play"
          element={<QuickPlayPage />}
        />
        <Route
          path="/custom-championship"
          element={<CustomChampionshipWizard />}
        />
        <Route
          path="/online"
          element={
            <RequireAuth>
              <OnlineMultiplayerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/match/:matchId/live"
          element={
            <RequireAuth>
              <LiveMatchPage />
            </RequireAuth>
          }
        />
        <Route
          path="/match/:matchId/result"
          element={
            <RequireAuth>
              <MatchResultPage />
            </RequireAuth>
          }
        />
        <Route
          path="/match/:matchId/round-summary"
          element={
            <RequireAuth>
              <RoundSummaryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/league/:leagueId"
          element={
            <RequireAuth>
              <LeaguePage />
            </RequireAuth>
          }
        />
        <Route
          path="/cup/:cupId"
          element={
            <RequireAuth>
              <CupPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/tactics"
          element={
            <RequireAuth>
              <ClubTacticsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/squad"
          element={
            <RequireAuth>
              <SquadPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/team"
          element={
            <RequireAuth>
              <LegacyClubRedirect destination="squad" />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/financial"
          element={
            <RequireAuth>
              <LegacyClubRedirect destination="finance" />
            </RequireAuth>
          }
        />
        <Route
          path="/national-team/:teamCode"
          element={
            <RequireAuth>
              <NationalTeamHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/briefing"
          element={
            <RequireAuth>
              <MatchBriefingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/competitions"
          element={
            <RequireAuth>
              <CompetitionsHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/agenda"
          element={
            <RequireAuth>
              <AgendaHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/transfers"
          element={
            <RequireAuth>
              <TransfersHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/history"
          element={
            <RequireAuth>
              <HistoryHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/history/champions"
          element={
            <RequireAuth>
              <HistoryChampionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/history/scorers"
          element={
            <RequireAuth>
              <HistoryTopScorersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/history/hall-of-fame"
          element={
            <RequireAuth>
              <HallOfFamePage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/trophies"
          element={
            <RequireAuth>
              <TrophyRoom />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/players/:playerId"
          element={
            <RequireAuth>
              <PlayerDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/training"
          element={
            <RequireAuth>
              <TrainingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/stadium"
          element={
            <RequireAuth>
              <StadiumPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/contracts"
          element={
            <RequireAuth>
              <ContractsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/sponsors"
          element={
            <RequireAuth>
              <SponsorsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/finance"
          element={
            <RequireAuth>
              <FinancePage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/academy"
          element={
            <RequireAuth>
              <AcademyPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/staff"
          element={
            <RequireAuth>
              <StaffPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/locker-room"
          element={
            <RequireAuth>
              <LockerRoomPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId/home"
          element={
            <RequireAuth>
              <ClubHomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/clubs/:clubId"
          element={
            <RequireAuth>
              <ClubHomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/sponsors"
          element={
            <RequireAuth>
              <SponsorsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/contracts"
          element={
            <RequireAuth>
              <ContractsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/agenda"
          element={
            <RequireAuth>
              <AgendaHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/competitions"
          element={
            <RequireAuth>
              <CompetitionsHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/history"
          element={
            <RequireAuth>
              <HistoryHubPage />
            </RequireAuth>
          }
        />
        <Route
          path="/press-conference/:id"
          element={
            <RequireAuth>
              <PressConferencePage />
            </RequireAuth>
          }
        />
        <Route path="/dev/cutscenes" element={<DevCutscenesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CutscenePlayer />
        </ViewModeProvider>
      </CutsceneProvider>
    </GlobalErrorBoundary>
  );
}
