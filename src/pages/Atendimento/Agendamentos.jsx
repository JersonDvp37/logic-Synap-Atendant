import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, Copy, LoaderCircle, Plus, RefreshCw, Save, Trash2, X, XCircle } from "lucide-react";
import { useCompany } from "../../contexts/CompanyContext";
import { createBlockedDay, deleteBlockedDay, getAppointments, getAvailabilityRules, getBlockedDays, rescheduleAppointment, saveAvailabilityRules, updateAppointmentStatus } from "../../services/appointmentService";
import { useNotificationPolling } from "../../hooks/useNotificationPolling";
import styles from "./Agendamentos.module.css";

const DAYS = [
  { day: 1, label: "Segunda-feira" }, { day: 2, label: "Terça-feira" }, { day: 3, label: "Quarta-feira" },
  { day: 4, label: "Quinta-feira" }, { day: 5, label: "Sexta-feira" }, { day: 6, label: "Sábado" }, { day: 7, label: "Domingo" },
];
const STATUS = [{ value: "all", label: "Todos" }, { value: "confirmado", label: "Confirmados" }, { value: "pendente", label: "Pendentes" }, { value: "cancelado", label: "Cancelados" }, { value: "concluido", label: "Concluídos" }];
const localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const defaultRules = () => DAYS.map(({ day }) => ({ day, enabled: day <= 5, start: "08:00", end: "17:00", description: "" }));
const slotsFor = (rule, duration) => { if (!rule.enabled) return 0; const [sh, sm] = rule.start.split(":").map(Number); const [eh, em] = rule.end.split(":").map(Number); const minutes = eh * 60 + em - sh * 60 - sm; return minutes > 0 ? Math.floor(minutes / duration) : 0; };
const formatDate = (value) => value ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value + "T12:00:00")) : "";
const normalizeRule = (row) => ({ day: Number(row.dia_semana), enabled: !row.bloqueado, start: String(row.hora_inicio || "08:00").slice(0, 5), end: String(row.hora_fim || "17:00").slice(0, 5), description: row.descricao_intervalo || "" });
const normalizeBlockedDay = (row) => ({ ...row, name: row.nome || row.nome_evento || row.event_name || row.name || "Dia bloqueado", date: row.data_bloqueio || row.blocked_date || row.date || "", description: row.descricao || row.description || "" });
const STATUS_ALIASES = { confirmed: "confirmado", pending: "pendente", canceled: "cancelado", cancelled: "cancelado", completed: "concluido" };
const normalizeStatus = (value) => STATUS_ALIASES[String(value || "pendente").toLowerCase()] || String(value || "pendente").toLowerCase();
function localPartsFromTimestamp(value, duration) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", start: "", end: "" };
  const pad = (number) => String(number).padStart(2, "0");
  const date = parsed.getFullYear() + "-" + pad(parsed.getMonth() + 1) + "-" + pad(parsed.getDate());
  const start = pad(parsed.getHours()) + ":" + pad(parsed.getMinutes());
  const endDate = new Date(parsed.getTime() + duration * 60000);
  const end = pad(endDate.getHours()) + ":" + pad(endDate.getMinutes());
  return { date, start, end };
}
const normalizeAppointment = (row, duration) => ({ ...row, ...localPartsFromTimestamp(row.data_agendamento, duration), name: row.customer_name || "Cliente sem nome", phone: row.customer_phone || "Telefone não informado", status: normalizeStatus(row.status) });

export default function Agendamentos() {
  const { companyId } = useCompany();
  const [section, setSection] = useState("availability");
  const [duration, setDuration] = useState(30);
  const [rules, setRules] = useState(defaultRules);
  const [loadingRules, setLoadingRules] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [date, setDate] = useState(localToday);
  const [status, setStatus] = useState("all");
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [rescheduling, setRescheduling] = useState(null);
  const [form, setForm] = useState({ date: localToday(), start: "10:00", end: "10:30" });
  const [futureLimit, setFutureLimit] = useState(30);
  const [blockedDays, setBlockedDays] = useState([]);
  const [loadingBlockedDays, setLoadingBlockedDays] = useState(true);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [blockedForm, setBlockedForm] = useState({ name: "", date: localToday(), description: "" });
  const [notification, setNotification] = useState(null);

  const loadRules = useCallback(async () => {
    if (!companyId) return;
    setLoadingRules(true);
    try {
      const { data, error } = await getAvailabilityRules(companyId);
      if (error) throw error;
      if (data?.length) {
        const mapped = data.map(normalizeRule);
        setRules(defaultRules().map((item) => ({ ...item, ...(mapped.find((rule) => rule.day === item.day) || {}) })));
        const stored = data.find((item) => item.duracao_slot_minutos || item.limite_dias_futuro); if (stored) { setDuration(Number(stored.duracao_slot_minutos || 30)); setFutureLimit(Number(stored.limite_dias_futuro || 30)); }
              }
    } catch (error) { setMessage({ type: "error", text: error.message || "Não foi possível carregar os horários." }); }
    finally { setLoadingRules(false); }
  }, [companyId]);
  const loadBlockedDays = useCallback(async () => { if (!companyId) return; setLoadingBlockedDays(true); try { const { data, error } = await getBlockedDays(companyId); if (error) throw error; setBlockedDays((data || []).map(normalizeBlockedDay)); } catch (error) { setMessage({ type: "error", text: error.message || "Não foi possível carregar os dias bloqueados." }); } finally { setLoadingBlockedDays(false); } }, [companyId]);
  const loadAppointments = useCallback(async () => {
    if (!companyId) return;
    setLoadingAppointments(true); setAppointmentsError("");
    try {
      const { data, error } = await getAppointments({ companyId, date, status });
      if (error) throw error;
      setAppointments((data || []).map((item) => normalizeAppointment(item, duration)));
    } catch (error) { setAppointments([]); setAppointmentsError(error.message || "Não foi possível carregar os agendamentos."); }
    finally { setLoadingAppointments(false); }
  }, [companyId, date, status, duration]);
  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadBlockedDays(); }, [loadBlockedDays]);
  useEffect(() => { if (section === "appointments") loadAppointments(); }, [section, loadAppointments]);
  const handleNotification = useCallback(({ total, changes }) => { const message = changes.map((item) => item.count + " " + item.label).join(" e "); setNotification({ total, message }); const audio = new Audio("/notify/notification.mp3"); audio.play().catch(() => {}); if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Logic Synap Hub", { body: message, icon: "/favicon.svg" }); }, []);
  useEffect(() => { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {}); }, []);
  useNotificationPolling({ companyId, onNotification: handleNotification });
  useEffect(() => { if (!notification) return undefined; const timeoutId = window.setTimeout(() => setNotification(null), 9000); return () => window.clearTimeout(timeoutId); }, [notification]);


  const totalSlots = useMemo(() => rules.reduce((total, rule) => total + slotsFor(rule, duration), 0), [rules, duration]);
  const changeRule = (day, field, value) => { setMessage(null); setRules((current) => current.map((rule) => rule.day === day ? { ...rule, [field]: value } : rule)); };
  const copyMonday = () => { const monday = rules.find((rule) => rule.day === 1); setRules((current) => current.map((rule) => rule.day > 1 && rule.day < 6 ? { ...rule, enabled: monday.enabled, start: monday.start, end: monday.end } : rule)); setMessage({ type: "success", text: "O horário de segunda foi aplicado de terça a sexta." }); };
  async function saveRules() { setSaving(true); setMessage(null); try { const { error } = await saveAvailabilityRules({ companyId, rules, slotDuration: duration, futureLimit }); if (error) throw error; setMessage({ type: "success", text: "Disponibilidade salva com sucesso." }); } catch (error) { setMessage({ type: "error", text: error.message || "Não foi possível salvar a disponibilidade." }); } finally { setSaving(false); } }
  async function cancel(appointment) { if (!window.confirm("Cancelar o agendamento de " + appointment.name + "?")) return; setActionLoading(appointment.id); try { const { error } = await updateAppointmentStatus({ companyId, appointmentId: appointment.id, status: "cancelado" }); if (error) throw error; await loadAppointments(); } catch (error) { setAppointmentsError(error.message || "Não foi possível cancelar o agendamento."); } finally { setActionLoading(""); } }
  function openReschedule(appointment) { setRescheduling(appointment); setForm({ date: appointment.date || date, start: appointment.start || "10:00", end: appointment.end || "10:30" }); }
  async function submitReschedule(event) { event.preventDefault(); setActionLoading(rescheduling.id); try { const { error } = await rescheduleAppointment({ companyId, appointmentId: rescheduling.id, date: form.date, startTime: form.start, endTime: form.end }); if (error) throw error; setRescheduling(null); await loadAppointments(); } catch (error) { setAppointmentsError(error.message || "Não foi possível remarcar o agendamento."); } finally { setActionLoading(""); } }

  async function submitBlockedDay(event) { event.preventDefault(); try { const { error } = await createBlockedDay({ companyId, name: blockedForm.name.trim(), date: blockedForm.date, description: blockedForm.description.trim() }); if (error) throw error; setBlockedModalOpen(false); setBlockedForm({ name: "", date: localToday(), description: "" }); await loadBlockedDays(); } catch (error) { setMessage({ type: "error", text: error.message || "Não foi possível adicionar o dia bloqueado." }); } }
  async function removeBlockedDay(day) { if (!window.confirm("Remover o bloqueio de " + day.name + "?")) return; try { const { error } = await deleteBlockedDay({ companyId, blockedDayId: day.id }); if (error) throw error; await loadBlockedDays(); } catch (error) { setMessage({ type: "error", text: error.message || "Não foi possível remover o bloqueio." }); } }
  return <div className={styles.root}><NotificationToast data={notification} onClose={() => setNotification(null)} />
    <div className={styles.pageIntro}><div><span className={styles.eyebrow}>OPERAÇÃO · AGENDA</span><h1>Gestão de agendamentos</h1><p>Defina a janela de atendimento e acompanhe as reservas do seu time.</p></div>{section === "availability" && <button className={styles.primaryButton} type="button" onClick={saveRules} disabled={saving || loadingRules}><Save size={17} />{saving ? "Salvando..." : "Salvar disponibilidade"}</button>}</div>
    <nav className={styles.sectionTabs} aria-label="Seções de agendamentos"><button type="button" className={section === "availability" ? styles.tabActive : ""} onClick={() => setSection("availability")}><Clock3 size={17} /><span>Regras de disponibilidade</span><small>Janela de atendimento</small></button><button type="button" className={section === "appointments" ? styles.tabActive : ""} onClick={() => setSection("appointments")}><CalendarDays size={17} /><span>Visão geral</span><small>Calendário e reservas</small></button></nav>
    {section === "availability" ? <><Availability rules={rules} loading={loadingRules} duration={duration} totalSlots={totalSlots} message={message} setDuration={setDuration} futureLimit={futureLimit} setFutureLimit={setFutureLimit} changeRule={changeRule} copyMonday={copyMonday} /> <BlockedDays days={blockedDays} loading={loadingBlockedDays} openModal={() => setBlockedModalOpen(true)} remove={removeBlockedDay} /> </> : <Appointments date={date} status={status} appointments={appointments} loading={loadingAppointments} error={appointmentsError} actionLoading={actionLoading} setDate={setDate} setStatus={setStatus} refresh={loadAppointments} cancel={cancel} reschedule={openReschedule} />}
    {blockedModalOpen && <BlockedDayModal form={blockedForm} setForm={setBlockedForm} close={() => setBlockedModalOpen(false)} submit={submitBlockedDay} />}
    {rescheduling && <Reschedule appointment={rescheduling} form={form} loading={actionLoading === rescheduling.id} setForm={setForm} close={() => setRescheduling(null)} submit={submitReschedule} />}
  </div>;
}

function Availability({ rules, loading, duration, totalSlots, message, setDuration, futureLimit, setFutureLimit, changeRule, copyMonday }) {
  return <section className={styles.contentStack}><div className={styles.globalCard}><div className={styles.cardHeading}><div className={styles.headingIcon}><Clock3 size={19} /></div><div><h2>Configuração global</h2><p>Os slots são calculados automaticamente dentro da janela de cada dia.</p></div></div><div className={styles.globalFields}><label>Duração padrão do slot<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[15, 30, 45, 60].map((item) => <option key={item} value={item}>{item} min</option>)}</select></label><label>Permitir agendamentos até quantos dias no futuro?<input className={styles.futureLimitInput} type="number" min="1" value={futureLimit} onChange={(event) => setFutureLimit(Math.max(1, Number(event.target.value) || 1))} /></label><div className={styles.totalSlots}><span>Capacidade semanal</span><strong>{totalSlots} <small>slots disponíveis</small></strong><p>considerando os dias ativos</p></div></div></div><div className={styles.daysCard}><div className={styles.cardHeader}><div><h2>Disponibilidade semanal</h2><p>Ative os dias e escolha a janela de atendimento.</p></div><button className={styles.secondaryButton} type="button" onClick={copyMonday}><Copy size={15} />Copiar segunda para terça–sexta</button></div><div className={styles.dayList}>{loading ? <Loading text="Carregando horários..." /> : rules.map((rule) => <DayRow key={rule.day} rule={rule} duration={duration} change={changeRule} />)}</div></div>{message && <Message data={message} />}</section>;
}
function DayRow({ rule, duration, change }) { const [expanded, setExpanded] = useState(false); const day = DAYS.find((item) => item.day === rule.day); return <div className={styles.dayRow + (rule.enabled ? "" : " " + styles.dayDisabled)}><div className={styles.dayHeader}><div className={styles.dayIdentity}><button type="button" className={styles.switch + (rule.enabled ? " " + styles.switchOn : "")} role="switch" aria-checked={rule.enabled} aria-label={"Ativar " + day.label} onClick={() => change(rule.day, "enabled", !rule.enabled)}><span /></button><div><strong>{day.label}</strong><span>{rule.enabled ? "Atendimento ativo" : "Fechado / Indisponível"}</span></div></div>{rule.enabled && <button type="button" className={styles.mobileDayToggle} onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-label={"Mostrar horários de " + day.label}><ChevronDown size={18} className={expanded ? styles.chevronOpen : ""} /></button>}</div>{rule.enabled ? <div className={styles.dayControls + (expanded ? " " + styles.mobileExpanded : "")}><div className={styles.timeInputGroup}><label>Início<input type="time" value={rule.start} onChange={(event) => change(rule.day, "start", event.target.value)} /></label><span>até</span><label>Fim<input type="time" value={rule.end} onChange={(event) => change(rule.day, "end", event.target.value)} /></label></div><label className={styles.intervalInput}>Descrição do intervalo<input type="text" placeholder="Ex: Pausa para almoço das 12h às 13h" value={rule.description} onChange={(event) => change(rule.day, "description", event.target.value)} /></label><span className={styles.slotBadge}>{slotsFor(rule, duration)} slots disponíveis</span></div> : <span className={styles.closedBadge}>Fechado / Indisponível</span>}</div>; }
function BlockedDays({ days, loading, openModal, remove }) { return <section className={styles.blockedCard}><div className={styles.cardHeader}><div><h2>Feriados e exceções</h2><p>Bloqueie datas específicas para impedir novos agendamentos.</p></div><button type="button" className={styles.primaryButton} onClick={openModal}><Plus size={16} />Adicionar Dia Bloqueado</button></div>{loading ? <Loading text="Carregando dias bloqueados..." /> : days.length ? <div className={styles.blockedList}>{days.map((day) => <article className={styles.blockedItem} key={day.id}><div className={styles.blockedDate}><CalendarDays size={17} /><strong>{formatDate(day.date)}</strong></div><div className={styles.blockedInfo}><strong>{day.name}</strong>{day.description && <span>{day.description}</span>}</div><span className={styles.blockedBadge}>Bloqueado</span><button type="button" className={styles.deleteButton} onClick={() => remove(day)} aria-label={"Remover " + day.name}><Trash2 size={16} /></button></article>)}</div> : <div className={styles.blockedEmpty}><CalendarDays size={24} /><span>Nenhum dia bloqueado cadastrado.</span></div>}</section>; }

function BlockedDayModal({ form, setForm, close, submit }) { return <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="blocked-day-title"><button className={styles.modalClose} type="button" onClick={close} aria-label="Fechar"><X size={18} /></button><div className={styles.modalIcon}><CalendarDays size={19} /></div><h2 id="blocked-day-title">Adicionar dia bloqueado</h2><p>Essa data ficará indisponível para novos agendamentos.</p><form onSubmit={submit}><label>Nome do evento<input type="text" value={form.name} placeholder="Ex: Aniversário da Empresa" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label><label>Data do bloqueio<input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></label><label>Descrição opcional<textarea value={form.description} placeholder="Detalhes adicionais" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={close}>Voltar</button><button type="submit" className={styles.primaryButton}><Check size={16} />Bloquear data</button></div></form></section></div>; }

function Appointments({ date, status, appointments, loading, error, actionLoading, setDate, setStatus, refresh, cancel, reschedule }) { return <section className={styles.contentStack}><div className={styles.filtersCard}><label><span>Data da agenda</span><div className={styles.dateInput}><CalendarDays size={17} /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></label><div className={styles.statusFilters}><span>Status</span><div>{STATUS.map((item) => <button key={item.value} type="button" className={status === item.value ? styles.filterActive : ""} onClick={() => setStatus(item.value)}>{item.label}</button>)}</div></div><button className={styles.refreshButton} type="button" onClick={refresh} disabled={loading}><RefreshCw className={loading ? styles.spinner : ""} size={16} />Atualizar</button></div><div className={styles.appointmentsCard}><div className={styles.cardHeader}><div><h2>{formatDate(date)}</h2><p>{appointments.length ? appointments.length + " reserva" + (appointments.length === 1 ? "" : "s") + " encontrada" + (appointments.length === 1 ? "" : "s") : "Nenhuma reserva para os filtros selecionados."}</p></div><span className={styles.dateSummary}><CalendarDays size={16} />Agenda do dia</span></div>{error && <Message data={{ type: "error", text: error }} />}{loading ? <Loading text="Carregando reservas..." /> : appointments.length ? <div className={styles.appointmentList}>{appointments.map((item) => <AppointmentRow key={item.id} appointment={item} loading={actionLoading === item.id} cancel={cancel} reschedule={reschedule} />)}</div> : <div className={styles.emptyState}><CalendarDays size={28} /><strong>Agenda livre</strong><p>As reservas deste dia aparecerão aqui quando forem criadas.</p></div>}</div></section>; }
function AppointmentRow({ appointment, loading, cancel, reschedule }) {
  const label = { confirmado: "Confirmado", cancelado: "Cancelado", pendente: "Pendente", concluido: "Concluído" }[appointment.status] || "Pendente";
  const statusClass = appointment.status === "confirmado" ? styles.statusConfirmed : appointment.status === "cancelado" ? styles.statusCanceled : styles.statusPending;
  return <article className={styles.appointmentRow}><div className={styles.appointmentTime}><Clock3 size={17} /><strong>{appointment.start || "--:--"} – {appointment.end || "--:--"}</strong></div><div className={styles.customer}><strong>{appointment.name}</strong><span>{appointment.phone}</span></div><span className={styles.statusBadge + " " + statusClass}>{appointment.status === "confirmado" ? <CheckCircle2 size={14} /> : appointment.status === "cancelado" ? <XCircle size={14} /> : <Clock3 size={14} />}{label}</span><div className={styles.appointmentActions}>{appointment.status !== "cancelado" && appointment.status !== "concluido" && <><button type="button" className={styles.textButton} onClick={() => reschedule(appointment)} disabled={loading}>Remarcar</button><button type="button" className={styles.cancelButton} onClick={() => cancel(appointment)} disabled={loading}>{loading ? <LoaderCircle className={styles.spinner} size={14} /> : <X size={14} />}Cancelar</button></>}</div></article>; }
function Reschedule({ appointment, form, loading, setForm, close, submit }) { return <div className={styles.modalBackdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="reschedule-title"><button className={styles.modalClose} type="button" onClick={close} aria-label="Fechar"><X size={18} /></button><div className={styles.modalIcon}><CalendarDays size={19} /></div><h2 id="reschedule-title">Remarcar agendamento</h2><p>{appointment.name} · {appointment.phone}</p><form onSubmit={submit}><label>Data<input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></label><div className={styles.modalTimeFields}><label>Início<input type="time" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} required /></label><label>Fim<input type="time" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} required /></label></div><div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={close}>Voltar</button><button type="submit" className={styles.primaryButton} disabled={loading}>{loading ? <LoaderCircle className={styles.spinner} size={16} /> : <Check size={16} />}Salvar novo horário</button></div></form></section></div>; }
function NotificationToast({ data, onClose }) { if (!data) return null; return <div className={styles.notificationToast} role="status"><div className={styles.notificationIcon}><CheckCircle2 size={17} /></div><div><strong>Novas atualizações</strong><span>{data.message}</span></div><button type="button" onClick={onClose} aria-label="Fechar notificação"><X size={16} /></button></div>; }

function Loading({ text }) { return <div className={styles.loadingState}><LoaderCircle className={styles.spinner} size={20} />{text}</div>; }
function Message({ data }) { return <div className={styles.message + " " + (data.type === "error" ? styles.messageError : styles.messageSuccess)} role={data.type === "error" ? "alert" : "status"}>{data.type === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{data.text}</div>; }
