import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Building2, LoaderCircle, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { COMPANY_AREA_OPTIONS, slugifyCompany } from "../../constants/companyProfile";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { deleteCompanyAccount, updateCompanyDetails } from "../../services/companyService";
import { supabase } from "../../services/supabase";
import styles from "./Perfil.module.css";

export default function Perfil() {
  const { user, logout } = useAuth();
  const { company, companyId, role, refreshCompany } = useCompany();
  const navigate = useNavigate();
  const saveInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState({ name: "", slug: "", country: "", areas: [], description: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteStep, setDeleteStep] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setForm({
      name: company?.name || "",
      slug: company?.slug || "",
      country: company?.country || "",
      areas: Array.isArray(company?.areas) ? company.areas.slice(0, 3) : [],
      description: company?.description || "",
    });
  }, [company?.id, company?.name, company?.slug, company?.country, company?.areas, company?.description]);

  function toggleArea(area) {
    setForm((current) => {
      const selected = current.areas.includes(area);
      if (!selected && current.areas.length >= 3) return current;
      return { ...current, areas: selected ? current.areas.filter((item) => item !== area) : [...current.areas, area] };
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saveInFlightRef.current) return;

    const details = {
      name: form.name.trim(),
      slug: slugifyCompany(form.slug),
      country: form.country.trim(),
      areas: form.areas,
      description: form.description.trim(),
    };
    setForm((current) => ({ ...current, slug: details.slug }));

    if (!details.name || !details.slug || !details.country || !details.description) {
      setMessage({ type: "error", text: "Preencha todos os campos obrigatórios." });
      return;
    }
    if (details.areas.length < 1 || details.areas.length > 3) {
      setMessage({ type: "error", text: "Selecione entre 1 e 3 áreas de atuação." });
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await updateCompanyDetails({ companyId, ...details });
      await refreshCompany();
      setMessage({ type: "success", text: "Perfil da empresa atualizado com sucesso." });
    } catch (error) {
      const duplicateSlug = error?.code === "23505" || String(error?.message || "").toLowerCase().includes("duplicate");
      setMessage({ type: "error", text: duplicateSlug ? "Este slug já está em uso. Escolha outro." : "Não foi possível atualizar o perfil da empresa." });
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  function closeDeleteModal() {
    if (isDeleting || isCheckingPassword) return;
    setDeleteStep(null);
    setPassword("");
    setPasswordError("");
    setConfirmation("");
    setDeleteError("");
  }

  async function handleVerifyPassword(event) {
    event.preventDefault();
    if (!password || isCheckingPassword) return;

    setIsCheckingPassword(true);
    setPasswordError("");

    try {
      const { data: { user: authenticatedUser }, error: userError } =
        await supabase.auth.getUser();

      if (userError || !authenticatedUser?.email) {
        throw new Error("Sessão não autenticada.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: authenticatedUser.email,
        password,
      });

      if (error) {
        setPasswordError("Palavra-passe incorreta.");
        return;
      }

      setDeleteStep("confirmation");
    } catch (error) {
      setPasswordError(error.message || "Não foi possível verificar a palavra-passe.");
    } finally {
      setPassword("");
      setIsCheckingPassword(false);
    }
  }

  async function handleDelete() {
    const expectedConfirmation = `DELETE+${company?.name || ""}`;
    if (confirmation !== expectedConfirmation || deleteInFlightRef.current) return;

    deleteInFlightRef.current = true;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteCompanyAccount({ companyId, confirmation });
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setDeleteError(error.message || "Não foi possível apagar a conta.");
    } finally {
      deleteInFlightRef.current = false;
      setIsDeleting(false);
    }
  }

  const expectedConfirmation = `DELETE+${company?.name || ""}`;
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name || "Não informado";

  return (
    <div className={`${styles.root} page`}>
      <header className={styles.pageHeader}><h1>Perfil</h1><p>Gerencie os seus dados e as informações da empresa.</p></header>
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === "profile"} className={activeTab === "profile" ? styles.activeTab : ""} onClick={() => setActiveTab("profile")}><UserRound size={17} />Perfil</button>
        <button type="button" role="tab" aria-selected={activeTab === "company"} className={activeTab === "company" ? styles.activeTab : ""} onClick={() => setActiveTab("company")}><Building2 size={17} />Empresa</button>
      </div>

      {activeTab === "profile" ? (
        <section className={styles.panel}>
          <h2>Dados do utilizador</h2>
          <div className={styles.readOnlyGrid}>
            <label>Nome<input readOnly value={metadataName} /></label>
            <label>Email<input readOnly value={user?.email || ""} /></label>
            <label>Função<input readOnly value={role || ""} /></label>
          </div>
        </section>
      ) : (
        <>
          <section className={styles.panel}>
            <h2>Informações da empresa</h2>
            {message && <div className={styles[message.type]} role="status">{message.text}</div>}
            <form onSubmit={handleSave}>
              <div className={styles.twoColumns}>
                <label>Nome da empresa *<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Slug *<input required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} /></label>
              </div>
              <label>País *<input required value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} /></label>
              <fieldset><legend>Áreas de atuação * <span>{form.areas.length}/3</span></legend><div className={styles.areaGrid}>{COMPANY_AREA_OPTIONS.map((area) => { const selected = form.areas.includes(area); return <button key={area} type="button" className={selected ? styles.selectedArea : ""} disabled={!selected && form.areas.length >= 3} onClick={() => toggleArea(area)} aria-pressed={selected}>{area}</button>; })}</div></fieldset>
              <label>Descrição da empresa *<textarea required maxLength="1000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /><small>Descreva brevemente o que a empresa faz, os seus produtos, serviços e posicionamento. {form.description.length}/1000</small></label>
              <button className={styles.saveButton} type="submit" disabled={saving}>{saving && <LoaderCircle className={styles.spinner} size={17} />}{saving ? "A guardar..." : "Guardar alterações"}</button>
            </form>
          </section>

          <section className={styles.dangerZone}>
            <div><h2>Zona de perigo</h2><p>A eliminação da conta é permanente e poderá remover definitivamente os dados associados à empresa.</p></div>
            <button type="button" onClick={() => setDeleteStep("warning")}>Apagar conta</button>
          </section>
        </>
      )}

      {deleteStep && (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <AlertTriangle size={28} />
            {deleteStep === "warning" ? (
              <>
                <h2 id="delete-account-title">Apagar conta da empresa?</h2>
                <p>Esta ação removerá definitivamente o workspace da empresa e os dados associados. A sua conta de utilizador será preservada.</p>
                <div className={styles.dialogActions}>
                  <button type="button" onClick={closeDeleteModal}>Cancelar</button>
                  <button type="button" className={styles.continueButton} onClick={() => setDeleteStep("password")}>Continuar</button>
                </div>
              </>
            ) : deleteStep === "password" ? (
              <form onSubmit={handleVerifyPassword}>
                <h2 id="delete-account-title">Confirme a sua palavra-passe</h2>
                <p>Por segurança, confirme a sua palavra-passe antes de continuar.</p>
                <input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(""); }} autoComplete="current-password" autoFocus />
                {passwordError && <div className={styles.error}>{passwordError}</div>}
                <div className={styles.dialogActions}>
                  <button type="button" disabled={isCheckingPassword} onClick={() => { setPassword(""); setPasswordError(""); setDeleteStep("warning"); }}>Voltar</button>
                  <button type="submit" className={styles.continueButton} disabled={!password || isCheckingPassword}>{isCheckingPassword ? "A verificar..." : "Verificar palavra-passe"}</button>
                </div>
              </form>
            ) : (
              <>
                <h2 id="delete-account-title">Confirmação final</h2>
                <p>Para confirmar a eliminação da empresa, escreva exatamente:</p>
                <code>{expectedConfirmation}</code>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" autoFocus />
                {deleteError && <div className={styles.error}>{deleteError}</div>}
                <div className={styles.dialogActions}>
                  <button type="button" disabled={isDeleting} onClick={() => { setConfirmation(""); setDeleteError(""); setDeleteStep("password"); }}>Voltar</button>
                  <button type="button" className={styles.deleteButton} disabled={confirmation !== expectedConfirmation || isDeleting} onClick={handleDelete}>{isDeleting ? "A apagar..." : "Apagar definitivamente"}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
