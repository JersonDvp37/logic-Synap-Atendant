import { useRef, useState } from "react";
import { AlertCircle, LoaderCircle, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "../../contexts/CompanyContext";
import { useWhatsAppChannel } from "../../contexts/WhatsAppChannelContext";
import { testWhatsAppConnection } from "../../services/whatsappChannelService";
import styles from "./WhatsAppModuleGuard.module.css";
import { isDemoMode } from "../../services/demoService";

export default function WhatsAppModuleGuard({ children }) {
  const testInFlightRef = useRef(false);
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const { channel, isConfigured, isActive, loading, error, refreshChannel } = useWhatsAppChannel();
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  async function handleTest() {
    if (testInFlightRef.current) return;
    testInFlightRef.current = true;
    setTesting(true);
    setTestError("");
    try {
      await testWhatsAppConnection(companyId);
      await refreshChannel();
    } catch (requestError) {
      setTestError(requestError.message || "Nao foi possivel testar a conexao.");
      try { await refreshChannel(); } catch { /* Mantem o erro do teste. */ }
    } finally {
      testInFlightRef.current = false;
      setTesting(false);
    }
  }

  if (isDemoMode) return children;

  if (loading) {
    return <div className={`${styles.root} page`}><div className={styles.state}><LoaderCircle className={styles.spinner} size={25} /><strong>A carregar canal WhatsApp...</strong></div></div>;
  }

  if (!isConfigured) {
    return (
      <div className={`${styles.root} page`}>
        <section className={styles.card}>
          <Radio size={32} />
          <h2>Canal WhatsApp n&atilde;o configurado</h2>
          <p>Configure um canal WhatsApp para come&ccedil;ar a utilizar o m&oacute;dulo de Atendimento.</p>
          {error && <div className={styles.error} role="alert"><AlertCircle size={16} />{error}</div>}
          <div className={styles.actions}>
            <button className="primary" type="button" onClick={() => navigate("/atendimento/canal")}>Configurar canal</button>
            {error && <button className={styles.secondary} type="button" onClick={() => refreshChannel().catch(() => {})}>Tentar novamente</button>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      {!isActive && <section className={`${styles.attention} page`} role="status">
        <AlertCircle size={20} />
        <div><strong>Canal configurado, mas a conex&atilde;o precisa de aten&ccedil;&atilde;o.</strong>{channel?.last_error && <p>{channel.last_error}</p>}{testError && <p>{testError}</p>}</div>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" onClick={handleTest} disabled={testing}>{testing ? <LoaderCircle className={styles.spinner} size={15} /> : null}{testing ? "Testando..." : "Testar conexao"}</button>
          <button className="primary" type="button" onClick={() => navigate("/atendimento/canal")}>Ir para Canal</button>
        </div>
      </section>}
      {children}
    </>
  );
}
