import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import DocumentationContent from './DocumentationContent'
import styles from './DocumentationDrawer.module.css'

export default function DocumentationDrawer({ open, onClose }) {
  const contentRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  function scrollToSection(sectionId) {
    const section = contentRef.current?.querySelector(`#${sectionId}`)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!open) return null

  return createPortal(
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label="Fechar documentação" onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="documentation-title">
        <header className={styles.header}>
          <div className={styles.brand}><span><img src="/logo_synap/logic_synap_logo.svg" alt="" /></span>LOGIC SYNAP</div>
          <button className={styles.close} type="button" aria-label="Fechar documentação" onClick={onClose}><X size={20} /></button>
          <h1 id="documentation-title">Manual da Plataforma</h1>
          <p>Guia de utilização da Logic Synap</p>
        </header>
        <div className={styles.content} ref={contentRef}>
          <DocumentationContent onNavigate={scrollToSection} />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
