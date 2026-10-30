import { ChevronDown, Info, Upload } from 'lucide-react'
import styles from './DocumentationDrawer.module.css'

const navigation = [
  ['sobre', 'Sobre a Logic Synap'], ['conhecimento', 'Conhecimento'], ['documentos', 'Documentos internos'],
  ['chat-interno', 'Chat interno'], ['atendimento', 'Atendimento'], ['dashboard', 'Dashboard'],
  ['conversas', 'Conversas'], ['arquivos', 'Arquivos'], ['canal', 'Canal'],
  ['perfil-settings', 'Perfil e Settings'], ['faq', 'Perguntas frequentes'],
]

const faqs = [
  ['Qual é o limite de upload?', 'O limite atual é de 20 MB por arquivo.'],
  ['Posso enviar PDFs digitalizados?', 'Sim. Entretanto, documentos digitalizados podem levar mais tempo para serem processados porque podem exigir OCR.'],
  ['Por que meu documento aparece como “em processamento”?', 'Porque o upload foi concluído, mas a plataforma ainda está preparando o conteúdo para utilização pela inteligência artificial.'],
  ['A plataforma diz que o documento já existe. O que significa?', 'A Logic Synap encontrou um documento considerado duplicado dentro da mesma empresa.'],
  ['Como envio o documento mesmo assim?', 'Se realmente precisar mantê-lo como outro documento, altere o nome do arquivo. Se estiver atualizando o documento existente, prefira excluir a versão anterior e enviar a nova versão.'],
  ['Por que um documento do Chat interno pode ser detectado durante um upload do Atendimento?', 'Porque determinadas verificações de duplicidade utilizam a mesma base de documentos da empresa, apesar de Chat interno e Atendimento terem finalidades diferentes na interface.'],
  ['Posso usar o Chat interno imediatamente depois do upload?', 'É recomendável aguardar o documento terminar o processamento.'],
  ['Como o Chat interno encontra respostas?', 'O Chat interno consulta o conhecimento disponibilizado pela empresa, conforme a implementação atual.'],
  ['Onde altero o modo claro ou escuro?', 'Settings → Aparência.'],
  ['Onde encontro meu perfil?', 'Settings → Perfil.'],
  ['Por que devo preencher a descrição da empresa no Perfil?', 'A descrição fornece contexto e identidade ao agente. Ela ajuda o agente a compreender de que empresa e atividade está a responder, produzindo respostas mais claras, específicas e coerentes com a identidade da empresa. Mantenha essa descrição objetiva e atualizada.'],
  ['Onde configuro o atendimento?', 'Na opção Canal da seção Atendimento.'],
  ['Onde vejo mensagens recebidas?', 'Em Atendimento → Conversas.'],
  ['Onde encontro arquivos enviados por clientes?', 'Em Atendimento → Arquivos.'],
  ['O que acontece quando excluo um documento?', 'Os registros e conteúdos associados ao documento são removidos conforme o fluxo de exclusão implementado pela plataforma.'],
  ['O access token permanece exposto no navegador?', 'O access token da sessão é temporário e não fica incorporado ao código da aplicação. Ele é administrado pelo cliente de autenticação do Supabase e, quando necessário, é substituído por um novo token enquanto a sessão continuar válida. A aplicação envia apenas o token atual nas requisições autenticadas; ele não deve ser exibido, registado em logs ou partilhado. Ao terminar a sessão, o acesso deixa de ser válido.'],
]

export default function DocumentationContent({ onNavigate }) {
  return <>
    <nav className={styles.manualNav} aria-label="Neste manual">
      <strong>Neste manual</strong>
      <div>{navigation.map(([id, label]) => <button type="button" key={id} onClick={() => onNavigate(id)}>{label}</button>)}</div>
    </nav>

    <ManualSection id="sobre" title="Sobre a Logic Synap">
      <p>A Logic Synap é uma plataforma de automação e inteligência aplicada ao conhecimento e ao atendimento empresarial.</p>
      <p>A plataforma permite organizar conhecimento, documentos, conversas, arquivos e canais de atendimento em um único ambiente, utilizando inteligência artificial para facilitar o acesso às informações da empresa.</p>
      <p>A navegação principal está organizada em duas grandes áreas:</p>
      <ul><li>Conhecimento</li><li>Atendimento</li></ul>
    </ManualSection>

    <ManualSection id="conhecimento" eyebrow="Conhecimento" title="Conhecimento">
      <p>Esta área reúne os documentos internos da empresa e o chat que consulta esse conhecimento.</p>
    </ManualSection>

    <ManualSection id="documentos" title="Documentos internos">
      <p>A área Documentos concentra os arquivos utilizados como conhecimento pelo Chat interno da empresa.</p>
      <h3>Para adicionar conhecimento</h3>
      <ol><li>Acesse “Documentos”.</li><li>Arraste um PDF para a área de upload ou selecione um arquivo no computador.</li><li>Aguarde a confirmação do recebimento.</li><li>O documento será processado pela plataforma.</li></ol>
      <Callout icon={<Upload size={18} />} title="Limite de upload">20 MB por arquivo.</Callout>
      <h3>Processamento</h3>
      <p>Após o upload, o documento pode continuar sendo processado em segundo plano. Por isso, “documento recebido” não significa necessariamente que todas as etapas já terminaram.</p>
      <p>A plataforma pode executar etapas como:</p>
      <ul><li>extração de texto;</li><li>OCR;</li><li>divisão do conteúdo em partes;</li><li>criação de embeddings;</li><li>indexação para pesquisa.</li></ul>
      <h3>Documentos digitalizados</h3>
      <p>PDFs digitalizados ou escaneados podem exigir processamento adicional, pois muitas vezes suas páginas são imagens e não possuem texto digital diretamente extraível.</p>
      <Callout title="Importante">Documentos digitalizados podem levar mais tempo. Sempre que possível, prefira PDFs com texto digital.</Callout>
      <h3>Documentos duplicados</h3>
      <p>A Logic Synap verifica documentos duplicados dentro da mesma empresa. A verificação utiliza a base de documentos da empresa, portanto um documento pode ser identificado como existente mesmo quando estiver sendo utilizado em outra área da plataforma.</p>
      <p>Por exemplo, um arquivo existente no conhecimento do Chat interno poderá ser identificado como duplicado durante outro upload da mesma empresa.</p>
      <Callout title="Documento duplicado">Se necessário, altere o nome do arquivo. Para substituir um documento existente, exclua a versão anterior e envie a nova.</Callout>
    </ManualSection>

    <ManualSection id="chat-interno" title="Chat interno">
      <p>O Chat interno permite conversar com a base de conhecimento da própria empresa. Ele utiliza os documentos disponibilizados na área Documentos para localizar informações relevantes e responder às perguntas.</p>
      <p>Para obter melhores resultados:</p>
      <ul><li>faça perguntas claras;</li><li>forneça contexto quando necessário;</li><li>utilize documentos atualizados;</li><li>aguarde o processamento de documentos recém-enviados.</li></ul>
      <p>Se uma informação não estiver disponível nos documentos da empresa, a IA poderá não conseguir responder adequadamente.</p>
    </ManualSection>

    <ManualSection id="atendimento" eyebrow="Atendimento" title="Atendimento">
      <p>Esta área reúne a visão operacional, as conversas, os arquivos e a configuração do canal de atendimento.</p>
    </ManualSection>

    <ManualSection id="dashboard" title="Dashboard"><p>O Dashboard oferece uma visão geral da operação de atendimento. Ele permite acompanhar informações relevantes da atividade da empresa e acessar rapidamente as demais áreas do atendimento.</p><p>Para analisar uma interação específica, utilize a área Conversas.</p></ManualSection>
    <ManualSection id="conversas" title="Conversas"><p>A área Conversas reúne as interações recebidas através dos canais conectados à Logic Synap. Nela é possível acompanhar as mensagens e o contexto das conversas.</p><p>As informações disponíveis dependem das mensagens efetivamente recebidas pelo canal configurado.</p></ManualSection>
    <ManualSection id="arquivos" title="Arquivos">
      <p>A área Arquivos organiza os arquivos relacionados ao atendimento.</p>
      <h3>Conhecimento do atendimento</h3><p>Documentos adicionados pela empresa para serem utilizados como conhecimento durante o atendimento.</p>
      <h3>Arquivos recebidos</h3><p>Arquivos enviados por clientes durante conversas. Esses arquivos são diferentes dos documentos adicionados manualmente como conhecimento.</p>
      <h3>Diferença entre Documentos e Arquivos</h3><p>“Documentos”, na área Conhecimento, são destinados principalmente ao Chat interno. “Arquivos”, na área Atendimento, estão relacionados ao funcionamento do atendimento e aos documentos recebidos ou utilizados nesse contexto.</p><p>Apesar dessa separação na interface, algumas verificações internas, como detecção de documentos duplicados, podem utilizar a mesma base de documentos da empresa.</p>
    </ManualSection>

    <ManualSection id="canal" eyebrow="Canal" title="Configuração do Canal">
      <p>A área Canal permite configurar a conexão utilizada pelo sistema de atendimento. É através dessa configuração que a Logic Synap consegue integrar o canal de comunicação da empresa ao sistema.</p>
      <p>Evite alterar parâmetros ou credenciais sem necessidade. Uma configuração incorreta pode interromper:</p>
      <ul><li>recebimento de mensagens;</li><li>envio de mensagens;</li><li>sincronização das conversas.</li></ul>
      <Callout title="Após uma alteração">Faça sempre um teste de comunicação.</Callout>
    </ManualSection>

    <ManualSection id="perfil-settings" eyebrow="Settings" title="Perfil e Settings">
      <p>O botão de engrenagem localizado na parte inferior do sidebar abre o menu Settings, que concentra Perfil, Aparência, Documentação e Sair.</p>
      <h3>Perfil</h3><p>Permite acessar as informações relacionadas ao utilizador e à conta. As operações são realizadas dentro do contexto da empresa ativa, mantendo documentos, conversas e informações separados entre empresas.</p>
      <p>A descrição da empresa é especialmente importante: ela fornece contexto e identidade ao agente, ajudando-o a compreender de que empresa, atividade e ambiente está a responder. Uma descrição clara permite respostas mais coerentes, específicas e alinhadas à identidade da empresa.</p>
      <h3>Aparência</h3><p>Permite alternar entre modo escuro e modo claro. Essa alteração é exclusivamente visual e não modifica documentos, conversas, conhecimento, canal ou configurações da empresa.</p>
      <h3>Documentação</h3><p>Abre este Manual da Logic Synap.</p>
      <h3>Sair</h3><p>Encerra a sessão atual do utilizador de forma segura.</p>
    </ManualSection>

    <ManualSection id="exclusao" title="Exclusão de documentos">
      <p>Ao excluir um documento, a plataforma pode precisar remover o registro, conteúdo processado, chunks, embeddings, referências relacionadas e o arquivo armazenado.</p>
      <Callout title="Atenção">A exclusão deve ser considerada permanente quando indicada dessa forma pela interface. Confirme sempre o documento correto.</Callout>
    </ManualSection>

    <ManualSection id="boas-praticas" title="Boas práticas">
      <h3>Utilize nomes claros</h3><p>Prefira “Politica_Comercial_2026.pdf” em vez de “documento1.pdf”.</p>
      <h3>Evite duplicados desnecessários</h3><p>Não envie várias cópias do mesmo documento.</p>
      <h3>Mantenha o conhecimento atualizado</h3><p>Quando uma versão antiga deixar de ser válida, remova-a antes de disponibilizar a nova versão quando necessário.</p>
      <h3>Prefira PDFs digitais</h3><p>PDFs com texto digital normalmente são processados mais rapidamente do que documentos totalmente escaneados.</p>
      <h3>Aguarde o processamento</h3><p>Um upload concluído significa que o arquivo foi recebido. O processamento de conhecimento pode continuar depois disso.</p>
    </ManualSection>

    <ManualSection id="faq" title="Perguntas frequentes"><FAQSection /></ManualSection>

    <footer className={styles.manualFooter}><strong>Logic Synap</strong><span>Manual da Plataforma</span><p>Esta documentação poderá ser atualizada à medida que novas funcionalidades forem adicionadas à plataforma.</p></footer>
  </>
}

function ManualSection({ id, eyebrow, title, children }) {
  return <section id={id} className={styles.section}>{eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}<h2>{title}</h2>{children}</section>
}

function Callout({ icon = <Info size={18} />, title, children }) {
  return <aside className={styles.callout}>{icon}<div><strong>{title}</strong><p>{children}</p></div></aside>
}

export function FAQSection() {
  return <div className={styles.faq}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={17} /></summary><p>{answer}</p></details>)}</div>
}
