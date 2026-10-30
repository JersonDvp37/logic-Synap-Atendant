# Revisão para publicação — 30 de outubro de 2026

## Resultado da varredura

Foram identificados e retirados dos ficheiros publicáveis:

- Endereços da instalação de produção e a referência ao projeto Supabase presentes no exemplo de ambiente.
- Um identificador específico num webhook do chat interno.
- Valores predefinidos do callback Gmail no código e no Docker Compose.
- A origem de produção predefinida no CORS da função de documentos.
- Contacto de suporte, nome pessoal do operador e domínio público escritos diretamente no código. A identidade da instalação passa a ser configurável.
- Oito capturas de ecrã de documentação com dados pessoais ou operacionais, juntamente com as referências a essas imagens no manual.
- Cache local do PowerShell, um ficheiro temporário de CSS e um instalador descarregado sem utilização pelo projeto.

Os originais foram guardados em `.private/public-release-backup/`, excluída do Git e do contexto Docker. Esta pasta continua a conter material privado; não deve ser incluída numa distribuição manual.

Os ficheiros de exemplo passaram a usar valores fictícios. Foram acrescentadas as variáveis de ambiente usadas pelo código que faltavam no exemplo. O verificador `npm run check:public` ajuda a detetar a reintrodução de material sensível e tem testes próprios.

## Credenciais e histórico Git

Na inspeção inicial, esta cópia tinha zero commits, sem branches ou tags com histórico alcançável e sem entradas de reflog. Existiam 118 blobs e 31 árvores Git locais. A procura de assinaturas de credenciais nesses blobs não encontrou correspondências; isso não elimina a possibilidade de segredos fora dos padrões pesquisados ou em binários.

Não foram encontradas credenciais de acesso reais nos padrões pesquisados nos ficheiros de texto. As ocorrências de chave privada na função Supabase são nomes de variáveis e marcadores usados pelo parser, não uma chave incorporada.

O remoto existente foi preservado. Não houve commit, push, publicação, alteração de credenciais ou acesso à VPS. Esta revisão não abrange o histórico do repositório privado remoto.

## Continuidade da instalação privada

As integrações continuam a receber configuração por variáveis de ambiente. Ao adotar estas alterações na instalação privada, configure explicitamente o callback Gmail, a identidade pública e `ALLOWED_ORIGINS` no servidor da função. Reconstrua a imagem após alterar variáveis `VITE_*`.

A documentação textual foi mantida. Os logótipos e o som de notificação foram mantidos. O backend completo e as configurações de produção não estão incluídos neste repositório e não foram auditados.

## Validação realizada

- `npm run check:public`: aprovado, com 110 ficheiros de texto analisados e dois binários assinalados como não analisados pelo verificador.
- `npm run test:public-safety`: cinco testes aprovados, incluindo a deteção de ficheiros já rastreados que depois foram ignorados.
- `npm run lint` e `npm run build`: aprovados. A compilação apenas avisou sobre o tamanho de um bundle.
- Pesquisa de sete identificadores retirados em 182 ficheiros publicáveis e artefactos compilados: nenhuma ocorrência.
- Verificados os cenários de CORS com origens locais, configuradas, desconhecidas e sem cabeçalho Origin, e a configuração explícita do callback Gmail.
- Confirmadas as exclusões Git e a passagem das 24 variáveis do frontend pelo Dockerfile e pelo Compose. O Docker CLI não estava disponível, pelo que não foi executada uma compilação ou validação de execução com Docker.
- O logótipo PNG mantido não contém blocos de metadados textuais ou EXIF; o áudio mantido não apresentou marcadores ID3.
