// Atendimento: tickets de suporte no formato de conversa (cada ticket é um chat).
// Contrato JSON em inglês, como o de quadros. Sem login obrigatório.
//
// Papéis das mensagens (`role`):
//   "user"   → quem abriu o ticket
//   "agent"  → atendente (humano ou agente autônomo); use `authorName` para identificar
//   "system" → avisos automáticos (ex.: ticket resolvido/reaberto)
//
// Status do ticket:
//   "open"     → aguardando resposta do atendimento (toda mensagem do usuário volta para cá)
//   "answered" → o atendimento respondeu e aguarda o usuário
//   "resolved" → encerrado; uma nova mensagem do usuário reabre
import { randomUUID } from "node:crypto";
import { invalido, naoEncontrado, texto } from "./http.js";
import { transacao } from "./db.js";

export const STATUS = ["open", "answered", "resolved"];
export const PAPEIS = ["user", "agent", "system"];
const MAX_MENSAGEM = 10_000;

const saidaTicket = (t, ultima) => ({
  id: t.id,
  title: t.title,
  status: t.status,
  createdAt: t.criado_em,
  updatedAt: t.atualizado_em,
  lastMessage: ultima ? { role: ultima.role, content: ultima.content.slice(0, 160) } : null,
});

const saidaMensagem = (m) => ({
  id: m.id,
  ticketId: m.ticket_id,
  role: m.role,
  authorName: m.author_name,
  content: m.content,
  createdAt: m.criado_em,
});

/** Título automático a partir da primeira mensagem: primeira linha, até 80 caracteres. */
export function tituloDaMensagem(conteudo) {
  const linha = conteudo.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "Novo ticket";
  const limpa = linha.replace(/[#*_`>]+/g, "").replace(/\s+/g, " ").trim() || "Novo ticket";
  return limpa.length > 80 ? `${limpa.slice(0, 77).trimEnd()}…` : limpa;
}

export function rotasDeTickets(app, db, integracao = null) {
  const buscar = (id) => {
    const t = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
    if (!t) throw naoEncontrado("Ticket");
    return t;
  };
  const ultimaMensagem = (ticketId) =>
    db.prepare("SELECT role, content FROM ticket_mensagem WHERE ticket_id = ? ORDER BY criado_em DESC, rowid DESC LIMIT 1").get(ticketId);
  const mensagens = (ticketId) =>
    db.prepare("SELECT * FROM ticket_mensagem WHERE ticket_id = ? ORDER BY criado_em, rowid").all(ticketId).map(saidaMensagem);
  const vinculo = (ticketId) => db.prepare("SELECT * FROM ticket_github WHERE ticket_id = ?").get(ticketId);
  const completo = (id) => {
    const t = buscar(id);
    const v = vinculo(t.id);
    const github = v ? { issue: v.issue, phase: v.fase, requestId: v.request_id, pr: v.pr_url } : null;
    return { ticket: saidaTicket(t, ultimaMensagem(t.id)), messages: mensagens(t.id), github };
  };

  const inserirMensagem = (ticketId, role, autor, conteudo, agora) => {
    const id = randomUUID();
    db.prepare("INSERT INTO ticket_mensagem (id, ticket_id, role, author_name, content, criado_em) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, ticketId, role, autor, conteudo, agora);
    return id;
  };

  // --- Integração com o GitHub (só quando AGENT_RUNTIME=github-actions) ---
  const enviarParaGithub = async (ticketId) => {
    const v = vinculo(ticketId);
    if (!integracao || !v || v.issue) return;
    const primeira = db.prepare("SELECT content FROM ticket_mensagem WHERE ticket_id = ? AND role = 'user' ORDER BY criado_em, rowid LIMIT 1").get(ticketId);
    const issue = await integracao.criarIssue(buscar(ticketId), primeira?.content ?? "");
    db.prepare("UPDATE ticket_github SET issue = ?, fase = 'enviado' WHERE ticket_id = ?").run(issue, ticketId);
    await integracao.disparar(issue);
  };

  /** Traz o resultado do workflow (comentário de controle) para o app. No máximo a cada 20 s por ticket. */
  const sincronizar = async (ticketId) => {
    const v = vinculo(ticketId);
    if (!integracao || !v || (v.sincronizado_em && Date.now() - Date.parse(v.sincronizado_em) < 20_000)) return;
    db.prepare("UPDATE ticket_github SET sincronizado_em = ? WHERE ticket_id = ?").run(new Date().toISOString(), ticketId);
    try {
      if (!v.issue) return await enviarParaGithub(ticketId); // criação anterior falhou: tenta de novo
      const estado = await integracao.lerEstado(v.issue);
      if (!estado || estado.ticketId !== ticketId) return;
      const enviados = new Set(JSON.parse(v.mensagens_enviadas));
      const texto = (x) => (typeof x === "string" || typeof x === "number" ? String(x).slice(0, 300) : null);
      transacao(db, () => {
        for (const m of Array.isArray(estado.messages) ? estado.messages : []) {
          if (typeof m?.id !== "string" || typeof m.text !== "string" || !m.text.trim() || m.text.length > 2000 || enviados.has(m.id)) continue;
          const agora = new Date().toISOString();
          inserirMensagem(ticketId, "agent", "Suporte N1", m.text.trim(), agora);
          db.prepare("UPDATE ticket SET status = 'answered', atualizado_em = ? WHERE id = ?").run(agora, ticketId);
          enviados.add(m.id);
        }
        db.prepare("UPDATE ticket_github SET request_id = ?, run_id = ?, result_path = ?, pr_url = ?, fase = ?, mensagens_enviadas = ? WHERE ticket_id = ?")
          .run(texto(estado.requestId), texto(estado.runId), texto(estado.resultPath), texto(estado.pr), texto(estado.phase) ?? v.fase, JSON.stringify([...enviados]), ticketId);
      });
    } catch (e) {
      console.error(`Sincronização do ticket ${ticketId} com o GitHub falhou: ${e.message}`);
    }
  };

  const papelDoCorpo = (corpo) => {
    if (corpo.role === undefined) return "user";
    if (!PAPEIS.includes(corpo.role)) throw invalido(`role deve ser um de: ${PAPEIS.join(", ")}.`);
    return corpo.role;
  };

  app.get("/api/tickets", () => ({
    tickets: db.prepare("SELECT * FROM ticket ORDER BY atualizado_em DESC, rowid DESC").all()
      .map((t) => saidaTicket(t, ultimaMensagem(t.id))),
  }));

  /** Abre um ticket já com a primeira mensagem do usuário. `title` é opcional. */
  app.post("/api/tickets", async ({ corpo }) => {
    const conteudo = texto(corpo, "message", { max: MAX_MENSAGEM });
    const titulo = texto(corpo, "title", { max: 120, opcional: true }) || tituloDaMensagem(conteudo);
    const autor = texto(corpo, "authorName", { min: 0, max: 120, opcional: true }) || "Você";
    const id = randomUUID();
    const agora = new Date().toISOString();
    transacao(db, () => {
      db.prepare("INSERT INTO ticket (id, title, status, criado_em, atualizado_em) VALUES (?, ?, 'open', ?, ?)").run(id, titulo, agora, agora);
      inserirMensagem(id, "user", autor, conteudo, agora);
      if (integracao) db.prepare("INSERT INTO ticket_github (ticket_id) VALUES (?)").run(id);
    });
    if (integracao) {
      try { await enviarParaGithub(id); }
      catch (e) { console.error(`Não foi possível criar a issue do ticket ${id}: ${e.message}`); }
    }
    return completo(id);
  });

  app.get("/api/tickets/:id", async ({ params }) => {
    buscar(params.id);
    await sincronizar(params.id);
    return completo(params.id);
  });

  app.patch("/api/tickets/:id", ({ params, corpo }) => {
    const t = buscar(params.id);
    const titulo = texto(corpo, "title", { max: 120, opcional: true }) ?? t.title;
    let status = t.status;
    if (corpo.status !== undefined) {
      if (!STATUS.includes(corpo.status)) throw invalido(`status deve ser um de: ${STATUS.join(", ")}.`);
      status = corpo.status;
    }
    const agora = new Date().toISOString();
    transacao(db, () => {
      db.prepare("UPDATE ticket SET title = ?, status = ?, atualizado_em = ? WHERE id = ?").run(titulo, status, agora, t.id);
      if (status !== t.status && (status === "resolved" || t.status === "resolved")) {
        inserirMensagem(t.id, "system", "Sistema", status === "resolved" ? "Ticket marcado como resolvido." : "Ticket reaberto.", agora);
      }
    });
    return completo(t.id);
  });

  app.delete("/api/tickets/:id", ({ params }) => {
    const t = buscar(params.id);
    db.prepare("DELETE FROM ticket WHERE id = ?").run(t.id); // mensagens caem em cascata
    return { ok: true };
  });

  /**
   * Nova mensagem na conversa. Sem `role`, é do usuário.
   * Agentes autônomos respondem com `{ role: "agent", authorName: "Assistente", content }`.
   */
  app.post("/api/tickets/:id/messages", async ({ params, corpo }) => {
    const t = buscar(params.id);
    const role = papelDoCorpo(corpo);
    const conteudo = texto(corpo, "content", { max: MAX_MENSAGEM });
    const padrao = role === "user" ? "Você" : role === "agent" ? "Atendimento" : "Sistema";
    const autor = texto(corpo, "authorName", { min: 0, max: 120, opcional: true }) || padrao;
    const agora = new Date().toISOString();
    const status = role === "user" ? "open" : role === "agent" ? "answered" : t.status;
    const id = transacao(db, () => {
      const novo = inserirMensagem(t.id, role, autor, conteudo, agora);
      db.prepare("UPDATE ticket SET status = ?, atualizado_em = ? WHERE id = ?").run(status, agora, t.id);
      return novo;
    });
    const v = role === "user" && integracao ? vinculo(t.id) : null;
    if (v?.issue) {
      try { await integracao.comentar(v.issue, id, conteudo); await integracao.disparar(v.issue); }
      catch (e) { console.error(`Não foi possível encaminhar a mensagem ao GitHub (ticket ${t.id}): ${e.message}`); }
    }
    return {
      message: saidaMensagem(db.prepare("SELECT * FROM ticket_mensagem WHERE id = ?").get(id)),
      ticket: saidaTicket(buscar(t.id), ultimaMensagem(t.id)),
    };
  });
}
