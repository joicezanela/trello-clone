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

export function rotasDeTickets(app, db) {
  const buscar = (id) => {
    const t = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
    if (!t) throw naoEncontrado("Ticket");
    return t;
  };
  const ultimaMensagem = (ticketId) =>
    db.prepare("SELECT role, content FROM ticket_mensagem WHERE ticket_id = ? ORDER BY criado_em DESC, rowid DESC LIMIT 1").get(ticketId);
  const mensagens = (ticketId) =>
    db.prepare("SELECT * FROM ticket_mensagem WHERE ticket_id = ? ORDER BY criado_em, rowid").all(ticketId).map(saidaMensagem);
  const completo = (id) => {
    const t = buscar(id);
    return { ticket: saidaTicket(t, ultimaMensagem(t.id)), messages: mensagens(t.id) };
  };

  const inserirMensagem = (ticketId, role, autor, conteudo, agora) => {
    const id = randomUUID();
    db.prepare("INSERT INTO ticket_mensagem (id, ticket_id, role, author_name, content, criado_em) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, ticketId, role, autor, conteudo, agora);
    return id;
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
  app.post("/api/tickets", ({ corpo }) => {
    const conteudo = texto(corpo, "message", { max: MAX_MENSAGEM });
    const titulo = texto(corpo, "title", { max: 120, opcional: true }) || tituloDaMensagem(conteudo);
    const autor = texto(corpo, "authorName", { min: 0, max: 120, opcional: true }) || "Você";
    const id = randomUUID();
    const agora = new Date().toISOString();
    transacao(db, () => {
      db.prepare("INSERT INTO ticket (id, title, status, criado_em, atualizado_em) VALUES (?, ?, 'open', ?, ?)").run(id, titulo, agora, agora);
      inserirMensagem(id, "user", autor, conteudo, agora);
    });
    return completo(id);
  });

  app.get("/api/tickets/:id", ({ params }) => completo(params.id));

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
  app.post("/api/tickets/:id/messages", ({ params, corpo }) => {
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
    return {
      message: saidaMensagem(db.prepare("SELECT * FROM ticket_mensagem WHERE id = ?").get(id)),
      ticket: saidaTicket(buscar(t.id), ultimaMensagem(t.id)),
    };
  });
}
