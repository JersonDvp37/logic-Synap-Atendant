import { useEffect, useRef, useState } from "react";
import { Building2, LoaderCircle } from "lucide-react";
import { COMPANY_AREA_OPTIONS, slugifyCompany } from "../../constants/companyProfile";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { updateCompanyProfile } from "../../services/companyService";
import styles from "./CompanyProfileOnboarding.module.css";

export default function CompanyProfileOnboarding() {
  const { user, logout } = useAuth();
  const { company, companyId, refreshCompany } = useCompany();
  const slugEditedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const [form, setForm] = useState({ name: "", slug: "", country: "", areas: [], description: "" });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const name = company?.name || "";
    slugEditedRef.current = Boolean(company?.slug);
    setForm({
      name,
      slug: company?.slug || slugifyCompany(name),
      country: company?.country || "",
      areas: Array.isArray(company?.areas) ? company.areas.slice(0, 3) : [],
      description: company?.description || "",
    });
  }, [company?.id, company?.name, company?.slug, company?.country, company?.areas, company?.description]);

  function updateName(value) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugEditedRef.current ? current.slug : slugifyCompany(value),
    }));
  }

  function updateSlug(value) {
    slugEditedRef.current = true;
    setForm((current) => ({ ...current, slug: slugifyCompany(value) }));
  }

  function toggleArea(area) {
    setForm((current) => {
      const selected = current.areas.includes(area);
      if (!selected && current.areas.length >= 3) return current;
      return {
        ...current,
        areas: selected
          ? current.areas.filter((item) => item !== area)
          : [...current.areas, area],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saveInFlightRef.current) return;

    const profile = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      country: form.country.trim(),
      areas: form.areas,
      description: form.description.trim(),
    };

    if (!profile.name || !profile.slug || !profile.country || !profile.description) {
      setErrorMessage("Preencha todos os campos obrigatórios.");
      return;
    }
    if (profile.areas.length < 1 || profile.areas.length > 3) {
      setErrorMessage("Selecione entre 1 e 3 áreas de atuação.");
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setErrorMessage("");

    try {
      await updateCompanyProfile({ companyId, ...profile });
      if (typeof window !== "undefined" && user?.id) {
        window.localStorage.setItem(
          `logic-synap:welcome-pending:${user.id}`,
          "true"
        );
      }
      await refreshCompany();
    } catch (error) {
      const duplicateSlug = error?.code === "23505" || String(error?.message || "").toLowerCase().includes("duplicate");
      setErrorMessage(duplicateSlug
        ? "Este slug já está em uso. Escolha outro."
        : "Não foi possível guardar o perfil da empresa. Tente novamente.");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="company-profile-title">
        <div className={styles.icon}><Building2 size={25} /></div>
        <header>
          <h1 id="company-profile-title">Configure o perfil da sua empresa</h1>
          <p>Estas informações ajudam a personalizar o contexto e a experiência do workspace.</p>
        </header>

        {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.twoColumns}>
            <label>Nome da empresa *<input required value={form.name} onChange={(event) => updateName(event.target.value)} /></label>
            <label>Slug *<input required value={form.slug} onChange={(event) => updateSlug(event.target.value)} placeholder="nome-da-empresa" /></label>
          </div>
          <label>País *<input required value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder="Ex.: Moçambique" /></label>

          <fieldset>
            <legend>Áreas de atuação * <span>{form.areas.length}/3</span></legend>
            <div className={styles.areaGrid}>
              {COMPANY_AREA_OPTIONS.map((area) => {
                const selected = form.areas.includes(area);
                return (
                  <button key={area} type="button" className={selected ? styles.selectedArea : ""} disabled={!selected && form.areas.length >= 3} onClick={() => toggleArea(area)} aria-pressed={selected}>
                    {area}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label>
            Descrição da empresa *
            <textarea required maxLength="1000" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            <small>Descreva brevemente o que a empresa faz, os seus serviços, produtos ou principal área de atuação. {form.description.length}/1000</small>
          </label>

          <div className={styles.actions}>
            <button className={styles.logout} type="button" disabled={saving} onClick={() => logout()}>
              Sair da conta
            </button>
            <button className={styles.submit} type="submit" disabled={saving}>
              {saving && <LoaderCircle className={styles.spinner} size={17} />}
              {saving ? "A guardar..." : "Guardar perfil e continuar"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

