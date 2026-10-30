import { useState } from 'react';
import { getUser } from '../../services/authService';
import styles from './Meubotao.module.css';

export default function MeuBotao() {
  const [loading, setLoading] = useState(false);

  async function teste() {
    setLoading(true); // Bloqueia o botão enquanto aguarda a resposta
    try {
      const r = await getUser();
      console.log(r);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
    } finally {
      setLoading(false); // Libera o botão novamente
    }
  }

  return (
    <button className={styles.button} onClick={teste} disabled={loading}>
      {loading ? 'Carregando...' : 'Buscar Usuário'}
    </button>
  );
}
