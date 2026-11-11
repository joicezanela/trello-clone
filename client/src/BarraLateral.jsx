import { Botao } from "./componentes/Botao.jsx";
import { Icone } from "./componentes/Icone.jsx";

const SECOES = [
  { id: "quadros", rotulo: "Quadros", icone: "colunas", caminho: "/quadro" },
  { id: "atendimento", rotulo: "Atendimento", icone: "suporte", caminho: "/atendimento" },
];

/** Lateral do sistema: marca, menu de seções e, abaixo, o conteúdo da seção aberta. */
export function BarraLateral({ secao, aoNavegar, children }) {
  return (
    <aside className="lateral" aria-label="Navegação">
      <a className="marca" href="/" aria-label="Fluxo, voltar ao início" style={{ textDecoration: "none" }}>
        <span className="marca-simbolo" aria-hidden="true">
          <Icone nome="colunas" tamanho={18} />
        </span>
        <span className="marca-nome">Fluxo</span>
      </a>

      <nav className="lateral-nav" aria-label="Seções">
        {SECOES.map((s) => (
          <a
            key={s.id}
            href={s.caminho}
            className="lateral-nav-item"
            aria-current={s.id === secao ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              aoNavegar(s.caminho);
            }}
          >
            <Icone nome={s.icone} tamanho={18} />
            {s.rotulo}
          </a>
        ))}
      </nav>

      <div className="lateral-secao">{children}</div>
    </aside>
  );
}

/** Lista de quadros da seção "Quadros", com o atalho para criar um novo. */
export function ListaQuadros({ quadros, quadroId, aoSelecionar, aoNovoQuadro, aoRenomear, aoExcluir }) {
  return (
    <>
      <div className="lateral-topo">
        <h2 className="lateral-titulo">Quadros</h2>
        <Botao variante="fantasma" icone="mais" aria-label="Criar quadro" onClick={aoNovoQuadro} />
      </div>

      {quadros === null ? (
        <p className="lateral-vazio">Carregando quadros…</p>
      ) : quadros.length ? (
        <ul className="lateral-lista">
          {quadros.map((quadro) => (
            <li key={quadro.id}>
              <div className="lateral-item" data-ativo={quadro.id === quadroId ? "" : undefined}>
                <button
                  type="button"
                  className="lateral-escolha"
                  aria-current={quadro.id === quadroId ? "page" : undefined}
                  onClick={() => aoSelecionar(quadro.id)}
                >
                  {quadro.title}
                </button>
                <span className="lateral-acoes">
                  <Botao variante="fantasma" icone="lapis" aria-label={`Renomear quadro ${quadro.title}`} onClick={() => aoRenomear(quadro)} />
                  <Botao variante="fantasma" icone="lixeira" aria-label={`Excluir quadro ${quadro.title}`} onClick={() => aoExcluir(quadro)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lateral-vazio">Nenhum quadro ainda. Crie o primeiro para começar.</p>
      )}
    </>
  );
}
