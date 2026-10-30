import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { LEGAL_LINKS } from "../../constants/legalLinks";
import { isDemoMode } from "../../services/demoService";
import styles from "./Cadastro.module.css";

export default function Cadastro() {
  const { login, register, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState(
    isDemoMode || location.pathname === "/login" ? "login" : "signup",
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(location.state?.signupSuccess || "");
  const [errorMessage, setErrorMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const email = form.email.trim();
      const password = form.password;

      if (mode === "login") {
        await login(email, password);
        navigate(location.state?.from?.pathname || (isDemoMode ? "/geral" : "/documentos"), { replace: true });
        return;
      }

      if (!termsAccepted) {
        setErrorMessage("Aceite os Termos e Condições e a Política de Privacidade para criar a conta.");
        setLoading(false);
        return;
      }

      const authData = await register(email, password);

      // Alguns projetos Supabase iniciam uma sessão imediatamente após o cadastro.
      // Encerrá-la garante que o utilizador sempre volte ao login antes do onboarding.
      if (authData.session) await logout();

      navigate("/login", {
        replace: true,
        state: {
          signupSuccess: authData.session
            ? "Conta criada. Faça login para criar seu workspace."
            : "Conta criada. Verifique a caixa de entrada do seu e-mail (Gmail) e clique no link de confirmação. Depois, faça login para criar seu workspace.",
        },
      });
    } catch (error) {
      console.error("Erro de autenticação:", error);
      setErrorMessage(translateAuthError(error?.message));
    } finally {
      setLoading(false);
    }
  }

  function changeMode() {
    const nextMode = mode === "login" ? "signup" : "login";
    setMode(nextMode);
    navigate(nextMode === "login" ? "/login" : "/cadastro", { replace: true });
    setMessage("");
    setErrorMessage("");
  }

  return (
    <main className={`${styles.page} ${isDemoMode ? styles.demoPage : ''}`}>
      <div className={styles.glow} />
      {isDemoMode && <aside className={styles.demoIntro}>
        <span className={styles.demoBadge}>DEMONSTRAÇÃO INTERATIVA</span>
        <h2>Conheça a Logic Synap por dentro.</h2>
        <p>Explore o conhecimento da empresa, as conversas e os canais de atendimento num só lugar.</p>
        <div className={styles.demoNotice}>
          <strong>Esta versão é apenas uma demonstração.</strong>
          <p>O projeto está incompleto e executa apenas o frontend. Os dados são fictícios; IA, envios e integrações são simulados, sem ligação a serviços reais.</p>
          <p>Para entrar, use um e-mail no formato <b>demo@example.com</b> e qualquer senha preenchida. Não é necessário criar conta.</p>
        </div>
      </aside>}
      <section className={styles.card}>
        <div className={styles.brand}>
          <span><img src="/logo_synap/logic_synap_logo.svg" alt="" /></span>
          Logic Synap
        </div>

        <div className={styles.heading}>
          <h1>{isDemoMode ? "Entrar na demonstração" : mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}</h1>
          <p>
            {isDemoMode ? "Experimente livremente. Não use credenciais reais." : mode === "login"
              ? "Entre para gerenciar a base de conhecimento da sua empresa."
              : "Cadastre-se para configurar seu ambiente seguro."}
          </p>
        </div>

        {message && <div className={styles.successMessage}>{message}</div>}
        {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

        <form onSubmit={submit}>
          <label>
            {isDemoMode ? 'E-mail de demonstração' : 'E-mail profissional'}
            <input
              required
              type="email"
              value={typeof form.email === "string" ? form.email : ""}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="nome@example.com"
            />
          </label>

          <label>
            Senha
            <input
              required
              minLength={isDemoMode ? 1 : 6}
              type="password"
              value={typeof form.password === "string" ? form.password : ""}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="••••••••"
            />
          </label>

          {!isDemoMode && mode === "login" && (
            <button className={styles.forgotLink} type="button" onClick={() => navigate("/esqueci-password")}>
              Esqueceu a palavra-passe?
            </button>
          )}

          {mode === "signup" && (
            <label className={styles.consent}>
              <input
                required
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>
                Li e aceito os <a href={LEGAL_LINKS.terms} target="_blank" rel="noreferrer">Termos e Condições</a> e a <a href={LEGAL_LINKS.privacy} target="_blank" rel="noreferrer">Política de Privacidade</a>.
              </span>
            </label>
          )}

          <button className={styles.primary} disabled={loading} type="submit">
            {loading ? <span className={styles.spinner} /> : isDemoMode ? "Explorar demonstração" : mode === "login" ? "Entrar no painel" : "Criar conta"}
            {!loading && <ChevronRight size={18} />}
          </button>
        </form>

        {!isDemoMode && <p className={styles.switch}>
          {mode === "login" ? "Ainda não tem uma conta?" : "Já possui uma conta?"}{" "}
          <button type="button" onClick={changeMode}>
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>}

        <div className={styles.legalLinks}>
          <a href={LEGAL_LINKS.terms}>Termos e Condições</a>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_LINKS.privacy}>Política de Privacidade</a>
          <span aria-hidden="true">·</span>
          <a href={LEGAL_LINKS.support}>Suporte</a>
        </div>
      </section>
    </main>
  );
}

function translateAuthError(message) {
  const safeMessage = typeof message === "string" ? message.trim() : "";
  const normalizedMessage = safeMessage.toLowerCase();
  if (normalizedMessage.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalizedMessage.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (normalizedMessage.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (normalizedMessage.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (safeMessage && safeMessage !== "{}" && safeMessage !== "[object Object]") return safeMessage;
  return "Ocorreu um erro. Tente novamente.";
}
