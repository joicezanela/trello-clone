import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { criarApp } from "../src/app.js";
import { tituloDaMensagem } from "../src/tickets.js";

let base, servidor;
const chamar = async (metodo, caminho, corpo) => {
  const r = await fetch(base + caminho, { method: metodo, headers: { "content-type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  return { status: r.status, dados: r.status === 204 ? null : await r.json() };
};

before(async () => {
  ({ servidor } = criarApp());
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

test("ticket de exemplo existe e a listagem devolve {tickets} com a última mensagem", async () => {
  const r = await chamar("GET", "/api/tickets");
  assert.equal(r.status, 200);
  const exemplo = r.dados.tickets.find((t) => t.id === "ticket-exemplo");
  assert.ok(exemplo);
  assert.equal(exemplo.status, "answered");
  assert.equal(exemplo.lastMessage.role, "agent");
  const conversa = (await chamar("GET", "/api/tickets/ticket-exemplo")).dados;
  assert.deepEqual(conversa.messages.map((m) => m.role), ["user", "agent"]);
});

test("abrir ticket cria a conversa com a primeira mensagem e título automático", async () => {
  const r = await chamar("POST", "/api/tickets", { message: "  Não consigo excluir uma lista\nAparece um erro.  " });
  assert.equal(r.status, 201);
  assert.equal(r.dados.ticket.title, "Não consigo excluir uma lista");
  assert.equal(r.dados.ticket.status, "open");
  assert.equal(r.dados.messages.length, 1);
  assert.equal(r.dados.messages[0].role, "user");
  assert.equal(r.dados.messages[0].content, "Não consigo excluir uma lista\nAparece um erro.");
  assert.equal((await chamar("POST", "/api/tickets", { message: "   " })).status, 400);
  const lista = (await chamar("GET", "/api/tickets")).dados.tickets;
  assert.equal(lista[0].id, r.dados.ticket.id, "o mais recente vem primeiro");
});

test("resposta do agente marca como respondido; nova mensagem do usuário volta para aberto", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { message: "Preciso de ajuda" })).dados;
  const agente = await chamar("POST", `/api/tickets/${ticket.id}/messages`, { role: "agent", authorName: "Assistente IA", content: "Claro, como posso ajudar?" });
  assert.equal(agente.status, 201);
  assert.equal(agente.dados.message.authorName, "Assistente IA");
  assert.equal(agente.dados.ticket.status, "answered");
  const usuario = await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "Obrigado!" });
  assert.equal(usuario.dados.message.role, "user");
  assert.equal(usuario.dados.ticket.status, "open");
  assert.equal((await chamar("POST", `/api/tickets/${ticket.id}/messages`, { role: "robo", content: "x" })).status, 400);
  assert.equal((await chamar("POST", "/api/tickets/nao-existe/messages", { content: "x" })).status, 404);
});

test("resolver e reabrir deixam aviso do sistema na conversa; renomear e excluir", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { message: "Dúvida rápida" })).dados;
  const resolvido = (await chamar("PATCH", `/api/tickets/${ticket.id}`, { status: "resolved" })).dados;
  assert.equal(resolvido.ticket.status, "resolved");
  assert.equal(resolvido.messages.at(-1).role, "system");
  const reaberto = (await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "Voltou a acontecer" })).dados;
  assert.equal(reaberto.ticket.status, "open");
  assert.equal((await chamar("PATCH", `/api/tickets/${ticket.id}`, { status: "fechado" })).status, 400);
  assert.equal((await chamar("PATCH", `/api/tickets/${ticket.id}`, { title: "Novo nome" })).dados.ticket.title, "Novo nome");
  assert.deepEqual((await chamar("DELETE", `/api/tickets/${ticket.id}`)).dados, { ok: true });
  assert.equal((await chamar("GET", `/api/tickets/${ticket.id}`)).status, 404);
});

test("título automático ignora marcação e corta textos longos", () => {
  assert.equal(tituloDaMensagem("\n\n## **Erro** no quadro\nresto"), "Erro no quadro");
  const longo = tituloDaMensagem("a".repeat(200));
  assert.ok(longo.length <= 80 && longo.endsWith("…"));
});
