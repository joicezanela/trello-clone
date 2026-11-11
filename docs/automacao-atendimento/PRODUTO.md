# Produto — Fluxo

Quadro de tarefas no estilo Trello. Roda local: interface React/Vite, API Node e banco SQLite.
Não há login obrigatório: quem abre o app vê e edita todos os quadros.

## Telas

| Endereço | O que mostra |
|---|---|
| `/` | Página inicial com prévia do quadro e o botão **Abrir meus quadros** |
| `/quadro` | Quadros, listas e cartões (menu **Quadros** na lateral) |
| `/atendimento` | Tickets de suporte (menu **Atendimento** na lateral) |

## Como usar

- **Quadro**: na lateral, o **+** ao lado de "Quadros" abre **Novo quadro**; o lápis renomeia e a lixeira exclui (apaga listas e cartões dele, sem desfazer). O lápis e a lixeira também ficam no topo do quadro aberto.
- **Lista**: **Adicionar lista** no fim do quadro. Clique no nome para renomear; o menu de opções tem **Renomear lista** e **Excluir lista** (apaga os cartões dela).
- **Cartão**: **Adicionar cartão** no fim da lista. O menu do cartão tem **Editar cartão** (título até 200 caracteres e descrição até 2000), **Excluir cartão** e **Mover para** outra lista.
- **Mover cartão**: arraste para outra posição ou lista, ou use **Mover para**.
- **Atendimento**: abra um ticket escrevendo a primeira mensagem; as respostas aparecem sozinhas (a tela confere a cada 4 segundos).

## O que o app não tem

Não há etiquetas, prazos, responsáveis, anexos, comentários em cartões, compartilhamento,
notificações, exportação nem versão móvel própria. Pedido disso é **melhoria**, não dúvida.

Detalhes da API: [README.md](../../README.md). Onde fica cada coisa: [ESQUELETO.md](../../ESQUELETO.md).
