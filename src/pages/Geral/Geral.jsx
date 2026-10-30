import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, BookOpen, Bot, FileText, Gauge, LoaderCircle, MessageCircle, MessageSquare, Radio, RefreshCw, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "../../contexts/CompanyContext";
import { useWhatsAppChannel } from "../../contexts/WhatsAppChannelContext";
import { getGeralData } from "../../services/geralService";
import { useFeatureDiscovery } from "../../hooks/useFeatureDiscovery";
import styles from "./Geral.module.css";

function formatRelativeDate(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}

function knowledgeStatus(total, ready) {
  if (total === null) return { label: "Indisponível", tone: "neutral" };
  if (total === 0) return { label: "Sem documentos", tone: "neutral" };
  if (ready > 0) return { label: "Disponível", tone: "success" };
  return { label: "Em processamento", tone: "warning" };
}

export default function Geral() {
  const { companyId, companyName } = useCompany();
  const { channel, isConfigured, isActive, loading: channelLoading, error: channelError, refreshChannel } = useWhatsAppChannel();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(false);
  const featureDiscovery = useFeatureDiscovery();

  const loadData = useCallback(async ({ initial = false } = {}) => {
    if (!companyId || requestRef.current) return;
    requestRef.current = true;
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      setData(await getGeralData(companyId));
    } catch (error) {
      console.error("Erro ao carregar a visão geral:", error);
      setData(null);
    } finally {
      requestRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { loadData({ initial: true }); }, [loadData]);

  async function refresh() {
    await Promise.allSettled([loadData(), refreshChannel()]);
  }

  const internalStatus = knowledgeStatus(data?.metrics.internalDocuments ?? null, data?.readyDocuments.internal ?? 0);
  const serviceStatus = knowledgeStatus(data?.metrics.serviceDocuments ?? null, data?.readyDocuments.service ?? 0);
  const totalDocuments = data && !data.errors.documents ? data.metrics.internalDocuments + data.metrics.serviceDocuments : null;
  const whatsappLabel = channelLoading ? "A verificar" : isActive ? "Conectado" : isConfigured ? "Com problema" : "Não configurado";
  const chartHasData = data?.chart?.some((item) => item.conversations || item.messages);

  return (
    <div className={`${styles.root} page`}>
      <header className={styles.pageHeader}>
        <div><h1>Discovery</h1><p className={`${styles.discoveryText} ${featureDiscovery.visible ? styles.discoveryVisible : ""}`} aria-live="polite">{featureDiscovery.text}</p></div>
        <button type="button" className={styles.refreshButton} onClick={refresh} disabled={loading || refreshing || channelLoading} aria-label="Sincronizar dados da visão geral" title="Sincronizar dados">
          {refreshing ? <LoaderCircle className={styles.spinner} size={16} /> : <RefreshCw size={16} />}{refreshing ? "Sincronizando…" : "Sincronizar"}
        </button>
      </header>

      <section className={styles.summary} aria-label="Resumo da plataforma">
        <SummaryCard title="Conversas" value={data?.metrics.conversations} loading={loading} error={data?.errors.conversations} icon={MessageCircle} tone="blue" />
        <SummaryCard title="Mensagens" value={data?.metrics.messages} loading={loading} error={data?.errors.messages} icon={MessageSquare} tone="violet" />
        <SummaryCard title="Base de conhecimento" value={totalDocuments} loading={loading} error={data?.errors.documents} icon={BookOpen} tone="amber">
          {totalDocuments !== null && <span>{data.metrics.internalDocuments} Interno · {data.metrics.serviceDocuments} Atendimento</span>}
        </SummaryCard>
        <SummaryCard title="Canal WhatsApp" value={whatsappLabel} loading={channelLoading} error={Boolean(channelError)} icon={isActive ? Radio : WifiOff} tone={isActive ? "green" : "neutral"}>
          {!channelLoading && (channel?.display_phone_number || channel?.phone_number_id) && <span>{channel.display_phone_number || channel.phone_number_id}</span>}
          {!channelLoading && !isConfigured && <Link to="/atendimento/canal">Configurar canal</Link>}
        </SummaryCard>
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.panel}>
          <PanelHeader icon={Activity} title="Atividade — últimos 7 dias" subtitle="Conversas e mensagens por dia" />
          {loading ? <PanelLoading /> : data?.errors.chart ? <PanelError /> : !chartHasData ? <Empty text="Ainda não há atividade suficiente neste período." /> : <ActivityChart data={data.chart} />}
        </section>
        <section className={styles.panel}>
          <PanelHeader icon={Gauge} title="Estado do sistema" subtitle="Estados baseados nas fontes atuais" />
          <div className={styles.systemList}>
            <StatusRow label="WhatsApp" status={whatsappLabel} tone={isActive ? "success" : isConfigured ? "warning" : "neutral"} />
            <StatusRow label="Chat interno" status="Disponível" tone="success" />
            <StatusRow label="Base de conhecimento" status={totalDocuments > 0 ? "Disponível" : totalDocuments === 0 ? "Sem documentos" : "Indisponível"} tone={totalDocuments > 0 ? "success" : "neutral"} />
          </div>
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.panel}>
          <PanelHeader icon={Bot} title="Conhecimento da IA" subtitle="Documentos por finalidade" />
          {loading ? <PanelLoading compact /> : data?.errors.documents ? <PanelError /> : <div className={styles.knowledgeGrid}>
            <KnowledgeBlock title="Chat interno" count={data.metrics.internalDocuments} status={internalStatus} icon={MessageSquare} />
            <KnowledgeBlock title="Atendimento" count={data.metrics.serviceDocuments} status={serviceStatus} icon={MessageCircle} />
          </div>}
        </section>
        <section className={styles.panel}>
          <PanelHeader icon={Activity} title="Atividade recente" subtitle="Últimos eventos da empresa" />
          {loading ? <PanelLoading compact /> : data?.errors.recent && !data?.recent.length ? <PanelError /> : !data?.recent.length ? <Empty text="Nenhuma atividade recente encontrada." /> : <div className={styles.recentList}>{data.recent.map((item) => <article key={item.id} className={styles.recentItem}><span className={styles.eventIcon}>{item.type.includes("conversa") ? <MessageCircle size={15} /> : <FileText size={15} />}</span><div><strong>{item.type}</strong><span title={item.title}>{item.title}</span></div><time>{formatRelativeDate(item.date)}</time></article>)}</div>}
        </section>
      </div>

      <section className={styles.quickActions} aria-label="Ações rápidas">
        <span>Ações rápidas</span>
        <Link to="/documentos">Adicionar documento</Link><Link to="/chat">Abrir Chat interno</Link><Link to="/atendimento/conversas">Ver conversas</Link><Link to="/atendimento/canal">Configurar canal</Link>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, loading, error, icon: Icon, tone, children }) {
  return <article className={`${styles.summaryCard} ${styles[tone]}`}><div className={styles.cardTop}><span>{title}</span><span className={styles.iconBox}><Icon size={17} /></span></div>{loading ? <span className={styles.skeleton} /> : <strong>{error || value === null || value === undefined ? "Indisponível" : value}</strong>}<div className={styles.cardDetail}>{children}</div></article>;
}
function PanelHeader({ icon: Icon, title, subtitle }) { return <header className={styles.panelHeader}><span><Icon size={17} /></span><div><h2>{title}</h2><p>{subtitle}</p></div></header>; }
function PanelLoading({ compact = false }) { return <div className={`${styles.panelLoading} ${compact ? styles.compact : ""}`}><span className={styles.skeletonLine} /><span className={styles.skeletonLine} /><span className={styles.skeletonLine} /></div>; }
function PanelError() { return <div className={styles.panelMessage}><AlertCircle size={20} /><span>Dados indisponíveis neste momento.</span></div>; }
function Empty({ text }) { return <div className={styles.panelMessage}><Activity size={20} /><span>{text}</span></div>; }
function StatusRow({ label, status, tone }) { return <div className={styles.statusRow}><span>{label}</span><strong className={styles[tone]}><i />{status}</strong></div>; }
function KnowledgeBlock({ title, count, status, icon: Icon }) { return <article className={styles.knowledgeBlock}><span className={styles.knowledgeIcon}><Icon size={18} /></span><div><h3>{title}</h3><strong>{count} {count === 1 ? "documento" : "documentos"}</strong><span className={styles[status.tone]}><i />{status.label}</span></div></article>; }
function ActivityChart({ data }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.conversations, item.messages]));
  return <div className={styles.chart}><div className={styles.legend}><span><i className={styles.conversationDot} />Conversas</span><span><i className={styles.messageDot} />Mensagens</span></div><div className={styles.bars}>{data.map((item) => <div className={styles.day} key={item.key}><div className={styles.barArea}><span title={`${item.conversations} conversas`} className={styles.conversationBar} style={{ height: `${Math.max(item.conversations ? 7 : 0, item.conversations / max * 100)}%` }} /><span title={`${item.messages} mensagens`} className={styles.messageBar} style={{ height: `${Math.max(item.messages ? 7 : 0, item.messages / max * 100)}%` }} /></div><span>{item.label}</span></div>)}</div></div>;
}
