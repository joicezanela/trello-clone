import { useCallback, useEffect, useState } from "react";

/** Navegação sem recarregar a página: guarda o caminho atual e acompanha voltar/avançar do navegador. */
export function useNavegacao() {
  const [caminho, setCaminho] = useState(() => window.location.pathname);
  useEffect(() => {
    const aoVoltar = () => setCaminho(window.location.pathname);
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);
  const navegar = useCallback((destino, { substituir = false } = {}) => {
    if (destino !== window.location.pathname) {
      window.history[substituir ? "replaceState" : "pushState"](null, "", destino);
    }
    setCaminho(destino);
  }, []);
  return { caminho, navegar };
}
