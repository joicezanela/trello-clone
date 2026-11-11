import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { STATUS_TICKET, agruparPorData, blocosDeTexto, filtrarTickets, horaDaMensagem, trechosDeLinha } from "./atendimento.js";
import { BarraLateral } from "./BarraLateral.jsx";
import { Botao } from "./componentes/Botao.jsx";
import { Campo } from "./componentes/Campo.jsx";
import { Confirmar } from "./componentes/Confirmar.jsx";
import { Dialogo } from "./componentes/Dialogo.jsx";
import { Icone } from "./componentes/Icone.jsx";
import { Menu } from "./componentes/Menu.jsx";

/** Intervalo para buscar respostas novas do atendimento (agentes respondem pela API). */
const INTERVALO_ATUALIZACAO = 4000;

const SUGESTOES = [
  { titulo: "Não consigo acessar um quadro", texto: "Não consigo acessar um dos meus quadros. O que pode estar acontecendo?" },
  { titulo: "Mover cartões entre listas", texto: "Como faço para mover cartões entre listas?" },
  { titulo: "Encontrei um erro", texto: "Encontrei um erro no sistema. Vou descrever o que aconteceu:\n\n" },
  { titulo: "Sugerir uma melhoria", texto: "Tenho uma sugestão de melhoria para o Fluxo:\n\n" },
];

/* ---------- texto das mensagens ---------- */

function Linha({ texto }) {
  return trechosDeLinha(texto).map((t, i) => {
    if (t.tipo === "negrito") return <strong key={i}>{t.texto}</strong>;
    if (t.tipo === "codigo") return <code key={i}>{t.texto}</code>;
    if (t.tipo === "link") return <a key={i} href={t.href} target="_blank" rel="noreferrer noopener">{t.texto}</a>;
    return <span key={i}>{t.texto}</span>;
  });
}

/** Resposta do atendimento com markdown simples (negrito, listas, código, links). */
function TextoFormatado({ texto }) {
  return (
    <div className="chat-texto">
      {blocosDeTexto(texto).map((b, i) => {
        if (b.tipo === "codigo") return <pre key={i}><code>{b.texto}</code></pre>;
        if (b.tipo === "titulo") {
          const Tag = b.nivel === 1 ? "h3" : "h4";
          return <Tag key={i}><Linha texto={b.texto} /></Tag>;
        }
        if (b.tipo === "lista") {
          const Tag = b.ordenada ? "ol" : "ul";
          return (
            <Tag key={i} start={b.ordenada && b.inicio !== 1 ? b.inicio : undefined}>
              {b.itens.map((item, j) => <li key={j}><Linha texto={item} /></li>)}
            </Tag>
          );
        }
        return <p key={i}><Linha texto={b.texto} /></p>;
      })}
    </div>
  );
}

/* ---------- lateral ---------- */

function ListaTickets({ tickets, ticketId, aoNovo, aoAbrir, aoRenomear, aoAlternarStatus, aoExcluir }) {
  const [busca, setBusca] = useState("");
  const grupos = tickets ? agruparPorData(filtrarTickets(tickets, busca)) : [];

  return (
    <>
      <button type="button" className="ticket-novo" onClick={aoNovo} data-ativo={ticketId === null ? "" : undefined}>
        <Icone nome="novo-ticket" tamanho={18} />
        Novo ticket
      </button>

      {tickets?.length ? (
        <label className="ticket-busca">
          <Icone nome="busca" tamanho={16} />
          <input type="search" placeholder="Buscar tickets" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar tickets" />
        </label>
      ) : null}

      {tickets === null ? (
        <p className="lateral-vazio">Carregando tickets…</p>
      ) : !tickets.length ? (
        <p className="lateral-vazio">Nenhum ticket ainda. Abra o primeiro descrevendo sua dúvida ou problema.</p>
      ) : !grupos.length ? (
        <p className="lateral-vazio">Nenhum ticket encontrado para "{busca.trim()}".</p>
      ) : (
        <div className="ticket-grupos">
          {grupos.map((g) => (
            <section key={g.rotulo} className="ticket-grupo" aria-label={g.rotulo}>
              <h2 className="ticket-grupo-titulo">{g.rotulo}</h2>
              <ul className="lateral-lista">
                {g.tickets.map((t) => (
                  <li key={t.id}>
                    <div className="lateral-item ticket-item" data-ativo={t.id === ticketId ? "" : undefined}>
                      <button
                        type="button"
                        className="lateral-escolha"
                        aria-current={t.id === ticketId ? "page" : undefined}
                        title={t.title}
                        onClick={() => aoAbrir(t.id)}
                      >
                        <span className="ticket-ponto" data-status={t.status} aria-label={STATUS_TICKET[t.status]?.rotulo} role="img" />
                        <span className="ticket-item-titulo">{t.title}</span>
                      </button>
                      <span className="lateral-acoes">
                        <Menu
                          rotulo={`Ações do ticket ${t.title}`}
                          itens={[
                            { rotulo: "Renomear", icone: "lapis", aoClicar: () => aoRenomear(t) },
                            t.status === "resolved"
                              ? { rotulo: "Reabrir", icone: "atualizar", aoClicar: () => aoAlternarStatus(t) }
                              : { rotulo: "Marcar como resolvido", icone: "check", aoClicar: () => aoAlternarStatus(t) },
                            { rotulo: "Excluir", icone: "lixeira", perigo: true, aoClicar: () => aoExcluir(t) },
                          ]}
                        />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- caixa de mensagem ---------- */

function Compositor({ aoEnviar, desabilitado, placeholder, rascunho, aoMudarRascunho, autoFocus }) {
  const ref = useRef(null);

  // Cresce com o texto até um limite; depois rola por dentro.
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 220)}px`;
  }, [rascunho]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const enviar = () => {
    const texto = rascunho.trim();
    if (!texto || desabilitado) return;
    aoEnviar(texto);
  };

  return (
    <form
      className="compositor"
      onSubmit={(e) => { e.preventDefault(); enviar(); }}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.focus(); }}
    >
      <textarea
        ref={ref}
        className="compositor-entrada"
        rows={1}
        value={rascunho}
        maxLength={10000}
        placeholder={placeholder}
        aria-label="Mensagem"
        onChange={(e) => aoMudarRascunho(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            enviar();
          }
        }}
      />
      <button type="submit" className="compositor-enviar" aria-label="Enviar mensagem" disabled={desabilitado || !rascunho.trim()}>
        <Icone nome="enviar" tamanho={18} />
      </button>
    </form>
  );
}

/* ---------- conversa ---------- */

function Mensagem({ mensagem }) {
  if (mensagem.role === "system") {
    return (
      <div className="chat-sistema" role="note">
        <span>{mensagem.content}</span>
        <time dateTime={mensagem.createdAt}>{horaDaMensagem(mensagem.createdAt)}</time>
      </div>
    );
  }
  if (mensagem.role === "user") {
    return (
      <div className="chat-msg chat-msg-usuario" data-pendente={mensagem.pendente ? "" : undefined}>
        <div className="chat-balao">{mensagem.content}</div>
        <time className="chat-hora" dateTime={mensagem.createdAt}>
          {mensagem.pendente ? "Enviando…" : horaDaMensagem(mensagem.createdAt)}
        </time>
      </div>
    );
  }
  return (
    <div className="chat-msg chat-msg-agente">
      <span className="chat-avatar" aria-hidden="true"><Icone nome="suporte" tamanho={16} /></span>
      <div className="chat-corpo">
        <p className="chat-autor">
          {mensagem.authorName}
          <time dateTime={mensagem.createdAt}>{horaDaMensagem(mensagem.createdAt)}</time>
        </p>
        <TextoFormatado texto={mensagem.content} />
      </div>
    </div>
  );
}

function AguardandoResposta() {
  return (
    <div className="chat-msg chat-msg-agente chat-aguardando" role="status">
      <span className="chat-avatar" aria-hidden="true"><Icone nome="suporte" tamanho={16} /></span>
      <div className="chat-corpo">
        <span className="chat-pontos" aria-hidden="true"><i /><i /><i /></span>
        <p>Recebemos sua mensagem. A resposta do atendimento aparece aqui.</p>
      </div>
    </div>
  );
}

/* ---------- área ---------- */

export function AreaAtendimento({ ticketId, navegar }) {
  const [tickets, setTickets] = useState(null);
  const [conversa, setConversa] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(ticketId));
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [dialogo, setDialogo] = useState(null);
  const fimRef = useRef(null);
  const enviandoRef = useRef(false);
  const assinatura = useRef("");

  const abrirTicket = (id) => navegar(id ? `/atendimento/${encodeURIComponent(id)}` : "/atendimento");

  const carregarTickets = useCallback(async () => {
    try {
      const dados = await api.tickets.listar();
      setTickets(dados?.tickets ?? []);
    } catch (e) {
      setErro(e.message);
      setTickets((t) => t ?? []);
    }
  }, []);

  useEffect(() => { void carregarTickets(); }, [carregarTickets]);

  // Título da aba acompanha o ticket aberto.
  useEffect(() => {
    const anterior = document.title;
    document.title = conversa?.ticket ? `${conversa.ticket.title} — Atendimento` : "Atendimento — Fluxo";
    return () => { document.title = anterior; };
  }, [conversa?.ticket?.title]);

  // Ticket aberto: carrega a conversa e confere respostas novas de tempos em tempos.
  useEffect(() => {
    setErro(null);
    if (!ticketId) {
      setConversa(null);
      setCarregando(false);
      return;
    }
    let vivo = true;
    setConversa((c) => (c?.ticket?.id === ticketId ? c : null));
    setCarregando(true);

    const buscar = async (inicial) => {
      if (!inicial && (enviandoRef.current || document.visibilityState !== "visible")) return;
      try {
        const dados = await api.tickets.detalhe(ticketId);
        if (!vivo || enviandoRef.current) return;
        const nova = `${dados.ticket.updatedAt}|${dados.messages.length}|${dados.ticket.status}`;
        if (nova !== assinatura.current) {
          const primeira = assinatura.current === "";
          assinatura.current = nova;
          setConversa(dados);
          if (!primeira && !inicial) void carregarTickets();
        }
        setCarregando(false);
      } catch (e) {
        if (!vivo) return;
        if (inicial) {
          setErro(e.message);
          setCarregando(false);
        }
      }
    };

    assinatura.current = "";
    void buscar(true);
    const relogio = setInterval(() => void buscar(false), INTERVALO_ATUALIZACAO);
    return () => { vivo = false; clearInterval(relogio); };
  }, [ticketId, carregarTickets]);

  // Rola até a última mensagem quando chega algo novo.
  const totalMensagens = conversa?.messages?.length ?? 0;
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [totalMensagens, ticketId]);

  const enviar = async (texto) => {
    setErro(null);
    setEnviando(true);
    enviandoRef.current = true;
    setRascunho("");
    try {
      if (!ticketId) {
        const dados = await api.tickets.abrir(texto);
        assinatura.current = `${dados.ticket.updatedAt}|${dados.messages.length}|${dados.ticket.status}`;
        setConversa(dados);
        abrirTicket(dados.ticket.id);
      } else {
        const provisoria = { id: `tmp-${Date.now()}`, role: "user", content: texto, createdAt: new Date().toISOString(), pendente: true };
        setConversa((c) => ({ ...c, messages: [...(c?.messages ?? []), provisoria] }));
        try {
          const { message, ticket } = await api.tickets.enviar(ticketId, texto);
          setConversa((c) => {
            const messages = c.messages.map((m) => (m.id === provisoria.id ? message : m));
            assinatura.current = `${ticket.updatedAt}|${messages.length}|${ticket.status}`;
            return { ticket, messages };
          });
        } catch (e) {
          setConversa((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== provisoria.id) }));
          throw e;
        }
      }
      await carregarTickets();
    } catch (e) {
      setRascunho(texto);
      setErro(e.message);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const atualizarTicket = async (alvo, mudanca) => {
    try {
      setErro(null);
      const dados = await api.tickets.editar(alvo.id, mudanca);
      if (alvo.id === ticketId) {
        assinatura.current = `${dados.ticket.updatedAt}|${dados.messages.length}|${dados.ticket.status}`;
        setConversa(dados);
      }
      await carregarTickets();
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    }
  };

  const alternarStatus = (alvo) => atualizarTicket(alvo, { status: alvo.status === "resolved" ? "open" : "resolved" });

  const excluir = async () => {
    const alvo = dialogo?.ticket;
    if (!alvo) return;
    try {
      await api.tickets.excluir(alvo.id);
      setDialogo(null);
      if (alvo.id === ticketId) abrirTicket(null);
      await carregarTickets();
    } catch (e) {
      setErro(e.message);
      setDialogo(null);
    }
  };

  const ticket = conversa?.ticket;
  const mensagens = conversa?.messages ?? [];
  const ultima = mensagens.at(-1);
  const aguardando = ticket?.status === "open" && ultima?.role === "user";
  const status = ticket ? STATUS_TICKET[ticket.status] : null;

  const avisoErro = erro ? (
    <div className="aviso chat-aviso" role="alert">
      <span className="aviso-texto">
        <Icone nome="alerta" tamanho={18} />
        <span>{erro}</span>
      </span>
      <Botao variante="fantasma" icone="fechar" aria-label="Fechar aviso" onClick={() => setErro(null)} />
    </div>
  ) : null;

  const conteudo = () => {
    // Novo ticket: tela inicial no centro, como um chat em branco.
    if (!ticketId) {
      return (
        <div className="chat-inicio">
          <div className="chat-inicio-centro">
            <span className="chat-inicio-icone" aria-hidden="true"><Icone nome="suporte" tamanho={26} /></span>
            <h1>Como podemos ajudar?</h1>
            <p>Descreva sua dúvida ou problema. Cada ticket vira uma conversa com o atendimento e fica salvo na lateral.</p>
            {avisoErro}
            <Compositor
              rascunho={rascunho}
              aoMudarRascunho={setRascunho}
              aoEnviar={enviar}
              desabilitado={enviando}
              placeholder="Escreva sua mensagem para abrir um ticket"
              autoFocus
            />
            <div className="chat-sugestoes">
              {SUGESTOES.map((s) => (
                <button key={s.titulo} type="button" className="chat-sugestao" onClick={() => setRascunho(s.texto)}>
                  {s.titulo}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (!ticket) {
      return (
        <div className="chat-rolagem">
          <div className="chat-coluna">
            {avisoErro}
            {carregando ? <p className="carregando-line chat-carregando" role="status">Carregando conversa…</p> : null}
            {!carregando && !erro ? <p className="lateral-vazio">Ticket não encontrado.</p> : null}
            {!carregando ? <Botao icone="novo-ticket" onClick={() => abrirTicket(null)}>Abrir um novo ticket</Botao> : null}
          </div>
        </div>
      );
    }

    return (
      <>
        <header className="chat-topo">
          <div className="chat-topo-texto">
            <h1 className="chat-titulo" title={ticket.title}>{ticket.title}</h1>
            <span className="chat-status" data-status={ticket.status}>{status?.rotulo}</span>
          </div>
          <div className="chat-topo-acoes">
            <Botao variante="suave" icone={ticket.status === "resolved" ? "atualizar" : "check"} onClick={() => void alternarStatus(ticket)}>
              {ticket.status === "resolved" ? "Reabrir" : "Marcar como resolvido"}
            </Botao>
            <Menu
              rotulo="Mais ações do ticket"
              itens={[
                { rotulo: "Renomear", icone: "lapis", aoClicar: () => setDialogo({ tipo: "renomear", ticket }) },
                { rotulo: "Excluir", icone: "lixeira", perigo: true, aoClicar: () => setDialogo({ tipo: "excluir", ticket }) },
              ]}
            />
          </div>
        </header>

        <div className="chat-rolagem">
          <div className="chat-coluna" aria-live="polite">
            {mensagens.map((m) => <Mensagem key={m.id} mensagem={m} />)}
            {aguardando ? <AguardandoResposta /> : null}
            <div ref={fimRef} />
          </div>
        </div>

        <div className="chat-rodape">
          {avisoErro}
          <Compositor
            rascunho={rascunho}
            aoMudarRascunho={setRascunho}
            aoEnviar={enviar}
            desabilitado={enviando}
            placeholder={ticket.status === "resolved" ? "Enviar uma mensagem reabre o ticket" : "Escreva uma mensagem"}
            autoFocus
          />
          <p className="chat-dica">Enter envia · Shift + Enter quebra a linha</p>
        </div>
      </>
    );
  };

  return (
    <div className="app">
      <BarraLateral secao="atendimento" aoNavegar={navegar}>
        <ListaTickets
          tickets={tickets}
          ticketId={ticketId}
          aoNovo={() => { setRascunho(""); abrirTicket(null); }}
          aoAbrir={(id) => { if (id !== ticketId) setRascunho(""); abrirTicket(id); }}
          aoRenomear={(t) => setDialogo({ tipo: "renomear", ticket: t })}
          aoAlternarStatus={(t) => void alternarStatus(t)}
          aoExcluir={(t) => setDialogo({ tipo: "excluir", ticket: t })}
        />
      </BarraLateral>

      <main className="chat">{conteudo()}</main>

      {dialogo?.tipo === "renomear" ? (
        <Dialogo aberto titulo="Renomear ticket" aoFechar={() => setDialogo(null)}>
          <form
            className="formulario"
            onSubmit={async (e) => {
              e.preventDefault();
              const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
              if (title && (await atualizarTicket(dialogo.ticket, { title }))) setDialogo(null);
            }}
          >
            <Campo rotulo="Título do ticket" name="title" defaultValue={dialogo.ticket.title} maxLength={120} required autoFocus />
            <div className="acoes">
              <Botao onClick={() => setDialogo(null)}>Cancelar</Botao>
              <Botao variante="primario" type="submit">Salvar</Botao>
            </div>
          </form>
        </Dialogo>
      ) : null}

      {dialogo?.tipo === "excluir" ? (
        <Confirmar
          aberto
          titulo="Excluir ticket"
          descricao={`Excluir "${dialogo.ticket.title}" apaga a conversa inteira. Não dá para desfazer.`}
          rotuloConfirmar="Excluir ticket"
          aoConfirmar={() => void excluir()}
          aoFechar={() => setDialogo(null)}
        />
      ) : null}
    </div>
  );
}
