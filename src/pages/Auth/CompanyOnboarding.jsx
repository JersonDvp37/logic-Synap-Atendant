import { useState } from "react";
import { Building2, ChevronRight } from "lucide-react";

import { useCompany } from "../../contexts/CompanyContext";

export default function CompanyOnboarding() {
  const { createWorkspace } = useCompany();

  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      await createWorkspace(companyName);
    } catch (error) {
      console.error("Erro ao criar empresa:", error);

      setErrorMessage(
        error.message || "Não foi possível criar a empresa."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-icon">
          <Building2 size={24} />
        </div>

        <div className="auth-heading">
          <h1>Configure sua empresa</h1>

          <p>
            Crie o workspace que será usado para organizar os
            documentos e serviços da empresa.
          </p>
        </div>

        {errorMessage && (
          <div className="auth-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={submit}>
          <label>
            Nome da empresa

            <input
              required
              value={companyName}
              onChange={(event) =>
                setCompanyName(event.target.value)
              }
              placeholder="Ex.: Logic Synap"
            />
          </label>

          <button
            type="submit"
            className="primary full"
            disabled={loading}
          >
            {loading ? "Criando..." : "Criar workspace"}

            {!loading && <ChevronRight size={18} />}
          </button>
        </form>
      </section>
    </main>
  );
}