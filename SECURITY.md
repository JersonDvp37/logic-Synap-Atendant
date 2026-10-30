# Segurança e publicação

## Configurações e dados privados

Os ficheiros `.env*`, com exceção de `.env.example`, são ignorados pelo Git. Credenciais, dumps, backups e a pasta `.private/` também ficam excluídos. O Docker ignora estes materiais no contexto de compilação.

Use apenas valores fictícios nos exemplos. As capturas de ecrã da documentação original foram retiradas porque continham dados pessoais e operacionais. Novas capturas devem usar contas e conteúdo fictícios, com revisão visual antes de serem publicadas.

Não publique tokens, chaves privadas, credenciais GCP, segredos OAuth ou chaves Supabase service_role. As variáveis `VITE_*` são públicas no navegador, incluindo os endereços dos webhooks. A proteção desses endpoints depende de autenticação e autorização no backend.

## Revisão antes de publicar alterações

Execute `npm run check:public` e reveja os ficheiros candidatos ao commit. O verificador usa padrões e não garante a ausência de todos os tipos de segredo. Analise também os binários e o histórico das branches e tags que pretende enviar.

Adicionar um ficheiro ao `.gitignore` não remove versões já rastreadas ou publicadas. Se uma credencial real já foi exposta, revogue ou substitua essa credencial no fornecedor e retire-a do histórico antes de tornar o repositório público.

Publique apenas os ficheiros revistos através de um novo repositório público. Não distribua uma cópia integral da pasta local: `.git/` e `.private/` podem preservar dados anteriores à limpeza.

## Instalação em produção

Configure a origem pública em `ALLOWED_ORIGINS` no ambiente da função Supabase. Configure o callback OAuth e a identidade da instalação nas variáveis documentadas no README.

A revisão deste repositório não confirma a segurança da VPS, dos workflows n8n, das políticas RLS efetivamente instaladas, dos buckets ou das credenciais configuradas nesses serviços. Esses ambientes não foram acedidos durante a limpeza.
