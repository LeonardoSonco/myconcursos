import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConcursoInput } from "@/lib/schemas/concurso";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export type Gravacao =
  | { ok: true; id: string; precisaDistancias: boolean }
  | { ok: false; mensagem: string };

/**
 * Cria ou edita um concurso com seus cargos (já validados).
 * Sem transação via PostgREST: apaga cargos removidos -> zera `principal` -> upsert.
 */
export async function gravarConcurso(supabase: Db, input: ConcursoInput): Promise<Gravacao> {
  const { id, cargos, ...dados } = input;

  const cargosNorm = cargos.map((c, i) => ({ ...c, ordem: i }));
  if (cargosNorm.length && !cargosNorm.some((c) => c.principal)) cargosNorm[0].principal = true;

  let concursoId: string;
  let precisaDistancias = true;

  if (id) {
    const { data: atual, error } = await supabase
      .from("concursos")
      .select("municipio, uf, lat")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, mensagem: `Não foi possível carregar o concurso: ${error.message}` };
    if (!atual) return { ok: false, mensagem: "Concurso não encontrado." };

    const lugarMudou = atual.municipio !== dados.municipio || atual.uf !== dados.uf;
    const { error: errUpd } = await supabase
      .from("concursos")
      .update(
        lugarMudou
          ? { ...dados, lat: null, lon: null, geocodificado_em: null, geocode_erro: null }
          : dados,
      )
      .eq("id", id);
    if (errUpd) return { ok: false, mensagem: `Não foi possível salvar: ${errUpd.message}` };

    if (lugarMudou) {
      // Cache antigo deixa de valer; quem chamou recalcula.
      await supabase.from("concurso_distancias").delete().eq("concurso_id", id);
    }
    precisaDistancias = lugarMudou || atual.lat == null;
    concursoId = id;
  } else {
    const { data: novo, error } = await supabase
      .from("concursos")
      .insert(dados)
      .select("id")
      .single();
    if (error) return { ok: false, mensagem: `Não foi possível salvar: ${error.message}` };
    concursoId = novo.id;
  }

  const erroCargos = (m: string) => ({
    ok: false as const,
    mensagem: `Concurso salvo, mas houve erro nos cargos: ${m}`,
  });

  const ids = cargosNorm.map((c) => c.id);
  let remover = supabase.from("cargos").delete().eq("concurso_id", concursoId);
  if (ids.length) remover = remover.not("id", "in", `(${ids.join(",")})`);
  const { error: errDel } = await remover;
  if (errDel) return erroCargos(errDel.message);

  if (cargosNorm.length) {
    const { error: errZera } = await supabase
      .from("cargos")
      .update({ principal: false })
      .eq("concurso_id", concursoId)
      .eq("principal", true);
    if (errZera) return erroCargos(errZera.message);

    const { error: errUps } = await supabase
      .from("cargos")
      .upsert(cargosNorm.map((c) => ({ ...c, concurso_id: concursoId })));
    if (errUps) return erroCargos(errUps.message);
  }

  return { ok: true, id: concursoId, precisaDistancias };
}
