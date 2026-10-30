import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import styles from './Header.module.css'
import { useChannelActions } from '../../contexts/ChannelActionsContext'

const titles = {
  '/geral': 'Visão geral',
  '/documentos': 'Documentos',
  '/chat': 'Chat interno',
  '/atendimento': 'WhatsApp · Dashboard',
  '/atendimento/conversas': 'WhatsApp · Conversas',
  '/atendimento/arquivos': 'WhatsApp · Arquivos',
  '/atendimento/agendamentos': 'WhatsApp · Agendamentos',
  '/atendimento/gmail': 'Gmail · Caixa de Entrada',
  '/atendimento/gmail/compor': 'Gmail · Compor Email',
  '/atendimento/gmail/anexos': 'Gmail · Anexos Received',
  '/atendimento/configuracoes': 'Configurações de Canais · WhatsApp',
  '/atendimento/configuracoes/gmail': 'Configurações de Canais · Gmail Auth',
  '/perfil': 'Perfil',
}

const breadcrumbSections = {
  '/geral': 'VISAO GERAL',
  '/documentos': 'CONHECIMENTO',
  '/chat': 'CHAT INTERNO',
  '/perfil': 'CONTA',
}

export default function Header({ onMenu, className = '' }) {
  const { pathname } = useLocation()
  const { headerAction } = useChannelActions()
  const title = titles[pathname] || titles['/geral'] || 'Logic Synap'
  const isChannelRoute = pathname.startsWith('/atendimento')
  const section = isChannelRoute ? 'CANAIS / ATENDIMENTO' : (breadcrumbSections[pathname] || 'LOGIC SYNAP HUB')
  const product = pathname.includes('/gmail') ? 'GMAIL' : (isChannelRoute ? 'WHATSAPP' : null)

  return (
    <header className={`${styles.root} header ${className}`.trim()}>
      <button className="menu-button" aria-label="Abrir menu" onClick={onMenu}>
        <Menu size={20} />
      </button>
      <div className={styles['titles-top']}>
        <div className={styles.breadcrumb}>
          <span>{section}</span>
          {product && <><span aria-hidden="true">/</span><strong>{product}</strong></>}
        </div>
        <strong className={styles.pageTitle}>{title}</strong>
      </div>
      {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
    </header>
  )
}
