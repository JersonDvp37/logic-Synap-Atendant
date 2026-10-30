export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "suporte@example.com";
export const OPERATOR_NAME = import.meta.env.VITE_OPERATOR_NAME || "Responsável pela instalação";

export const LEGAL_LINKS = {
  privacy: "/privacidade",
  terms: "/termos",
  support: `mailto:${SUPPORT_EMAIL}`,
  website: import.meta.env.VITE_PUBLIC_WEBSITE_URL || "https://example.com",
};
