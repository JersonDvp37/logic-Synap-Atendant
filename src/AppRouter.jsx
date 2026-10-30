import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, } from "react-router-dom";

import Cadastro from "./pages/Auth/Cadastro";
import EsqueciPassword from "./pages/Auth/EsqueciPassword";
import RedefinirPassword from "./pages/Auth/RedefinirPassword";
import CompanyOnboarding from "./pages/Auth/CompanyOnboarding";
import LegalPage from "./pages/Legal/LegalPage";

import Dashboard from "./pages/Dashboard/Dashboard";
import Documentos from "./pages/Documentos/Documentos";
import Chat from "./pages/Chat/Chat";
import Perfil from "./pages/Perfil/Perfil";
import Geral from "./pages/Geral/Geral";

import AtendimentoDashboard from "./pages/Atendimento/Dashboard";
import Conversas from "./pages/Atendimento/Conversas";
import Arquivos from "./pages/Atendimento/Arquivos";
import Canal from "./pages/Atendimento/Canal";
import GmailAuth from "./pages/Atendimento/GmailAuth";
import { GmailAttachments, GmailCompose, GmailInbox } from "./pages/Atendimento/Gmail";
import Agendamentos from "./pages/Atendimento/Agendamentos";
import { ChannelSettingsView, GmailView, WhatsAppView } from "./pages/Atendimento/ChannelNavigation";

import { useAuth } from "./contexts/AuthContext";
import { useCompany } from "./contexts/CompanyContext";  
import { WhatsAppChannelProvider } from "./contexts/WhatsAppChannelContext";
import WhatsAppModuleGuard from "./components/Atendimento/WhatsAppModuleGuard";
import CompanyProfileOnboarding from "./components/Company/CompanyProfileOnboarding";
import styles from "./AppRouter.module.css";

export default function AppRouter() {
  const location = useLocation();
  const {
    user,
    authLoading,
  } = useAuth();

  const {
    companyId,
    companyName,
    company,
    companyLoading,
  } = useCompany();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const isPasswordRoute = ["/esqueci-password", "/redefinir-password"].includes(location.pathname);
  const isLegalRoute = ["/privacidade", "/termos"].includes(location.pathname);

  useEffect(() => {
    if (!user?.id || !companyId || company?.profile_completed !== true) return;

    const pendingKey = `logic-synap:welcome-pending:${user.id}`;
    const shownKey = `logic-synap:welcome-shown:${user.id}`;
    const wasShown = window.localStorage.getItem(shownKey);
    const isPending = window.localStorage.getItem(pendingKey);

    if (isPending && !wasShown) {
      window.localStorage.setItem(shownKey, "true");
      window.localStorage.removeItem(pendingKey);
      setWelcomeOpen(true);
    }
  }, [company?.profile_completed, companyId, user?.id]);

  if (!isPasswordRoute && !isLegalRoute && (authLoading || companyLoading)) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Routes>
        <Route path="/privacidade" element={<LegalPage type="privacy" />} />
        <Route path="/termos" element={<LegalPage type="terms" />} />
        <Route
        path="/login"
        element={
          user
            ? <Navigate to="/" replace />
            : <Cadastro />
        }
        />

        <Route
        path="/cadastro"
        element={
          user
            ? <Navigate to="/" replace />
            : <Cadastro />
        }
        />

        <Route path="/esqueci-password" element={<EsqueciPassword />} />
        <Route path="/redefinir-password" element={<RedefinirPassword />} />

        <Route
        path="/onboarding/company"
        element={
          <OnboardingRoute
            user={user}
            companyId={companyId}
          >
            <CompanyOnboarding />
          </OnboardingRoute>
        }
        />

        <Route
        path="/"
        element={
          <ProtectedRoute
            user={user}
            companyId={companyId}
          >
            <CompanyProfileGate>
              <Dashboard />
            </CompanyProfileGate>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/geral" replace />} />
        <Route path="geral" element={<WhatsAppChannelProvider><Geral /></WhatsAppChannelProvider>} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="chat" element={<Chat />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="atendimento" element={<AtendimentoModule />}>
          <Route element={<WhatsAppView />}>
            <Route index element={<WhatsAppModuleGuard><AtendimentoDashboard /></WhatsAppModuleGuard>} />
            <Route path="conversas" element={<WhatsAppModuleGuard><Conversas /></WhatsAppModuleGuard>} />
            <Route path="arquivos" element={<WhatsAppModuleGuard><Arquivos /></WhatsAppModuleGuard>} />
            <Route path="agendamentos" element={<WhatsAppModuleGuard><Agendamentos /></WhatsAppModuleGuard>} />
          </Route>
          <Route path="gmail" element={<GmailView />}>
            <Route index element={<GmailInbox />} />
            <Route path="compor" element={<GmailCompose />} />
            <Route path="anexos" element={<GmailAttachments />} />
          </Route>
          <Route path="configuracoes" element={<ChannelSettingsView />}>
            <Route index element={<Canal />} />
            <Route path="gmail" element={<GmailAuth />} />
          </Route>
          <Route path="canal" element={<Navigate to="/atendimento/configuracoes" replace />} />
          <Route path="canais" element={<Navigate to="/atendimento/configuracoes" replace />} />
          <Route path="canais/gmail" element={<Navigate to="/atendimento/configuracoes/gmail" replace />} />
        </Route>
        </Route>

        <Route
        path="*"
        element={
          <Navigate
            to={user ? "/geral" : "/login"}
            replace
          />
        }
        />
      </Routes>
      {welcomeOpen && (
        <WelcomeModal
          companyName={companyName}
          onClose={() => setWelcomeOpen(false)}
        />
      )}
    </>
  );
}

function WelcomeModal({ companyName, onClose }) {
  return (
    <div className={styles.welcomeLayer} role="presentation">
      <section className={styles.welcomeModal} role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-description">
        <button type="button" className={styles.welcomeClose} onClick={onClose} aria-label="Fechar boas-vindas">×</button>
        <div className={styles.welcomeBrand}>
          <i className={styles.welcomeOrbit} aria-hidden="true" />
          <img src="/logo_synap/logic_synap_logo.svg" alt="Logic Synap" />
        </div>
        <span className={styles.welcomeEyebrow}>LOGIC SYNAP · AMBIENTE PRONTO</span>
        <h1 id="welcome-title">Bem-vindo, {companyName || "novo workspace"}.</h1>
        <p id="welcome-description">O ambiente da <strong>{companyName || "sua empresa"}</strong> está pronto para transformar conhecimento em decisões mais rápidas.</p>
        <button type="button" className={styles.welcomeAction} onClick={onClose}>Entrar no workspace <span aria-hidden="true">→</span></button>
      </section>
    </div>
  );
}

function CompanyProfileGate({ children }) {
  const { company } = useCompany();

  if (company && company.profile_completed !== true) {
    return <CompanyProfileOnboarding />;
  }

  return children;
}

function AtendimentoModule() {
  return <WhatsAppChannelProvider><Outlet /></WhatsAppChannelProvider>;
}

function ProtectedRoute({
  user,
  companyId,
  children,
}) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!companyId) {
    return (
      <Navigate
        to="/onboarding/company"
        replace
      />
    );
  }

  return children;
}

function OnboardingRoute({
  user,
  companyId,
  children,
}) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (companyId) {
    return <Navigate to="/geral" replace />;
  }

  return children;
}

function LoadingScreen() {
  return (
    <div className={styles.loadingScreen} role="status" aria-live="polite">
      <div className={styles.loader}>
        <span className={`${styles.orbit} ${styles.orbitOuter}`} aria-hidden="true" />
        <img src="/logo_synap/logo_loader.svg" alt="Logic Synap" className={styles.logo} />
      </div>
      <div className={styles.loadingCopy}>
        <span>Preparando a sua experiência</span>
        <i className={styles.dots} aria-hidden="true"><b /><b /><b /></i>
      </div>
    </div>
  );
}
