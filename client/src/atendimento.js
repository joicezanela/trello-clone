// Lógica pura da área de atendimento: rótulos, agrupamento da lateral por data e um
// markdown mínimo (sem HTML cru) para as respostas dos agentes. Testada sem navegador.

export const STATUS_TICKET = {
  open: { rotulo: "Aguardando atendimento", curto: "Aberto" },
  answered: { rotulo: "Respondido", curto: "Respondido" },
  resolved: { rotulo: "Resolvido", curto: "Resolvido" },
};

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DIA = 86_400_000;

/** Agrupa tickets (já ordenados do mais recente) em Hoje / Ontem / 7 dias / 30 dias / Mais antigos. */
export function agruparPorData(tickets, agora = new Date()) {
  const hoje = inicioDoDia(agora);
  const faixas = [
    { rotulo: "Hoje", desde: hoje },
    { rotulo: "Ontem", desde: hoje - DIA },
    { rotulo: "Últimos 7 dias", desde: hoje - 7 * DIA },
    { rotulo: "Últimos 30 dias", desde: hoje - 30 * DIA },
    { rotulo: "Mais antigos", desde: -Infinity },
  ];
  const grupos = faixas.map((f) => ({ rotulo: f.rotulo, tickets: [] }));
  for (const t of tickets) {
    const quando = new Date(t.updatedAt).getTime();
    const i = faixas.findIndex((f) => quando >= f.desde);
    grupos[i === -1 ? grupos.length - 1 : i].tickets.push(t);
  }
  return grupos.filter((g) => g.tickets.length);
}

/** Filtro da busca da lateral: ignora maiúsculas e acentos, procura no título e na última mensagem. */
export function filtrarTickets(tickets, busca) {
  const normalizar = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termo = normalizar(busca).trim();
  if (!termo) return tickets;
  return tickets.filter((t) => normalizar(t.title).includes(termo) || normalizar(t.lastMessage?.content).includes(termo));
}

/** Hora curta para a conversa: "14:05" hoje, "10/11 14:05" em outros dias. */
export function horaDaMensagem(iso, agora = new Date()) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (inicioDoDia(d) === inicioDoDia(agora)) return hora;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

/**
 * Markdown mínimo em blocos: títulos (#), listas (-, *, 1.), blocos de código (```) e parágrafos.
 * Devolve dados, não HTML: quem desenha é o React, então nada do texto vira marcação.
 */
export function blocosDeTexto(texto) {
  const linhas = String(texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocos = [];
  let paragrafo = [];
  let lista = null;
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", texto: paragrafo.join("\n") });
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) blocos.push(lista);
    lista = null;
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const cerca = linha.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (cerca) {
      fecharParagrafo();
      fecharLista();
      const corpo = [];
      i++;
      while (i < linhas.length && !/^\s*```\s*$/.test(linhas[i])) corpo.push(linhas[i++]);
      blocos.push({ tipo: "codigo", linguagem: cerca[1] || null, texto: corpo.join("\n") });
      continue;
    }
    const titulo = linha.match(/^\s*(#{1,3})\s+(.*)$/);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: "titulo", nivel: titulo[1].length, texto: titulo[2].trim() });
      continue;
    }
    const item = linha.match(/^\s*(?:([-*])|(\d+)[.)])\s+(.*)$/);
    if (item) {
      fecharParagrafo();
      const ordenada = Boolean(item[2]);
      if (!lista || lista.ordenada !== ordenada) {
        fecharLista();
        lista = { tipo: "lista", ordenada, inicio: ordenada ? Number(item[2]) : 1, itens: [] };
      }
      lista.itens.push(item[3]);
      continue;
    }
    if (!linha.trim()) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    fecharLista();
    paragrafo.push(linha);
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

/** Trechos de uma linha: **negrito**, `código` e [links](https://...). Só http(s) vira link. */
export function trechosDeLinha(texto) {
  const padrao = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const trechos = [];
  let ultimo = 0;
  for (const m of String(texto ?? "").matchAll(padrao)) {
    if (m.index > ultimo) trechos.push({ tipo: "texto", texto: texto.slice(ultimo, m.index) });
    if (m[1]) trechos.push({ tipo: "codigo", texto: m[1].slice(1, -1) });
    else if (m[2]) trechos.push({ tipo: "negrito", texto: m[2].slice(2, -2) });
    else trechos.push({ tipo: "link", texto: m[3], href: m[4] });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) trechos.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return trechos;
}
