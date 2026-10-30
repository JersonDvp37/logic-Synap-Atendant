export const COMPANY_AREA_OPTIONS = [
  "Tecnologia", "Consultoria", "Comércio e Vendas", "Educação", "Saúde",
  "Jurídico", "Imobiliário", "Finanças", "Recursos Humanos", "Culinariaria e Alimentação",
  "Marketing e Comunicação", "Design e Artes", "Construção e Engenharia",
  "Turismo e Hotelaria", "Logística e Transportes", "Serviços Profissionais",
  "Indústria", "Agricultura", "Outro",
];

export function slugifyCompany(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
