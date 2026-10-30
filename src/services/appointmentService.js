import { supabase } from "./supabase";

const AVAILABILITY_TABLE = "empresa_horarios_disponiveis";
const APPOINTMENTS_TABLE = "agendamentos";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase não está configurado.");
}

function getLocalDayRange(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  if (!year || !month || !day) return null;
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function buildAppointmentTimestamp(date, time) {
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Data ou hora do agendamento inválida.");
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export async function getAvailabilityRules(companyId) {
  assertSupabase();
  if (!companyId) throw new Error("Empresa não identificada.");
  return supabase.from(AVAILABILITY_TABLE).select("*").eq("company_id", companyId).order("dia_semana", { ascending: true });
}

async function saveAvailabilityRule(companyId, rule, slotDuration, futureLimit) {
  const payload = {
    company_id: companyId,
    dia_semana: rule.day,
    hora_inicio: rule.start,
    hora_fim: rule.end,
    duracao_slot_minutos: slotDuration,
    descricao_intervalo: rule.description || null,
    limite_dias_futuro: futureLimit,
    bloqueado: !rule.enabled,
    updated_at: new Date().toISOString(),
  };
  const existing = await supabase.from(AVAILABILITY_TABLE).select("id").eq("company_id", companyId).eq("dia_semana", rule.day).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (existing.error) return existing;
  if (existing.data?.id) {
    return supabase.from(AVAILABILITY_TABLE).update(payload).eq("id", existing.data.id).eq("company_id", companyId);
  }
  return supabase.from(AVAILABILITY_TABLE).insert({ ...payload, created_at: new Date().toISOString() });
}

export async function saveAvailabilityRules({ companyId, rules, slotDuration, futureLimit }) {
  assertSupabase();
  if (!companyId) throw new Error("Empresa não identificada.");
  const results = await Promise.all(rules.map((rule) => saveAvailabilityRule(companyId, rule, slotDuration, futureLimit)));
  const failed = results.find((result) => result.error);
  return failed || { data: results.map((result) => result.data ?? null), error: null };
}

export async function getAppointments({ companyId, date, status }) {
  assertSupabase();
  if (!companyId) throw new Error("Empresa não identificada.");
  let query = supabase.from(APPOINTMENTS_TABLE).select("*").eq("company_id", companyId).order("data_agendamento", { ascending: true });
  if (date) {
    const range = getLocalDayRange(date);
    if (range) query = query.gte("data_agendamento", range.start).lt("data_agendamento", range.end);
  }
  if (status && status !== "all") query = query.eq("status", status);
  return query;
}

const BLOCKED_DAYS_TABLE = "empresa_dias_bloqueados";

export async function getBlockedDays(companyId) {
  assertSupabase();
  if (!companyId) throw new Error("Empresa não identificada.");
  return supabase.from(BLOCKED_DAYS_TABLE).select("*").eq("company_id", companyId).order("data_bloqueio", { ascending: true });
}

export async function createBlockedDay({ companyId, name, date, description }) {
  assertSupabase();
  if (!companyId) throw new Error("Empresa não identificada.");
  return supabase.from(BLOCKED_DAYS_TABLE).insert({
    company_id: companyId,
    nome: name,
    data_bloqueio: date,
    descricao: description || null,
  });
}

export async function deleteBlockedDay({ companyId, blockedDayId }) {
  assertSupabase();
  if (!companyId || !blockedDayId) throw new Error("Dia bloqueado não identificado.");
  return supabase.from(BLOCKED_DAYS_TABLE).delete().eq("company_id", companyId).eq("id", blockedDayId);
}

export async function updateAppointmentStatus({ companyId, appointmentId, status }) {
  assertSupabase();
  if (!companyId || !appointmentId) throw new Error("Agendamento não identificado.");
  return supabase.from(APPOINTMENTS_TABLE).update({ status, updated_at: new Date().toISOString() }).eq("company_id", companyId).eq("id", appointmentId);
}

export async function rescheduleAppointment({ companyId, appointmentId, date, startTime }) {
  assertSupabase();
  if (!companyId || !appointmentId) throw new Error("Agendamento não identificado.");
  return supabase.from(APPOINTMENTS_TABLE).update({
    data_agendamento: buildAppointmentTimestamp(date, startTime),
    updated_at: new Date().toISOString(),
  }).eq("company_id", companyId).eq("id", appointmentId);
}
