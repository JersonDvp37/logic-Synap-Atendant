import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/Layout/Sidebar'
import Header from '../../components/Layout/Header'
import { isDemoMode } from '../../services/demoService'
import { ChannelActionsProvider } from '../../contexts/ChannelActionsContext'

import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={`${styles.root} app-shell`}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="main">
        <ChannelActionsProvider>
          <Header className={styles.header} onMenu={() => setMenuOpen(true)} />
          {isDemoMode && <div className={styles.demoBanner} role="status"><strong>Demonstração</strong><span>Apenas frontend · dados fictícios e operações simuladas.</span></div>}
          <Outlet />
        </ChannelActionsProvider>
      </main>
    </div>
  )
}
