import { useEffect, useRef } from 'react';
import { Info, X } from 'lucide-react';
import styles from './DemoDialog.module.css';

export default function DemoDialog({ title, children, onClose, onConfirm, confirmLabel = 'Simular configuração' }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} className={styles.dialog} onCancel={onClose} aria-labelledby="demo-dialog-title">
    <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar explicação"><X size={18} /></button>
    <span className={styles.icon}><Info size={24} /></span>
    <span className={styles.label}>DEMONSTRAÇÃO · APENAS FRONTEND</span>
    <h2 id="demo-dialog-title">{title}</h2>
    <div className={styles.content}>{children}</div>
    <div className={styles.actions}>
      {onConfirm && <button type="button" className="primary" onClick={onConfirm}>{confirmLabel}</button>}
      <button type="button" onClick={onClose}>{onConfirm ? 'Voltar' : 'Entendi'}</button>
    </div>
  </dialog>;
}
