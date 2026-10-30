import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Clock3, FileDown, FileText, LoaderCircle, MessageCircle, MessagesSquare, Phone, RefreshCw, WifiOff } from 'lucide-react'
import { useCompany } from '../../contexts/CompanyContext'
import { useWhatsAppChannel } from '../../contexts/WhatsAppChannelContext'
import { getAttendanceDashboardData } from '../../services/attendanceDashboardService'
import styles from './Dashboard.module.css'

const POLLING_INTERVAL = 300000

function formatActivityDate(value) {
  if (!value) return 'Data indisponível'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'
  const isToday = date.toDateString() === new Date().toDateString()
  return new Intl.DateTimeFormat('pt-PT', isToday
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
  ).format(date)
}

const contactName = (item) => item?.customer_name || item?.phone || 'Cliente não identificado'
const messagePreview = (item) => item.content?.trim() || `[${item.message_type || 'mensagem'}]`

export default function AtendimentoDashboard() {
  const { companyId, companyName } = useCompany()
  const { channel, isConfigured, isActive } = useWhatsAppChannel()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const requestInFlight = useRef(false)

  const loadDashboard = useCallback(async ({ initial = false } = {}) => {
    if (!companyId) { setData(null); setLoading(false); return }
    if (requestInFlight.current) return
    requestInFlight.current = true
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      setData(await getAttendanceDashboardData(companyId))
    } catch (requestError) {
      console.error('Erro ao carregar o dashboard de atendimento:', requestError)
      setError(requestError.message || 'Não foi possível carregar os dados do atendimento.')
    } finally {
      requestInFlight.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [companyId])

  useEffect(() => {
    loadDashboard({ initial: true })
    if (!companyId) return undefined
    const intervalId = window.setInterval(() => loadDashboard(), POLLING_INTERVAL)
    return () => window.clearInterval(intervalId)
  }, [companyId, loadDashboard])

  const channelStatus = isActive ? 'Conectado' : isConfigured ? 'Com problema' : 'Não configurado'
  const cards = [
    { label: 'Status do canal', value: channelStatus, Icon: isActive ? CheckCircle2 : WifiOff, tone: isActive ? 'success' : 'neutral' },
    { label: 'Número conectado', value: channel?.display_phone_number || channel?.phone_number_id || '—', Icon: Phone, tone: 'blue' },
    { label: 'Conversas', value: data?.conversationsCount ?? '—', Icon: MessagesSquare, tone: 'violet' },
    { label: 'Arquivos recebidos', value: data?.filesCount ?? '—', Icon: FileDown, tone: 'amber' },
  ]
  const hasActivity = Boolean(data?.recentConversations.length || data?.recentMessages.length || data?.recentFiles.length)

  return (
    <div className={`${styles.root} page`}>
      <div className={styles.summary} aria-label="Resumo do atendimento">
        {cards.map(({ label, value, Icon, tone }) => (
          <section className={`${styles.summaryCard} ${styles[tone]}`} key={label}>
            <div className={styles.cardTop}><span>{label}</span><span className={styles.iconBox}><Icon size={17} /></span></div>
            <strong className={styles.cardValue}>{value}</strong>
            {loading && !data && <span className={styles.skeleton} aria-hidden="true" />}
          </section>
        ))}
      </div>

      {data && <section className={styles.today} aria-label="Métricas de hoje">
        <div className={styles.todayTitle}><Activity size={16} /><span>Hoje</span></div>
        <Metric value={data.activeConversations} label="conversas ativas" />
        <Metric value={data.messagesToday} label="mensagens" />
        <Metric value={data.filesToday} label="arquivos recebidos" />
      </section>}

      <section className={styles.activityPanel}>
        <header className={styles.panelHeader}>
          <div><h2>Atividade recente</h2><span>Visão geral de {companyName || 'sua empresa'}</span></div>
          <button className={styles.refreshButton} onClick={() => loadDashboard()} disabled={refreshing || loading}>
            {refreshing ? <LoaderCircle className={styles.spinner} size={15} /> : <RefreshCw size={15} />}
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        </header>
        {error && <div className={styles.error} role="alert"><AlertCircle size={17} /><span>{error}{data ? ' Os últimos dados carregados continuam visíveis.' : ''}</span></div>}
        {loading && !data ? (
          <div className={styles.emptyState}><LoaderCircle className={styles.spinner} size={28} /><strong>A carregar atendimento</strong><p>A reunir os dados mais recentes da operação…</p></div>
        ) : !hasActivity ? (
          <div className={styles.emptyState}><MessageCircle size={28} /><strong>Nenhuma atividade recente</strong><p>Novas conversas, mensagens e arquivos aparecerão aqui.</p></div>
        ) : (
          <div className={styles.activityGrid}>
            <ActivitySection icon={MessagesSquare} title="Conversas" count={data.recentConversations.length} empty="Sem conversas recentes.">
              {data.recentConversations.map((item) => <article className={styles.activityItem} key={item.id}>
                <div className={styles.avatar}>{contactName(item).charAt(0).toUpperCase()}</div>
                <div className={styles.itemContent}><div className={styles.itemHeading}><strong title={contactName(item)}>{contactName(item)}</strong><time>{formatActivityDate(item.updated_at)}</time></div><span className={styles.statusPill}>{item.status || 'Sem estado'}</span></div>
              </article>)}
            </ActivitySection>
            <ActivitySection icon={MessageCircle} title="Mensagens" count={data.recentMessages.length} empty="Sem mensagens recentes.">
              {data.recentMessages.map((item) => <article className={styles.activityItem} key={item.id}>
                <div className={`${styles.typeIcon} ${styles.messageIcon}`}><MessageCircle size={15} /></div>
                <div className={styles.itemContent}><div className={styles.itemHeading}><strong title={contactName(item.conversation)}>{contactName(item.conversation)}</strong><time>{formatActivityDate(item.created_at)}</time></div><p title={messagePreview(item)}>{messagePreview(item)}</p></div>
              </article>)}
            </ActivitySection>
            <ActivitySection icon={FileText} title="Arquivos" count={data.recentFiles.length} empty="Sem arquivos recentes.">
              {data.recentFiles.map((item) => <article className={styles.activityItem} key={item.id}>
                <div className={`${styles.typeIcon} ${styles.fileIcon}`}><FileText size={15} /></div>
                <div className={styles.itemContent}><div className={styles.itemHeading}><strong title={item.filename}>{item.filename || 'Arquivo sem nome'}</strong><time>{formatActivityDate(item.created_at)}</time></div><p>{item.telefone || 'Cliente não identificado'}{item.mime_type ? ` · ${item.mime_type}` : ''}</p></div>
              </article>)}
            </ActivitySection>
          </div>
        )}
        {data && <footer className={styles.panelFooter}><Clock3 size={13} /><span>Atualização automática a cada 5 minutos</span>{refreshing && <span className={styles.liveRefresh}>A sincronizar</span>}</footer>}
      </section>
    </div>
  )
}

function Metric({ value, label }) { return <div className={styles.metric}><strong>{value}</strong><span>{label}</span></div> }
function ActivitySection({ icon: Icon, title, count, empty, children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <section className={styles.activitySection}><header><div><Icon size={15} /><h3>{title}</h3></div><span>{count}</span></header><div className={styles.activityList}>{hasItems ? children : <p className={styles.sectionEmpty}>{empty}</p>}</div></section>
}