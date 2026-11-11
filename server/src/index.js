import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { criarApp } from "./app.js";
import { configDoAmbiente, criarIntegracaoGithub } from "./github.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env"))) process.loadEnvFile(join(raiz, ".env"));

const porta = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const banco = process.env.BANCO ?? join(raiz, "server", "dados", "app.sqlite");
const config = configDoAmbiente();
const integracao = config ? criarIntegracaoGithub(config) : null;
const { servidor } = criarApp({ banco, integracao });
servidor.listen(porta, "127.0.0.1", () => {
  console.log(`API em http://127.0.0.1:${porta}/api`);
  console.log(integracao ? `Atendimento ligado ao GitHub (${config.repo}).` : "Atendimento sem integração com o GitHub (AGENT_RUNTIME não é github-actions).");
});
