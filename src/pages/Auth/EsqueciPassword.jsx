import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../services/authService";
import styles from "./Cadastro.module.css";

const RESET_COOLDOWN_MS = 60_000;
const RESET_COOLDOWN_KEY = "password-reset-cooldown-until";

export default function EsqueciPassword() {
  const requestInFlightRef = useRef(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    const storedValue = Number(sessionStorage.getItem(RESET_COOLDOWN_KEY));
    return Number.isFinite(storedValue) ? storedValue : 0;
  });
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    function updateCooldown() {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining === 0) sessionStorage.removeItem(RESET_COOLDOWN_KEY);
    }

    updateCooldown();
    if (cooldownUntil <= Date.now()) return undefined;

    const timer = window.setInterval(updateCooldown, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (requestInFlightRef.current || cooldownUntil > Date.now()) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setErrorMessage("Introduza um email válido.");
      return;
    }

    requestInFlightRef.current = true;
    const nextAllowedAt = Date.now() + RESET_COOLDOWN_MS;
    sessionStorage.setItem(RESET_COOLDOWN_KEY, String(nextAllowedAt));
    setCooldownUntil(nextAllowedAt);
    setLoading(true);
    setErrorMessage("");

    try {
      await requestPasswordReset(normalizedEmail);
      setSuccess(true);
    } catch (error) {
      console.error("Erro ao solicitar recuperação de palavra-passe:", error);
      setErrorMessage(translatePasswordResetError(error));
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <section className={styles.card}>
        <div className={styles.brand}><span><img src="/logo_synap/logic_synap_logo.svg" alt="" /></span>Logic Synap</div>
        <div className={styles.heading}>
          <h1>Recuperar palavra-passe</h1>
          <p>Introduza o email associado à sua conta.</p>
        </div>

        {success && (
          <div className={styles.successMessage}>
            Se existir uma conta associada a este email, receberá instruções para redefinir a palavra-passe.
          </div>
        )}
        {errorMessage && <div className={styles.errorMessage} role="alert">{errorMessage}</div>}

        {!success && (
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@example.com" />
            </label>
            <button className={styles.primary} disabled={loading || cooldownSeconds > 0} type="submit" aria-busy={loading}>
              {loading ? <span className={styles.spinner} /> : <Mail size={17} />}
              {loading
                ? "Processando..."
                : cooldownSeconds > 0
                  ? `Tente novamente em ${cooldownSeconds}s`
                  : "Enviar instruções"}
            </button>
          </form>
        )}

        <Link className={styles.backLink} to="/login"><ChevronLeft size={16} />Voltar ao login</Link>
      </section>
    </main>
  );
}

function translatePasswordResetError(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = error?.status;

  if (status === 429 || message.includes("rate limit") || message.includes("security purposes")) {
    return "Foram feitas muitas tentativas. Aguarde alguns minutos antes de solicitar outro e-mail.";
  }

  if (message.includes("smtp") || message.includes("sending") || message.includes("email")) {
    return "O serviço de e-mail não conseguiu concluir o envio. Verifique a configuração SMTP do projeto.";
  }

  return "Não foi possível enviar as instruções agora. Tente novamente em alguns minutos.";
}
