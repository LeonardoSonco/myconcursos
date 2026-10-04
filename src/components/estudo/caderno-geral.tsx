"use client";

import { useState } from "react";
import { ListaErros } from "@/components/provas/caderno-erros";
import { Link } from "@/components/ui/link";
import type { ErroCaderno } from "@/types/database";

/** Caderno de erros de todos os concursos, agrupado por matéria. */
export function CadernoGeral({
  erros,
  materias,
  concursos,
}: {
  erros: ErroCaderno[];
  materias: Record<string, string>;
  concursos: Record<string, string>;
}) {
  const [verRevisados, setVerRevisados] = useState(false);
  const visiveis = verRevisados ? erros : erros.filter((e) => !e.revisado);
  const revisados = erros.filter((e) => e.revisado).length;

  const grupos = new Map<string, ErroCaderno[]>();
  for (const e of visiveis) {
    const nome = (e.materia_id && materias[e.materia_id]) || "Sem matéria";
    grupos.set(nome, [...(grupos.get(nome) ?? []), e]);
  }
  const ordenados = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);

  if (!erros.length) {
    return (
      <p className="text-sm text-tinta-2">
        Nada anotado. Nas provas guardadas de cada concurso, use “caderno de erros”.
      </p>
    );
  }

  return (
    <div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm text-tinta-2">
        <input
          type="checkbox"
          className="accent-[var(--tinta)]"
          checked={verRevisados}
          onChange={(e) => setVerRevisados(e.target.checked)}
        />
        Mostrar revisados (<span className="num">{revisados}</span>)
      </label>
      {ordenados.length === 0 ? (
        <p className="text-sm text-tinta-2">Todos os erros revisados.</p>
      ) : (
        <div className="space-y-5">
          {ordenados.map(([materia, lista]) => (
            <section key={materia}>
              <h3 className="mb-1.5 flex items-baseline gap-2 font-serif text-[17px]">
                {materia} <span className="num text-xs text-tinta-2">{lista.length}</span>
              </h3>
              <ListaErros
                erros={lista}
                extra={(e) => (
                  <Link href={`/concursos/${e.concurso_id}`} className="botao-texto">
                    {concursos[e.concurso_id] ?? "concurso"}
                  </Link>
                )}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
