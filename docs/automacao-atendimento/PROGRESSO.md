# Progresso — Automação de Atendimento

## Etapa 00 — Preparar o projeto e o acesso (2026-11-11)

**Cópia local:** `C:\Users\p&d.033\projetoia\App-Fluxo-Tarefas-V1` (reaproveitada, com alterações locais preservadas)
**Remote atual:** `origin` = https://github.com/bittencourtthulio/App-Fluxo-Tarefas-V1 (repositório original do professor; ainda não existe fork próprio)
**Node:** v26.13.0 / npm 11.20.0 (instalados em `C:\Program Files\nodejs`, mas fora do PATH do terminal)

### Comandos (package.json)
- `npm install` — ok, dependências já atualizadas
- `npm run dev` — abre API + interface. Por causa do `&` em `p&d.033`, use: `node scripts/dev.mjs`
  - Nesta execução: Interface http://127.0.0.1:5174 · API http://127.0.0.1:3002/api (portas padrão estavam ocupadas)
- `npm run build` — **falha** pelo `&` no caminho (o cmd.exe corta o comando). Equivalente que funciona:
  `node node_modules/vite/bin/vite.js build` → **ok** (47 módulos, `dist/` gerado)
- `npm test` — existente, não executado nesta etapa

### IA: Claude no lugar do GitHub Copilot
- Não tenho acesso ao Copilot cloud agent (plano pago). Combinado: **tudo o que depender de IA usa o Claude**.
- Os agentes continuam como arquivos de instrução em `.github/agents/*.agent.md` (ainda não criados).

### Credenciais (nenhum valor registrado aqui)
- Backend local: credencial em `.env` (ignorado pelo git; ainda não existe).
- Actions: secret separado. `COPILOT_AGENT_TOKEN` não se aplica sem o Copilot; o substituto
  (ex.: `ANTHROPIC_API_KEY`) fica pendente e **não foi configurado**.

### Pendências
- Criar fork próprio no GitHub e apontar o `origin` para ele (sem mudar a visibilidade).
- `gh` está instalado, mas sem login (`gh auth login`); o acesso às Actions ainda não foi verificado.
- Nenhuma configuração remota e nenhum ticket de teste nesta etapa. Usar só dados fictícios.

## Etapa 01 — Agentes (2026-11-11)

**Remote:** `origin` agora é https://github.com/joicezanela/trello-clone (repositório próprio).
A ligação com o repositório do professor foi removida. `main` acompanha `origin/main`.

### Agentes criados em `.github/agents/`
| Arquivo | Papel | Mexe em código? |
|---|---|---|
| `triagem.agent.md` | Classifica tickets `open` (categoria, prioridade, próximo passo) com nota `system` | Não |
| `atendente.agent.md` | Responde ao usuário com `role: "agent"` e encerra quando confirmado | Não |
| `desenvolvedor.agent.md` | Corrige bug/melhoria em branch `ticket/...`, com teste e `npm test` | Sim |

Fluxo: ticket `open` → **triagem** → **atendente** (dúvida/incompleto) ou **desenvolvedor** (bug/melhoria) → atendente avisa o usuário → `resolved`.

### Pendências
- Commit só local; `push` aguarda login no GitHub (`gh auth login`).
- Execução automática dos agentes (Actions + `ANTHROPIC_API_KEY`) ainda não configurada.

## Etapa 01 — Contexto e limites (2026-11-11)

- `docs/automacao-atendimento/PRODUTO.md`: o que o app faz e como usar (conferido com `client/src`).
- `docs/automacao-atendimento/POLITICA-DE-AUTONOMIA.md`: o que os agents podem fazer e caminhos permitidos.
- `automacao/commercial-catalog.json`: só recursos reais; preço, planos, prazos e contato ficam `null` (não informados).
- Pendente: os `.agent.md` ainda não citam esses arquivos.

## Etapa 02 — Equipe de agents (2026-11-11)

- Criados em `.github/agents/`: `coordenador`, `n1`, `comercial`, `po`, `desenvolvedor` (substitui o da Etapa 01), `revisor`.
- Coordenador chama os especialistas pela ferramenta `agent` e grava o relatório JSON (`requestId`, `outcome`, `publicText`, `agents`, `allowedFiles`, `criteria`, `updates`) em `resultPath`.
- Sem `target: github-copilot` (usamos Claude). `triagem` e `atendente` continuam como estavam.
- Pendente: controlador que envia `requestId`/`resultPath` e executa o coordenador ainda não existe.

## Etapa 03 — App → issue → coordenador via Actions (2026-11-11)

- Backend (`server/src/github.js`, `tickets.js`): com `AGENT_RUNTIME=github-actions`, ticket novo cria issue `origin:app` (vínculo em `ticket_github` no SQLite), mensagens do cliente viram comentário, e há dispatch explícito do workflow. Ao abrir o ticket, o backend lê o comentário de controle (no máximo a cada 20 s) e traz a mensagem do N1.
- `.github/workflows/ai-agents.yml` + `automacao/controlador.mjs`: valida issue (label + autor `APP_ISSUE_AUTHOR` + marcador do ticket), serializa por issue, grava estado num comentário de controle, chama a IA (máx. 2 chamadas, 120 s, sem retry), valida o relatório fora do modelo, abre PR só em caminhos permitidos (job separado) e faz o build sem segredos.
- Verificado localmente com GitHub falso e dry-run; build e `npm test` ok. Nenhuma chamada real ao GitHub ou à IA.
