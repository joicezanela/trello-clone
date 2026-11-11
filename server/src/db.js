// SQLite embutido do Node (node:sqlite). Migrações em ordem; cada uma roda uma única vez.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRACOES = [
  `CREATE TABLE item (
     id TEXT PRIMARY KEY,
     titulo TEXT NOT NULL,
     descricao TEXT NOT NULL DEFAULT '',
     concluido INTEGER NOT NULL DEFAULT 0,
     posicao INTEGER NOT NULL,
     criado_em TEXT NOT NULL,
     atualizado_em TEXT NOT NULL
   )`,
  `CREATE TABLE usuario (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     nome TEXT NOT NULL,
     senha_hash TEXT NOT NULL,
     criado_em TEXT NOT NULL
   );
   CREATE TABLE sessao (
     token_hash TEXT PRIMARY KEY,
     usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
     expira_em TEXT NOT NULL
   )`,
  `CREATE TABLE board (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     criado_em TEXT NOT NULL
   );
   CREATE TABLE list (
     id TEXT PRIMARY KEY,
     board_id TEXT NOT NULL REFERENCES board(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     position INTEGER NOT NULL
   );
   CREATE TABLE card (
     id TEXT PRIMARY KEY,
     list_id TEXT NOT NULL REFERENCES list(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     position INTEGER NOT NULL
   )`,
  // Seeds rodam uma única vez (controlado pelo user_version), só na primeira criação do banco.
  `INSERT INTO board (id, title, criado_em) VALUES
     ('board-sprint', 'Sprint da semana', '2026-11-10T09:00:00.000Z'),
     ('board-ideias', 'Ideias do produto', '2026-11-10T09:00:01.000Z');
   INSERT INTO list (id, board_id, title, position) VALUES
     ('list-a-fazer', 'board-sprint', 'A fazer', 0),
     ('list-fazendo', 'board-sprint', 'Fazendo', 1),
     ('list-pronto', 'board-sprint', 'Pronto para revisar', 2),
     ('list-backlog', 'board-ideias', 'Backlog', 0);
   INSERT INTO card (id, list_id, title, description, position) VALUES
     ('card-requisitos', 'list-a-fazer', 'Levantar requisitos do quadro', 'O que o quadro precisa resolver antes da primeira versão.', 0),
     ('card-telas', 'list-a-fazer', 'Desenhar as telas do quadro', '', 1),
     ('card-api', 'list-fazendo', 'Montar a API de quadros', 'Boards, listas e cartões com movimentação entre listas.', 0),
     ('card-paleta', 'list-pronto', 'Escolher a paleta de cores', '', 0),
     ('card-metricas', 'list-backlog', 'Medir tempo por cartão', '', 0);`,
  // Atendimento: cada ticket é uma conversa; as mensagens guardam quem falou (user/agent/system).
  `CREATE TABLE ticket (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'resolved')),
     criado_em TEXT NOT NULL,
     atualizado_em TEXT NOT NULL
   );
   CREATE TABLE ticket_mensagem (
     id TEXT PRIMARY KEY,
     ticket_id TEXT NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system')),
     author_name TEXT NOT NULL,
     content TEXT NOT NULL,
     criado_em TEXT NOT NULL
   );
   CREATE INDEX ticket_mensagem_por_ticket ON ticket_mensagem (ticket_id, criado_em);
   INSERT INTO ticket (id, title, status, criado_em, atualizado_em) VALUES
     ('ticket-exemplo', 'Como mover um cartão entre listas?', 'answered', '2026-11-10T13:00:00.000Z', '2026-11-10T13:02:00.000Z');
   INSERT INTO ticket_mensagem (id, ticket_id, role, author_name, content, criado_em) VALUES
     ('msg-exemplo-1', 'ticket-exemplo', 'user', 'Você', 'Olá! Como faço para mover um cartão de "A fazer" para "Fazendo"?', '2026-11-10T13:00:00.000Z'),
     ('msg-exemplo-2', 'ticket-exemplo', 'agent', 'Atendimento',
      'Olá! Você tem dois jeitos de fazer isso:' || char(10) || char(10) ||
      '1. **Arrastar e soltar**: clique no cartão, segure e solte na lista de destino.' || char(10) ||
      '2. **Pelo menu do cartão**: abra o menu \`⋮\` e escolha **Mover para**.' || char(10) || char(10) ||
      'Se precisar de mais alguma coisa, é só responder aqui.',
      '2026-11-10T13:02:00.000Z');`,
];

/** `caminho` = arquivo do banco; `:memory:` nos testes. */
export function abrirBanco(caminho = ":memory:") {
  if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const atual = db.prepare("PRAGMA user_version").get().user_version;
  for (let i = atual; i < MIGRACOES.length; i++) {
    db.exec("BEGIN");
    try { db.exec(MIGRACOES[i]); db.exec(`PRAGMA user_version = ${i + 1}`); db.exec("COMMIT"); }
    catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  return db;
}

/** Roda `fn` numa transação; desfaz tudo se ela lançar. */
export function transacao(db, fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}
