import { createContext, useCallback, useContext, useEffect, useState, } from "react";
import { useAuth } from "./AuthContext";
import {createCompany, getMyCompany, } from "../services/companyService";

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user, authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyError, setCompanyError] = useState(null);

  const loadCompany = useCallback(async () => {
    if (!userId) {
      setCompany(null);
      setRole(null);
      setCompanyError(null);
      setCompanyLoading(false);
      return;
    }

    try {
      setCompanyLoading(true);
      setCompanyError(null);

      const { data, error } = await getMyCompany();

      if (error) {
        throw error;
      }

      if (!data) {
        setCompany(null);
        setRole(null);
        return;
      }

      const companyData = Array.isArray(data.companies)
        ? data.companies[0]
        : data.companies;

      setCompany(
        companyData
          ? {
              id: data.company_id,
              name: companyData.name,
              slug: companyData.slug,
              country: companyData.country,
              areas: companyData.areas,
              description: companyData.description,
              profile_completed: companyData.profile_completed,
              status: companyData.status,
            }
          : null
      );

      setRole(data.role ?? null);
    } catch (error) {
      console.error("Erro ao carregar empresa:", error);
      setCompany(null);
      setRole(null);
      setCompanyError(error.message || "Erro ao carregar empresa.");
    } finally {
      setCompanyLoading(false);
    }
  }, [userId]);

  async function createWorkspace(companyName) {
    const cleanName = companyName.trim();

    if (!cleanName) {
      throw new Error("Informe o nome da empresa.");
    }

    const { data, error } = await createCompany(cleanName);

    if (error) {
      throw error;
    }

    await loadCompany();

    return data;
  }

  function clearCompany() {
    setCompany(null);
    setRole(null);
    setCompanyError(null);
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    loadCompany();
  }, [authLoading, loadCompany]);

  const value = {
    company,
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    companyStatus: company?.status ?? null,
    role,
    companyLoading,
    companyError,
    hasCompany: Boolean(company?.id),
    createWorkspace,
    refreshCompany: loadCompany,
    clearCompany,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error(
      "useCompany deve ser utilizado dentro de CompanyProvider"
    );
  }

  return context;
}