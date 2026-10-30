import { useEffect, useRef, useState } from "react";
import { ChevronLeft, KeyRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getSession, resetPassword, signOut } from "../../services/authService";
import styles from "./Cadastro.module.css";

export default function RedefinirPassword() {
  const updateInFlightRef = useRef(false);
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    getSession()
      .then(({ data, error }) => {
        if (!active) return;
        setValidSession(!error && Boolean(data?.session?.access_token));
      })
      .catch(() => {
        if (active) setValidSession(false);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (updateInFlightRef.current) return;

    if (newPassword.length < 8) {
      setErrorMessage("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmation) {
      setErrorMessage("As palavras-passe não coincidem.");
      return;
    }

    updateInFlightRef.current = true;
    setLoading(true);
    setErrorMessage("");

    try {
      await resetPassword(newPassword);
      setNewPassword("");
      setConfirmation("");
      setSuccess(true);
    } catch {
      setErrorMessage("Não foi possível atualizar a palavra-passe. Solicite um novo link e tente novamente.");
    } finally {
      updateInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function returnToLogin() {
    await signOut();
    navigate("/login", { replace: true });
  }

  if (checkingSession) {
    return <AuthState><span className={styles.spinner} />A validar o link de recuperação...</AuthState>;
  }

  if (!validSession) {
    return (
      <AuthState>
        <div className={styles.errorMessage}>Este link de recuperação é inválido ou expirou.</div>
        <Link className={styles.backLink} to="/esqueci-password"><ChevronLeft size={16} />Solicitar novo link</Link>
      </AuthState>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <section className={styles.card}>
        <div className={styles.brand}><span><img src="/logo_synap/logic_synap_logo.svg" alt="" /></span>Logic Synap</div>
        <div className={styles.heading}>
          <h1>Definir nova palavra-passe</h1>
          <p>Escolha uma palavra-passe segura com pelo menos 8 caracteres.</p>
        </div>

        {success ? (
          <>
            <div className={styles.successMessage}>Palavra-passe atualizada com sucesso.</div>
            <button className={styles.primary} type="button" onClick={returnToLogin}>Voltar ao login</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
            <label>Nova palavra-passe<input required minLength="8" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label>Confirmar nova palavra-passe<input required minLength="8" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className={styles.primary} disabled={loading} type="submit">
              {loading ? <span className={styles.spinner} /> : <KeyRound size={17} />}
              {loading ? "A atualizar..." : "Alterar palavra-passe"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function AuthState({ children }) {
  return <main className={styles.page}><div className={styles.glow} /><section className={`${styles.card} ${styles.authState}`}>{children}</section></main>;
}
