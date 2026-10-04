"use client";

import { Contrast } from "lucide-react";

/** Alterna claro/escuro; a escolha fica no localStorage (lida em layout.tsx antes da pintura). */
export function TemaToggle() {
  function alternar() {
    const html = document.documentElement;
    const escuroAgora =
      html.dataset.theme === "dark" ||
      (!html.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const novo = escuroAgora ? "light" : "dark";
    html.dataset.theme = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="text-tinta-2 transition-colors hover:text-tinta"
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema"
    >
      <Contrast size={16} strokeWidth={1.5} />
    </button>
  );
}
