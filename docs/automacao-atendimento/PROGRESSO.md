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
