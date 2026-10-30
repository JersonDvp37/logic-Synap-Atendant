import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen, CalendarClock, FileText, LayoutDashboard, LogOut, Mail, MessageCircle, MessageSquare, Moon,
  Settings, SlidersHorizontal, Sun, UserRound,
} from 'lucide-react'
import styles from './Sidebar.module.css'
import DocumentationDrawer from '../Documentation/DocumentationDrawer'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useTheme } from '../../contexts/ThemeContext'
import { LEGAL_LINKS } from '../../constants/legalLinks'

const groups = [
  {
    title: 'Geral',
    links: [
      { to: '/geral', label: 'Geral', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Conhecimento',
    links: [
      { to: '/documentos', label: 'Documentos', icon: FileText },
      { to: '/chat', label: 'Chat interno', icon: MessageSquare },
    ],
  },
  {
    title: 'Canais / Atendimento',
    links: [
      { to: '/atendimento', label: 'WhatsApp', icon: MessageCircle, end: true },
      { to: '/atendimento/agendamentos', label: 'Agendamentos', icon: CalendarClock },
      { to: '/atendimento/gmail', label: 'Gmail', icon: Mail },
      { to: '/atendimento/configuracoes', label: 'Configurações de Canais', icon: SlidersHorizontal },
    ],
  },
]

export default function Sidebar({ open, onClose}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { companyName, role } = useCompany()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [documentationOpen, setDocumentationOpen] = useState(false)
  const settingsRef = useRef(null)

  useEffect(() => {
    setSettingsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!settingsOpen) return undefined

    function closeSettings(event) {
      if (event.key === 'Escape') setSettingsOpen(false)
      if (event.type === 'pointerdown' && !settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeSettings)
    document.addEventListener('keydown', closeSettings)
    return () => {
      document.removeEventListener('pointerdown', closeSettings)
      document.removeEventListener('keydown', closeSettings)
    }
  }, [settingsOpen])

  function openProfile() {
    setSettingsOpen(false)
    navigate('/perfil')
    onClose?.()
  }

  function changeTheme() {
    toggleTheme()
    setSettingsOpen(false)
  }

  function handleLogout() {
    setSettingsOpen(false)
    logout()
  }

  return (
    <>
      {open && <button className="backdrop" aria-label="Fechar menu" onClick={onClose} />}
      <aside className={`${styles.root} sidebar ${open ? 'open' : ''}`}>
        <div>
          <div className="brand"><span><img src="/logo_synap/logic_synap_logo.svg" alt="" /></span>Logic Synap</div>
          <div className="workspace">
            <strong>{companyName}</strong>
            <small>Workspace</small>
          </div>
          <nav>
            {groups.map((group) => (
              <div className="nav-group" key={group.title}>
                <small>{group.title}</small>
                {group.links.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    to={to}
                    end={end}
                    key={to}
                    onClick={onClose}
                    className={({ isActive }) => (
                      to === '/atendimento' && ['/atendimento', '/atendimento/conversas', '/atendimento/arquivos'].includes(location.pathname)
                        ? 'active'
                        : isActive ? 'active' : undefined
                    )}
                  >
                    <Icon size={17} />{label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className={styles.footer} ref={settingsRef}>
          {settingsOpen && (
            <div className={styles.settingsMenu} role="menu" aria-label="Settings">
              <button type="button" role="menuitem" onClick={openProfile}><UserRound size={17} /><span>Perfil</span></button>
              <button type="button" role="menuitem" onClick={changeTheme}>
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
                <span>Aparência</span><small>{theme === 'dark' ? 'Escuro' : 'Claro'}</small>
              </button>
              <button type="button" role="menuitem" onClick={() => { setSettingsOpen(false); setDocumentationOpen(true) }}><BookOpen size={17} /><span>Documentação</span></button>
              <div className={styles.settingsLegalLinks}>
                <a href={LEGAL_LINKS.terms}>Termos</a>
                <a href={LEGAL_LINKS.privacy}>Privacidade</a>
                <a href={LEGAL_LINKS.support}>Suporte</a>
              </div>
              <div className={styles.divider} role="separator" />
              <button type="button" role="menuitem" className={styles.logoutItem} onClick={handleLogout}><LogOut size={17} /><span>Sair</span></button>
            </div>
          )}
          <button type="button" className={styles.settingsButton} aria-label="Abrir Settings" aria-haspopup="menu" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((current) => !current)}><Settings size={18} /><span>Settings</span></button>
          <div className={`profile ${styles.profileClickable}`} role="link" tabIndex={0} onClick={openProfile} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProfile() } }}>
            <span>{user.email.slice(0, 2).toUpperCase()}</span>
            <div><strong>{role.toUpperCase()}</strong><small>{user.email}</small></div>

          </div>
        </div>
      </aside>
      <DocumentationDrawer open={documentationOpen} onClose={() => setDocumentationOpen(false)} />
    </>
  )
}
