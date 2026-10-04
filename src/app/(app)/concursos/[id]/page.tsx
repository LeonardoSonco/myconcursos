import { ExternalLink, MapPin } from "lucide-react";
import { Link } from "@/components/ui/link";
import { notFound } from "next/navigation";
import { BotaoExcluir } from "@/components/concursos/botao-excluir";
import { BotaoRecalcular } from "@/components/concursos/botao-recalcular";
import { MinhaParticipacao } from "@/components/participacao/minha-participacao";
import { ProvasAnteriores } from "@/components/provas/provas-anteriores";
import { Carimbo } from "@/components/ui/carimbo";
import { Progresso } from "@/components/ui/progresso";
import { DataProva, PrazoInscricao } from "@/components/ui/datas";
import { custoCombustivel } from "@/lib/custo";
import { cargoPrincipal, duracao, hojeISO, km, moeda, vagasTexto } from "@/lib/format";
import { realizado } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export default async function ConcursoPage({ params }: PageProps<"/concursos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: concurso },
    { data: cidades },
    { data: progresso },
    { data: provas },
    { data: participacao },
    { data: preferencias },
    { data: materias },
    { data: erros },
  ] = await Promise.all([
    supabase
      .from("concursos")
      .select("*, cargos(*), concurso_distancias(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("cidades_base").select("*").order("ordem"),
    supabase.from("v_progresso_concurso").select("*").eq("concurso_id", id).maybeSingle(),
    // RLS: prova_resolvida embutida traz só a linha do usuário logado.
    supabase
      .from("provas_anteriores")
      .select("*, prova_resolvida(acertos, questoes)")
      .eq("concurso_id", id)
      .order("ano", { ascending: false, nullsFirst: false })
      .order("criado_em"),
    // Individuais (RLS): só a linha do usuário logado.
    supabase.from("participacao").select("*").eq("concurso_id", id).maybeSingle(),
    supabase.from("preferencias").select("*").maybeSingle(),
    supabase.from("materias").select("id, nome").eq("concurso_id", id).order("ordem"),
    // caderno_erros é individual (RLS).
    supabase.from("caderno_erros").select("*").eq("concurso_id", id).order("criado_em"),
  ]);

  if (!concurso) notFound();

  const hoje = hojeISO();
  const cargos = [...concurso.cargos].sort(
    (a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem,
  );
  const nome = `${concurso.municipio} – ${concurso.uf}`;
  const origens = (cidades ?? []).map((cb) => {
    const d = concurso.concurso_distancias.find((x) => x.cidade_base_id === cb.id);
    return {
      rotulo: cb.rotulo,
      km: d?.distancia_km ?? null,
      combustivel: custoCombustivel(d?.distancia_km, preferencias?.consumo_km_l, preferencias?.preco_combustivel),
    };
  });

  return (
    <div className="max-w-5xl">
      <Link href="/" className="botao-texto text-sm">
        ← Concursos
      </Link>

      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-pauta pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl leading-tight tracking-tight">
            {concurso.municipio}
            <span className="text-tinta-2"> – {concurso.uf}</span>
          </h1>
          {concurso.orgao && <p className="text-tinta-2">{concurso.orgao}</p>}
        </div>
        <div className="pt-2">
          <Carimbo status={concurso.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-pauta py-2 text-sm">
        <Link href={`/concursos/${id}/editar`} className="botao-texto">
          Editar
        </Link>
        <Link href={`/concursos/${id}/estudo`} className="botao-texto">
          Estudo
        </Link>
        <BotaoRecalcular id={id} />
        <span className="ml-auto">
          <BotaoExcluir id={id} nome={nome} />
        </span>
      </div>

      {concurso.geocode_erro && (
        <p className="mt-3 border-l-2 border-acento pl-3 text-sm text-acento">
          {concurso.geocode_erro}. Confira a grafia do município e a UF.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-pauta py-5 text-sm sm:grid-cols-4">
        <div>
          <dt className="rotulo">Banca</dt>
          <dd className="mt-0.5">{concurso.banca ?? "—"}</dd>
        </div>
        <div>
          <dt className="rotulo">Prazo para inscrição</dt>
          <dd className="mt-0.5">
            <PrazoInscricao iso={concurso.inscricao_fim} hoje={hoje} inscrito={participacao?.inscrito ?? false} />
          </dd>
        </div>
        <div>
          <dt className="rotulo">Data da prova</dt>
          <dd className="mt-0.5">
            <DataProva iso={concurso.prova_data} hoje={hoje} />
          </dd>
        </div>
        <div>
          <dt className="rotulo">Edital</dt>
          <dd className="mt-0.5">
            {concurso.edital_url ? (
              <a
                href={concurso.edital_url}
                target="_blank"
                rel="noreferrer"
                className="botao-texto inline-flex items-center gap-1"
              >
                abrir <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        {(cidades ?? []).map((cb) => {
          const d = concurso.concurso_distancias.find((x) => x.cidade_base_id === cb.id);
          return (
            <div key={cb.id}>
              <dt className="rotulo">Distância de {cb.rotulo}</dt>
              <dd className="num mt-0.5">
                {d?.erro ? (
                  <span className="text-tinta-2" title={d.erro}>
                    erro no cálculo
                  </span>
                ) : (
                  <>
                    {km(d?.distancia_km)}
                    {d?.duracao_min != null && (
                      <span className="text-tinta-2"> · {duracao(d.duracao_min)}</span>
                    )}
                  </>
                )}
              </dd>
            </div>
          );
        })}
        {concurso.lat != null && concurso.lon != null && (
          <div>
            <dt className="rotulo">Localização</dt>
            <dd className="mt-0.5">
              <a
                href={`https://www.openstreetmap.org/?mlat=${concurso.lat}&mlon=${concurso.lon}#map=11/${concurso.lat}/${concurso.lon}`}
                target="_blank"
                rel="noreferrer"
                className="botao-texto inline-flex items-center gap-1"
              >
                <MapPin size={12} strokeWidth={1.5} /> ver no mapa
              </a>
            </dd>
          </div>
        )}
      </dl>

      <section className="border-b border-pauta py-5">
        <h2 className="mb-1 font-serif text-xl">Minha participação</h2>
        <MinhaParticipacao
          concursoId={id}
          participacao={participacao}
          realizado={realizado(concurso.status)}
          taxa={cargoPrincipal(concurso.cargos)?.taxa_inscricao ?? null}
          origens={origens}
          temPreferencias={!!(preferencias?.consumo_km_l && preferencias.preco_combustivel)}
        />
      </section>

      <section className="border-b border-pauta py-5">
        <div className="mb-2 flex items-baseline gap-4">
          <h2 className="font-serif text-xl">Estudo</h2>
          <Link href={`/concursos/${id}/estudo`} className="botao-texto text-sm">
            abrir checklist
          </Link>
        </div>
        {progresso && progresso.total_topicos > 0 ? (
          <Progresso feitos={progresso.estudados} total={progresso.total_topicos} grande className="max-w-md" />
        ) : (
          <p className="text-sm text-tinta-2">Sem conteúdo programático ainda.</p>
        )}
      </section>

      <section className="border-b border-pauta py-5">
        <h2 className="mb-3 font-serif text-xl">Provas anteriores</h2>
        <ProvasAnteriores
          concursoId={id}
          cargos={[...new Set(cargos.map((c) => c.nome))]}
          banca={concurso.banca}
          materias={materias ?? []}
          erros={erros ?? []}
          provas={(provas ?? []).map(({ prova_resolvida, ...p }) => ({
            ...p,
            resolvida: prova_resolvida[0] ?? null,
          }))}
        />
      </section>

      <section className="py-5">
        <h2 className="mb-3 font-serif text-xl">Cargos</h2>
        {cargos.length === 0 ? (
          <p className="text-sm text-tinta-2">Nenhum cargo cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-pauta bg-papel-2 text-left">
                  <th className="rotulo px-2 py-2 font-normal">Cargo</th>
                  <th className="rotulo px-2 py-2 text-right font-normal">Vagas</th>
                  <th className="rotulo px-2 py-2 text-right font-normal">Horas</th>
                  <th className="rotulo px-2 py-2 text-right font-normal">Salário</th>
                  <th className="rotulo px-2 py-2 text-right font-normal">Taxa</th>
                  <th className="rotulo px-2 py-2 font-normal">Requisitos</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.id} className="border-b border-pauta align-top">
                    <td className="px-2 py-1.5">
                      {c.nome}
                      {c.principal && cargos.length > 1 && (
                        <span className="rotulo ml-2">principal</span>
                      )}
                    </td>
                    <td className="num px-2 py-1.5 text-right">{vagasTexto(c)}</td>
                    <td className="num px-2 py-1.5 text-right">
                      {c.carga_horaria_semanal ? `${c.carga_horaria_semanal}h` : "—"}
                    </td>
                    <td className="num px-2 py-1.5 text-right whitespace-nowrap">{moeda(c.salario)}</td>
                    <td className="num px-2 py-1.5 text-right whitespace-nowrap">
                      {moeda(c.taxa_inscricao)}
                    </td>
                    <td className="px-2 py-1.5 text-tinta-2">{c.requisitos ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {concurso.observacoes && (
        <section className="border-t border-pauta py-5">
          <h2 className="mb-2 font-serif text-xl">Observações</h2>
          <p className="text-sm whitespace-pre-line">{concurso.observacoes}</p>
        </section>
      )}
    </div>
  );
}
