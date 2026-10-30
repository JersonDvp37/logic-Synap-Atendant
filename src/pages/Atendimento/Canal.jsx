import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, PlugZap, RefreshCw, Unplug, WifiOff } from 'lucide-react'
import { useCompany } from '../../contexts/CompanyContext'
import { useWhatsAppChannel } from '../../contexts/WhatsAppChannelContext'
import { configureWhatsAppChannel, disconnectWhatsAppChannel, testWhatsAppConnection } from '../../services/whatsappChannelService'
import styles from './Canal.module.css'
import DemoDialog from '../../components/Demo/DemoDialog'
import { isDemoMode } from '../../services/demoService'

const EMPTY_FORM = { phoneNumberId: '', businessAccountId: '', accessToken: '' }
const formatDate = (value) => {
  if (!value) return 'Nunca verificado'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Nunca verificado' : new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function Canal() {
  const configureInFlightRef = useRef(false)
  const testInFlightRef = useRef(false)
  const disconnectInFlightRef = useRef(false)
  const { companyId } = useCompany()
  const { channel, isConfigured, isActive, loading, refreshing, error: channelLoadError, refreshChannel } = useWhatsAppChannel()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionTestError, setConnectionTestError] = useState('')
  const [connectionTestSuccess, setConnectionTestSuccess] = useState('')
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState('')
  const [showDemoExplanation, setShowDemoExplanation] = useState(false)

  useEffect(() => {
    setForm({
      phoneNumberId: isConfigured ? channel?.phone_number_id || '' : '',
      businessAccountId: isConfigured ? channel?.business_account_id || '' : '',
      accessToken: '',
    })
  }, [isConfigured, channel?.id, channel?.phone_number_id, channel?.business_account_id])

  const updateField = ({ target: { name, value } }) => setForm((current) => ({ ...current, [name]: value }))

  async function handleSubmit(event) {
    event.preventDefault()
    if (isDemoMode) { setShowDemoExplanation(true); return }
    if (configureInFlightRef.current) return
    const phoneNumberId = form.phoneNumberId.trim()
    const businessAccountId = form.businessAccountId.trim()
    const accessToken = form.accessToken.trim()
    if (!companyId) return setError('Empresa não identificada.')
    if (!phoneNumberId) return setError('Informe o Phone Number ID.')
    if (!businessAccountId) return setError('Informe o WhatsApp Business Account ID.')
    if (!isConfigured && !accessToken) return setError('Informe o Access Token para configurar o canal.')

    configureInFlightRef.current = true
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await configureWhatsAppChannel({ companyId, phoneNumberId, businessAccountId, accessToken })
      setForm((current) => ({ ...current, accessToken: '' }))
      await refreshChannel()
      setSuccess('Canal configurado com sucesso.')
    } catch (submitError) {
      setError(submitError.message || 'Não foi possível configurar o canal.')
    } finally {
      configureInFlightRef.current = false
      setSubmitting(false)
    }
  }

  async function handleTestConnection() {
    if (testInFlightRef.current || !isConfigured) return
    testInFlightRef.current = true
    setIsTestingConnection(true)
    setConnectionTestError('')
    setConnectionTestSuccess('')
    try {
      await testWhatsAppConnection(companyId)
      await refreshChannel()
      setConnectionTestSuccess(isDemoMode ? 'Teste simulado. Nenhum serviço externo foi contactado.' : 'Conexão com o WhatsApp validada com sucesso.')
    } catch (testError) {
      setConnectionTestError(testError instanceof Error ? testError.message : 'Não foi possível testar a conexão.')
      try { await refreshChannel() } catch { /* O erro principal do webhook tem prioridade. */ }
    } finally {
      testInFlightRef.current = false
      setIsTestingConnection(false)
    }
  }

  async function handleDisconnectChannel() {
    if (disconnectInFlightRef.current || !isConfigured) return
    disconnectInFlightRef.current = true
    setIsDisconnecting(true)
    setDisconnectError('')
    setSuccess('')
    try {
      await disconnectWhatsAppChannel(companyId)
      await refreshChannel()
      setShowDisconnectConfirm(false)
      setSuccess('Canal WhatsApp desconectado com sucesso.')
    } catch (disconnectRequestError) {
      setDisconnectError(disconnectRequestError instanceof Error ? disconnectRequestError.message : 'Não foi possível desconectar o canal.')
    } finally {
      disconnectInFlightRef.current = false
      setIsDisconnecting(false)
    }
  }

  async function simulateConfiguration() {
    try {
      await configureWhatsAppChannel({ companyId, phoneNumberId: form.phoneNumberId, businessAccountId: form.businessAccountId, accessToken: '' })
      await refreshChannel()
      setSuccess('Configuração simulada. Nenhum número ou conta real foi ligado.')
      setShowDemoExplanation(false)
    } catch (demoError) { setError(demoError.message) }
  }

  const hasError = isConfigured && channel?.status === 'error'
  return <div className={`${styles.root} page`}>
    {isDemoMode && <p className={styles.testHint}>Este canal é fictício. Experimente a configuração sem inserir credenciais reais.</p>}
    <section className={styles.statusCard} aria-live="polite">
      {loading ? <State icon={<LoaderCircle className={styles.spinner} size={25} />} title="A carregar canal" text="A consultar a configuração atual…" />
        : isActive ? <State tone="active" icon={<CheckCircle2 size={25} />} title={isDemoMode ? 'Canal de demonstração ativo' : 'Status: Conectado'} text={channel.display_phone_number || 'Número não disponível'} />
        : hasError ? <State tone="failed" icon={<AlertCircle size={25} />} title="Erro na conexão" text={channel.last_error || 'O canal apresentou um erro.'} />
        : isConfigured ? <State icon={<WifiOff size={25} />} title="Canal configurado" text="A conexão ainda não está ativa." />
        : <State icon={<WifiOff size={25} />} title="WhatsApp não configurado" text="Informe as credenciais abaixo para conectar o canal." />}
      {!loading && isConfigured && channel && <dl className={styles.details}>
        <Detail label="Número" value={channel.display_phone_number} /><Detail label="Phone Number ID" value={channel.phone_number_id} />
        <Detail label="Business Account ID" value={channel.business_account_id} />
        {channel.verified_name && <Detail label="Nome verificado" value={channel.verified_name} />}
        {channel.quality_rating && <Detail label="Qualidade" value={channel.quality_rating} />}
        <Detail label="Status do webhook" value={channel.webhook_status} /><Detail label="Última verificação" value={formatDate(channel.last_check_at)} />
        {channel.last_error && <Detail label="Último erro" value={channel.last_error} />}
      </dl>}
      {!loading && isConfigured && <div className={styles.testArea}>
        <button className={styles.testButton} type="button" onClick={handleTestConnection} disabled={isTestingConnection || submitting || isDisconnecting}>
          {isTestingConnection ? <LoaderCircle className={styles.spinner} size={17} /> : <CheckCircle2 size={17} />}
          {isTestingConnection ? 'Testando...' : 'Testar conexão'}
        </button>
        <button className={styles.disconnectButton} type="button" onClick={() => { setDisconnectError(''); setShowDisconnectConfirm(true) }} disabled={isTestingConnection || submitting || isDisconnecting}>
          <Unplug size={17} />
          Desconectar
        </button>
        {connectionTestSuccess && <div className={styles.success} role="status"><CheckCircle2 size={17} />{connectionTestSuccess}</div>}
        {connectionTestError && <div className={styles.error} role="alert"><AlertCircle size={17} />{connectionTestError}</div>}
        {disconnectError && <div className={styles.error} role="alert"><AlertCircle size={17} />{disconnectError}</div>}
      </div>}
      {!loading && !isConfigured && <p className={styles.testHint}>Configure o canal WhatsApp antes de testar a conexão.</p>}
    </section>
    <section className={`${styles.formCard} panel channel`}>
      <div className="panel-title"><h2>{isConfigured ? 'Atualizar configuração' : 'Configurar canal'}</h2><span>WhatsApp Cloud API</span></div>
      <form onSubmit={handleSubmit} noValidate>
        <label>Phone Number ID<input name="phoneNumberId" value={form.phoneNumberId} onChange={updateField} autoComplete="off" disabled={submitting} /></label>
        <label>WhatsApp Business Account ID<input name="businessAccountId" value={form.businessAccountId} onChange={updateField} autoComplete="off" disabled={submitting} /></label>
        <label className={styles.tokenField}>Access Token<input name="accessToken" type="password" value={form.accessToken} onChange={updateField} autoComplete="new-password" disabled={submitting || isDemoMode} placeholder={isDemoMode ? 'Não é necessário na demonstração' : isConfigured ? 'Informe apenas para substituir o token' : 'Obrigatório na configuração inicial'} /></label>
        <div className={styles.actions}><button className="primary" disabled={submitting || loading}>{submitting ? <LoaderCircle className={styles.spinner} size={17} /> : <PlugZap size={17} />}{submitting ? 'A configurar…' : isDemoMode ? 'Simular configuração' : isConfigured ? 'Atualizar configuração' : 'Configurar canal'}</button><button className={styles.refresh} type="button" onClick={() => refreshChannel().catch(() => {})} disabled={submitting || loading || refreshing}><RefreshCw className={refreshing ? styles.spinner : ''} size={16} />Atualizar dados</button></div>
        {success && <div className={styles.success} role="status"><CheckCircle2 size={17} />{success}</div>}
        {(error || channelLoadError) && <div className={styles.error} role="alert"><AlertCircle size={17} />{error || channelLoadError}</div>}
      </form>
    </section>
    {showDemoExplanation && <DemoDialog title="Para que serve configurar o canal?" onClose={() => setShowDemoExplanation(false)} onConfirm={simulateConfiguration}>
      <p>Na versão completa, esta área liga o WhatsApp Business da empresa à plataforma para receber mensagens, responder a clientes e acompanhar os atendimentos.</p>
      <p>O Phone Number ID identifica o número, o Business Account ID identifica a conta empresarial e o Access Token autoriza a integração.</p>
      <p>Aqui a configuração é apenas uma simulação local. Não há backend ligado, nenhum WhatsApp será conectado e não são necessárias credenciais reais.</p>
    </DemoDialog>}
    {showDisconnectConfirm && (
      <div className={styles.modalBackdrop} role="presentation">
        <section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="disconnect-title">
          <div className={styles.dialogIcon}><Unplug size={21} /></div>
          <h2 id="disconnect-title">Desconectar WhatsApp?</h2>
          <p>O canal será desvinculado da Logic Synap Hub. Conversas, mensagens, arquivos e demais dados históricos serão preservados.</p>
          {disconnectError && <div className={styles.error} role="alert"><AlertCircle size={17} />{disconnectError}</div>}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.cancelButton} disabled={isDisconnecting} onClick={() => setShowDisconnectConfirm(false)}>Cancelar</button>
            <button type="button" className={styles.confirmDisconnectButton} disabled={isDisconnecting} onClick={handleDisconnectChannel}>
              {isDisconnecting ? <LoaderCircle className={styles.spinner} size={16} /> : <Unplug size={16} />}
              {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
            </button>
          </div>
        </section>
      </div>
    )}
  </div>
}
function State({ icon, title, text, tone = '' }) { return <div className={`${styles.state} ${styles[tone] || ''}`}>{icon}<div><strong>{title}</strong><p>{text}</p></div></div> }
function Detail({ label, value }) { return <div><dt>{label}</dt><dd>{value || 'Não disponível'}</dd></div> }
