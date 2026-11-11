import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparPorData, blocosDeTexto, filtrarTickets, trechosDeLinha } from "../src/atendimento.js";

const agora = new Date(2026, 10, 11, 15, 0);
const em = (dias, hora = 10) => new Date(2026, 10, 11 - dias, hora).toISOString();

test("agrupa tickets por data relativa e omite grupos vazios", () => {
  const tickets = [
    { id: "a", updatedAt: em(0) },
    { id: "b", updatedAt: em(1, 23) },
    { id: "c", updatedAt: em(3) },
    { id: "d", updatedAt: em(90) },
  ];
  const grupos = agruparPorData(tickets, agora);
  assert.deepEqual(grupos.map((g) => [g.rotulo, g.tickets.map((t) => t.id)]), [
    ["Hoje", ["a"]],
    ["Ontem", ["b"]],
    ["Últimos 7 dias", ["c"]],
    ["Mais antigos", ["d"]],
  ]);
});

test("busca ignora acentos e maiúsculas e olha a última mensagem", () => {
  const tickets = [
    { id: "1", title: "Erro ao mover cartão", lastMessage: { content: "" } },
    { id: "2", title: "Dúvida", lastMessage: { content: "Como EXCLUIR uma lista?" } },
  ];
  assert.deepEqual(filtrarTickets(tickets, "cartao").map((t) => t.id), ["1"]);
  assert.deepEqual(filtrarTickets(tickets, "excluir").map((t) => t.id), ["2"]);
  assert.equal(filtrarTickets(tickets, "  ").length, 2);
});

test("markdown em blocos: parágrafos, listas, títulos e código", () => {
  const blocos = blocosDeTexto("Olá!\nTudo bem?\n\n## Passos\n1. Abra\n2. Clique\n- solto\n\n```js\nconst a = 1;\n```\nFim");
  assert.deepEqual(blocos.map((b) => b.tipo), ["paragrafo", "titulo", "lista", "lista", "codigo", "paragrafo"]);
  assert.equal(blocos[0].texto, "Olá!\nTudo bem?");
  assert.deepEqual(blocos[2], { tipo: "lista", ordenada: true, inicio: 1, itens: ["Abra", "Clique"] });
  assert.equal(blocos[3].ordenada, false);
  assert.deepEqual(blocos[4], { tipo: "codigo", linguagem: "js", texto: "const a = 1;" });
});

test("trechos: negrito, código e só links http(s)", () => {
  assert.deepEqual(trechosDeLinha("Use **Mover** no `menu` ou [veja](https://x.com/a)."), [
    { tipo: "texto", texto: "Use " },
    { tipo: "negrito", texto: "Mover" },
    { tipo: "texto", texto: " no " },
    { tipo: "codigo", texto: "menu" },
    { tipo: "texto", texto: " ou " },
    { tipo: "link", texto: "veja", href: "https://x.com/a" },
    { tipo: "texto", texto: "." },
  ]);
  assert.deepEqual(trechosDeLinha("[x](javascript:alert(1))"), [{ tipo: "texto", texto: "[x](javascript:alert(1))" }]);
});
