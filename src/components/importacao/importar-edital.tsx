"use client";

import { Check, Copy, FileText, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { salvarImportacao } from "@/actions/importacao";
import { Campo, Secao } from "@/components/ui/campos";
import { Girando } from "@/components/ui/girando";
import { data as fmtData, horasSalario, moeda, numeroParaInput, parseNumeroBR, vagasTexto } from "@/lib/format";
import { interpretarRespostaIA, type ResultadoJson } from "@/lib/edital/json";
import { extrairTextoPdf, type TextoPdf } from "@/lib/edital/pdf";
import {
  gerarPartes,
  gerarPrompt,
  LIMITE_TEXTO,
  recortarTexto,
  TAMANHOS_RECORTE,
} from "@/lib/edital/prompt";
import { extrairDados, type Candidato, type Extracao } from "@/lib/edital/regex";
import { errosPorCampo } from "@/lib/schemas/concurso";
import { importacaoSalvarSchema, type ImportacaoJson } from "@/lib/schemas/importacao";
import { STATUS, STATUS_ROTULO, UFS } from "@/lib/status";
import type { ConcursoStatus } from "@/types/database";

type ConcursoResumo = { id: string; municipio: string; uf: string; orgao: string | null };
type CargoJson = ImportacaoJson["cargos"][number] & { id: string };

type Dados = {
  municipio: string;
  uf: string;
  orgao: string;
  banca: string;
  edital_url: string;
  status: ConcursoStatus;
  inscricao_fim: string;
  prova_data: string;
  vagas: string;
  carga: string;
  salario: string;
  taxa: string;
};

const DADOS_VAZIOS: Dados = {
  municipio: "",
  uf: "",
  orgao: "",
  banca: "",
  edital_url: "",
  status: "edital_publicado",
  inscricao_fim: "",
  prova_data: "",
  vagas: "1",
  carga: "",
  salario: "",
  taxa: "",
};

/** Primeiro candidato de cada campo vira o valor inicial do formulário. */
function dadosDaExtracao(e: Extracao, atual: Dados): Dados {
  const p = <T,>(l: Candidato<T>[]) => l[0]?.valor;
  return {
    ...atual,
    municipio: p(e.municipio) ?? atual.municipio,
    uf: p(e.uf) ?? atual.uf,
    orgao: p(e.orgao) ?? atual.orgao,
    banca: p(e.banca) ?? atual.banca,
    inscricao_fim: p(e.inscricao_fim) ?? atual.inscricao_fim,
    prova_data: p(e.prova_data) ?? atual.prova_data,
    carga: p(e.carga_horaria)?.toString() ?? atual.carga,
    salario: e.salario[0] ? numeroParaInput(e.salario[0].valor) : atual.salario,
    taxa: e.taxa[0] ? numeroParaInput(e.taxa[0].valor) : atual.taxa,
  };
}

const textoOuNull = (t: string) => (t.trim() ? t.trim() : null);

export function ImportarEdital({ concursos }: { concursos: ConcursoResumo[] }) {
  // 1. Arquivo
  const [pdf, setPdf] = useState<(TextoPdf & { nome: string }) | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const [cargoAlvo, setCargoAlvo] = useState("");

  // 2. Dados conferidos
  const [extracao, setExtracao] = useState<Extracao | null>(null);
  const [dados, setDados] = useState<Dados>(DADOS_VAZIOS);

  // 3. Prompt
  const [tamanho, setTamanho] = useState<number | "completo">(LIMITE_TEXTO);
  const [emPartes, setEmPartes] = useState(false);
  const [copiados, setCopiados] = useState<Set<number>>(new Set());

  // 4. Resposta
  const [resposta, setResposta] = useState("");
  const [resultado, setResultado] = useState<ResultadoJson | null>(null);
  const [cargosJson, setCargosJson] = useState<CargoJson[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [cargoMaterias, setCargoMaterias] = useState<string>("");

  // 5. Salvar
  const [destino, setDestino] = useState<"novo" | "existente">("novo");
  const [concursoDestino, setConcursoDestino] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<Dados>) => setDados((d) => ({ ...d, ...patch }));

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.type && arquivo.type !== "application/pdf") {
      setErroPdf("Escolha um arquivo PDF.");
      return;
    }
    setErroPdf(null);
    setLendo(true);
    try {
      const r = await extrairTextoPdf(arquivo);
      setPdf({ ...r, nome: arquivo.name });
      if (!r.escaneado) {
        const e = extrairDados(r.texto, cargoAlvo);
        setExtracao(e);
        setDados((d) => dadosDaExtracao(e, d));
      } else {
        setExtracao(null);
      }
    } catch (e) {
      setPdf(null);
      setErroPdf(`Não foi possível ler o PDF: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLendo(false);
    }
  }

  /** Ao trocar o cargo, refaz só os campos que dependem dele. */
  function reprocessarCargo() {
    if (!pdf || pdf.escaneado) return;
    const e = extrairDados(pdf.texto, cargoAlvo);
    setExtracao(e);
    set({
      carga: e.carga_horaria[0]?.valor.toString() ?? dados.carga,
      salario: e.salario[0] ? numeroParaInput(e.salario[0].valor) : dados.salario,
    });
  }

  const textoPrompt =
    pdf && !pdf.escaneado
      ? tamanho === "completo"
        ? pdf.texto
        : recortarTexto(pdf.texto, cargoAlvo, tamanho)
      : null;
  const mensagens = !pdf
    ? []
    : emPartes && textoPrompt
      ? gerarPartes(cargoAlvo, textoPrompt)
      : [gerarPrompt(cargoAlvo, textoPrompt)];
  const textoLongo = !!pdf && !pdf.escaneado && pdf.texto.length > TAMANHOS_RECORTE[0].valor;

  async function copiar(i: number) {
    try {
      await navigator.clipboard.writeText(mensagens[i]);
    } catch {
      const ta = document.getElementById(`prompt-${i}`) as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopiados((c) => new Set(c).add(i));
  }

  function validarResposta() {
    const r = interpretarRespostaIA(resposta);
    setResultado(r);
    if (!r.ok) return;
    const comId = r.dados.cargos.map((c) => ({ ...c, id: crypto.randomUUID() }));
    setCargosJson(comId);
    setSelecionados(new Set(comId.map((c) => c.id)));
    // Matérias vão para o cargo que bate com o "cargo de interesse".
    const alvo = cargoAlvo.trim().toLocaleLowerCase("pt-BR");
    const match =
      comId.find((c) => c.nome.toLocaleLowerCase("pt-BR") === alvo) ??
      comId.find((c) => alvo && c.nome.toLocaleLowerCase("pt-BR").includes(alvo));
    setCargoMaterias(match?.id ?? comId[0]?.id ?? "");
  }

  const jsonOk = resultado?.ok ? resultado.dados : null;
  const materias = jsonOk?.materias ?? [];
  const cargosEscolhidos = cargosJson.filter((c) => selecionados.has(c.id));

  function montarPayload() {
    const taxa = parseNumeroBR(dados.taxa);
    let cargos;
    let cargoMateriasId: string | null = null;

    if (jsonOk) {
      const principalId = selecionados.has(cargoMaterias) ? cargoMaterias : cargosEscolhidos[0]?.id;
      cargos = cargosEscolhidos.map((c) => ({
        id: c.id,
        nome: c.nome,
        vagas: c.vagas,
        cadastro_reserva: c.cadastro_reserva,
        carga_horaria_semanal: c.carga_horaria,
        salario: c.salario,
        taxa_inscricao: taxa,
        requisitos: c.requisitos,
        principal: c.id === principalId,
      }));
      cargoMateriasId = selecionados.has(cargoMaterias) ? cargoMaterias : null;
    } else {
      const id = crypto.randomUUID();
      cargos = cargoAlvo.trim()
        ? [
            {
              id,
              nome: cargoAlvo.trim(),
              vagas: dados.vagas.trim() === "" ? 0 : Number(dados.vagas),
              cadastro_reserva: false,
              carga_horaria_semanal: dados.carga.trim() === "" ? null : Number(dados.carga),
              salario: parseNumeroBR(dados.salario),
              taxa_inscricao: taxa,
              requisitos: null,
              principal: true,
            },
          ]
        : [];
      cargoMateriasId = cargos.length ? id : null;
    }

    return {
      destino:
        destino === "novo"
          ? {
              tipo: "novo" as const,
              concurso: {
                municipio: dados.municipio,
                uf: dados.uf,
                orgao: textoOuNull(dados.orgao),
                banca: textoOuNull(dados.banca),
                edital_url: textoOuNull(dados.edital_url),
                status: dados.status,
                inscricao_fim: dados.inscricao_fim || null,
                prova_data: dados.prova_data || null,
                observacoes: null,
              },
            }
          : { tipo: "existente" as const, concurso_id: concursoDestino },
      cargos,
      materias,
      cargo_materias_id: cargoMateriasId,
    };
  }

  function salvar() {
    const payload = montarPayload();
    const parsed = importacaoSalvarSchema.safeParse(payload);
    if (!parsed.success) {
      setErros(errosPorCampo(parsed.error));
      setMensagem("Confira os campos destacados.");
      return;
    }
    if (!payload.cargos.length && !payload.materias.length && destino === "existente") {
      setMensagem("Nada para adicionar: valide um JSON ou informe o cargo.");
      return;
    }
    setErros({});
    setMensagem(null);
    startTransition(async () => {
      const r = await salvarImportacao(payload);
      if (r) {
        setErros(r.erros);
        setMensagem(r.mensagem);
      }
    });
  }

  const err = (campo: string) => erros[`destino.concurso.${campo}`] ?? erros[campo];
  const totalTopicos = materias.reduce((s, m) => s + m.topicos.length, 0);

  return (
    <div className="space-y-10">
      {/* 1 ─ Arquivo */}
      <Secao numero={1} titulo="Edital" descricao="PDF do edital e o cargo que você vai prestar.">
        <label
          className="flex cursor-pointer flex-col items-center gap-2 border border-dashed border-pauta px-4 py-8 text-center transition-colors hover:border-tinta-2 hover:bg-papel-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            escolherArquivo(e.dataTransfer.files[0]);
          }}
        >
          {lendo ? (
            <Girando size={22} />
          ) : (
            <FileText size={22} strokeWidth={1.25} className="text-tinta-2" />
          )}
          <span className="text-sm">
            {lendo ? "Lendo o PDF…" : pdf ? "Trocar arquivo" : "Escolher PDF ou arrastar aqui"}
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={lendo}
            onChange={(e) => escolherArquivo(e.target.files?.[0])}
          />
        </label>

        {erroPdf && <p className="surgir text-sm text-acento">{erroPdf}</p>}

        {pdf && (
          <p className="text-sm text-tinta-2">
            <span className="text-tinta">{pdf.nome}</span> ·{" "}
            <span className="num">{pdf.paginas}</span> pág. ·{" "}
            <span className="num">{pdf.texto.length.toLocaleString("pt-BR")}</span> caracteres
          </p>
        )}

        {pdf?.escaneado && (
          <div className="flex gap-3 border-l-2 border-acento py-1 pl-3 text-sm">
            <TriangleAlert size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-acento" />
            <p>
              <strong className="font-medium">Este PDF não tem texto</strong> (provavelmente é
              escaneado). A extração automática foi pulada: preencha os dados à mão e use o prompt
              do passo 3 anexando o PDF no chat.
            </p>
          </div>
        )}

        <Campo rotulo="Cargo de interesse" dica="usado para achar salário e o conteúdo programático">
          <input
            className="campo"
            placeholder="Médico Veterinário"
            value={cargoAlvo}
            onChange={(e) => setCargoAlvo(e.target.value)}
            onBlur={reprocessarCargo}
          />
        </Campo>
      </Secao>

      {pdf && (
        <>
          {/* 2 ─ Conferência */}
          <Secao
            numero={2}
            titulo="Conferir"
            descricao="Sugestões encontradas no texto. Clique numa alternativa para trocar; passe o mouse para ver o trecho."
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
              <Campo rotulo="Município" erro={err("municipio")}>
                <input className="campo" value={dados.municipio} onChange={(e) => set({ municipio: e.target.value })} />
                <Alternativas lista={extracao?.municipio} atual={dados.municipio} onEscolher={(v) => set({ municipio: v })} />
              </Campo>
              <Campo rotulo="UF" erro={err("uf")}>
                <select className="campo" value={dados.uf} onChange={(e) => set({ uf: e.target.value })}>
                  <option value="">—</option>
                  {UFS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
                <Alternativas lista={extracao?.uf} atual={dados.uf} onEscolher={(v) => set({ uf: v })} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Órgão" erro={err("orgao")}>
                <input className="campo" value={dados.orgao} onChange={(e) => set({ orgao: e.target.value })} />
                <Alternativas lista={extracao?.orgao} atual={dados.orgao} onEscolher={(v) => set({ orgao: v })} />
              </Campo>
              <Campo rotulo="Banca" erro={err("banca")}>
                <input className="campo" value={dados.banca} onChange={(e) => set({ banca: e.target.value })} />
                <Alternativas lista={extracao?.banca} atual={dados.banca} onEscolher={(v) => set({ banca: v })} />
              </Campo>
              <Campo rotulo="Prazo para inscrição" erro={err("inscricao_fim")}>
                <input
                  className="campo num"
                  type="date"
                  value={dados.inscricao_fim}
                  onChange={(e) => set({ inscricao_fim: e.target.value })}
                />
                <Alternativas
                  lista={extracao?.inscricao_fim}
                  atual={dados.inscricao_fim}
                  rotulo={fmtData}
                  onEscolher={(v) => set({ inscricao_fim: v })}
                />
              </Campo>
              <Campo rotulo="Data da prova" erro={err("prova_data")}>
                <input
                  className="campo num"
                  type="date"
                  value={dados.prova_data}
                  onChange={(e) => set({ prova_data: e.target.value })}
                />
                <Alternativas
                  lista={extracao?.prova_data}
                  atual={dados.prova_data}
                  rotulo={fmtData}
                  onEscolher={(v) => set({ prova_data: v })}
                />
              </Campo>
              <Campo rotulo="Status" erro={err("status")}>
                <select
                  className="campo"
                  value={dados.status}
                  onChange={(e) => set({ status: e.target.value as ConcursoStatus })}
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_ROTULO[s]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Link do edital" erro={err("edital_url")}>
                <input
                  className="campo"
                  type="url"
                  placeholder="https://"
                  value={dados.edital_url}
                  onChange={(e) => set({ edital_url: e.target.value })}
                />
              </Campo>
            </div>

            <div className="border-t border-pauta pt-4">
              <p className="rotulo mb-3">
                Cargo {cargoAlvo ? `“${cargoAlvo}”` : "de interesse"} — usado se você não colar o JSON
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Campo rotulo="Vagas">
                  <input
                    className="campo num text-right"
                    inputMode="numeric"
                    value={dados.vagas}
                    onChange={(e) => set({ vagas: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Horas/sem.">
                  <input
                    className="campo num text-right"
                    inputMode="numeric"
                    value={dados.carga}
                    onChange={(e) => set({ carga: e.target.value })}
                  />
                  <Alternativas
                    lista={extracao?.carga_horaria}
                    atual={Number(dados.carga)}
                    rotulo={(v) => `${v}h`}
                    onEscolher={(v) => set({ carga: String(v) })}
                  />
                </Campo>
                <Campo rotulo="Salário (R$)">
                  <input
                    className="campo num text-right"
                    inputMode="decimal"
                    value={dados.salario}
                    onChange={(e) => set({ salario: e.target.value })}
                  />
                  <Alternativas
                    lista={extracao?.salario}
                    atual={parseNumeroBR(dados.salario)}
                    rotulo={moeda}
                    onEscolher={(v) => set({ salario: numeroParaInput(v) })}
                  />
                </Campo>
                <Campo rotulo="Taxa (R$)" dica="vale para todos">
                  <input
                    className="campo num text-right"
                    inputMode="decimal"
                    value={dados.taxa}
                    onChange={(e) => set({ taxa: e.target.value })}
                  />
                  <Alternativas
                    lista={extracao?.taxa}
                    atual={parseNumeroBR(dados.taxa)}
                    rotulo={moeda}
                    onEscolher={(v) => set({ taxa: numeroParaInput(v) })}
                  />
                </Campo>
              </div>
            </div>
          </Secao>

          {/* 3 ─ Prompt */}
          <Secao
            numero={3}
            titulo="Prompt"
            descricao="Cole no chat gratuito. Ele devolve o cargo e o conteúdo programático em JSON."
          >
            {!cargoAlvo.trim() && (
              <p className="text-sm text-acento">Informe o cargo de interesse no passo 1.</p>
            )}
            {!pdf.escaneado && (
              <p className="text-sm text-tinta-2">
                O texto do edital já vai dentro do prompt — <strong className="font-medium text-tinta">não anexe o PDF</strong>.
              </p>
            )}

            {textoLongo && (
              <div className="space-y-2 border-y border-pauta py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="rotulo">Trecho do edital</span>
                  {[...TAMANHOS_RECORTE, { valor: "completo" as const, rotulo: "Completo" }].map((t) => (
                    <label key={t.rotulo} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        className="accent-[var(--tinta)]"
                        checked={tamanho === t.valor}
                        onChange={() => {
                          setTamanho(t.valor);
                          setCopiados(new Set());
                        }}
                      />
                      {t.rotulo}
                      <span className="num text-xs text-tinta-2">
                        {Math.round((t.valor === "completo" ? pdf.texto.length : Math.min(t.valor, pdf.texto.length)) / 1000)}k
                      </span>
                    </label>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-[var(--tinta)]"
                    checked={emPartes}
                    onChange={(e) => {
                      setEmPartes(e.target.checked);
                      setCopiados(new Set());
                    }}
                  />
                  Enviar em várias mensagens
                  <span className="text-tinta-2">(use se o chat disser que a mensagem é longa demais)</span>
                </label>
              </div>
            )}

            {mensagens.length === 1 ? (
              <>
                <textarea
                  id="prompt-0"
                  readOnly
                  value={mensagens[0]}
                  rows={8}
                  className="campo num w-full resize-y text-xs leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <BotaoCopiar copiado={copiados.has(0)} onClick={() => copiar(0)} />
                  <span className="num text-xs text-tinta-2">
                    {mensagens[0].length.toLocaleString("pt-BR")} caracteres
                  </span>
                </div>
              </>
            ) : (
              <ol className="border-t border-pauta">
                {mensagens.map((m, i) => (
                  <li key={i} className="flex items-center gap-3 border-b border-pauta py-2 text-sm">
                    <span className="num w-12 shrink-0 text-xs text-tinta-2">
                      {i + 1}/{mensagens.length}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-tinta-2">
                      {i === 0 ? "Regras e formato do JSON" : m.split("\n")[0]}
                    </span>
                    <span className="num hidden text-xs text-tinta-2 sm:inline">
                      {m.length.toLocaleString("pt-BR")}
                    </span>
                    <textarea id={`prompt-${i}`} readOnly value={m} className="sr-only" tabIndex={-1} />
                    <BotaoCopiar copiado={copiados.has(i)} onClick={() => copiar(i)} pequeno />
                  </li>
                ))}
              </ol>
            )}

            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="botao-texto">
                abrir ChatGPT
              </a>
              <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className="botao-texto">
                abrir Claude
              </a>
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="botao-texto">
                abrir Gemini
              </a>
              <span className="text-xs text-tinta-2">O Gemini gratuito aceita textos bem maiores.</span>
            </p>
          </Secao>
        </>
      )}

      {pdf && (
        <>
          {/* 4 ─ Resposta */}
          <Secao
            numero={4}
            titulo="Resposta"
            descricao="Cole aqui o que o chat respondeu. Opcional: sem JSON, salva só o cargo do passo 2."
          >
            <textarea
              value={resposta}
              onChange={(e) => {
                setResposta(e.target.value);
                setResultado(null);
              }}
              rows={6}
              placeholder='{ "cargos": [...], "materias": [...] }'
              className="campo num w-full resize-y text-xs"
            />
            <button type="button" className="botao" onClick={validarResposta}>
              Validar e pré-visualizar
            </button>

            {resultado && !resultado.ok && (
              <div className="surgir border-l-2 border-acento pl-3 text-sm text-acento">
                <p className="font-medium">A resposta não passou na validação:</p>
                <ul className="num mt-1 list-disc space-y-0.5 pl-5 text-xs">
                  {resultado.erros.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {jsonOk && (
              <Previa
                cargos={cargosJson}
                materias={materias}
                selecionados={selecionados}
                onAlternar={(id) =>
                  setSelecionados((s) => {
                    const n = new Set(s);
                    if (n.has(id)) n.delete(id);
                    else n.add(id);
                    return n;
                  })
                }
                cargoMaterias={cargoMaterias}
                onCargoMaterias={setCargoMaterias}
              />
            )}
          </Secao>

          {/* 5 ─ Salvar */}
          <Secao numero={5} titulo="Salvar">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-[var(--tinta)]"
                  checked={destino === "novo"}
                  onChange={() => setDestino("novo")}
                />
                Criar concurso novo com os dados do passo 2
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-[var(--tinta)]"
                  checked={destino === "existente"}
                  onChange={() => setDestino("existente")}
                  disabled={!concursos.length}
                />
                Adicionar a um concurso existente
              </label>
            </div>
            {destino === "existente" && (
              <Campo rotulo="Concurso" erro={erros["destino.concurso_id"] && "Escolha o concurso"}>
                <select
                  className="campo"
                  value={concursoDestino}
                  onChange={(e) => setConcursoDestino(e.target.value)}
                >
                  <option value="">—</option>
                  {concursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.municipio} – {c.uf}
                      {c.orgao ? ` · ${c.orgao}` : ""}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <p className="text-sm text-tinta-2">
              {destino === "novo" ? "Vai criar 1 concurso" : "Vai adicionar"}
              {" · "}
              <span className="num">{jsonOk ? cargosEscolhidos.length : cargoAlvo.trim() ? 1 : 0}</span> cargo(s)
              {" · "}
              <span className="num">{materias.length}</span> matéria(s)
              {" · "}
              <span className="num">{totalTopicos}</span> tópico(s)
              {destino === "existente" && " — cargos e matérias com mesmo nome são mesclados."}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="botao botao-primario"
                onClick={salvar}
                disabled={pending}
                aria-busy={pending}
              >
                <Girando ativo={pending} />
                {pending ? "Salvando…" : "Salvar importação"}
              </button>
              <p aria-live="polite" className="text-sm text-acento">
                {mensagem}
              </p>
            </div>
            {Object.keys(erros).some((k) => k.startsWith("cargos")) && (
              <ul className="list-disc pl-5 text-xs text-acento">
                {Object.entries(erros)
                  .filter(([k]) => k.startsWith("cargos"))
                  .map(([k, v]) => (
                    <li key={k}>
                      <span className="num">{k}</span>: {v}
                    </li>
                  ))}
              </ul>
            )}
          </Secao>
        </>
      )}
    </div>
  );
}

function BotaoCopiar({
  copiado,
  onClick,
  pequeno = false,
}: {
  copiado: boolean;
  onClick: () => void;
  pequeno?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`botao ${copiado ? "" : "botao-primario"} ${pequeno ? "px-2 py-0.5 text-xs" : ""}`}
    >
      {copiado ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.5} />}
      {copiado ? "Copiado" : pequeno ? "Copiar" : "Copiar prompt"}
    </button>
  );
}

function Alternativas<T extends string | number>({
  lista,
  atual,
  rotulo = (v) => String(v),
  onEscolher,
}: {
  lista: Candidato<T>[] | undefined;
  atual: T | number | null;
  rotulo?: (v: T) => string;
  onEscolher: (v: T) => void;
}) {
  if (!lista?.length) return null;
  const selecionado = lista.find((c) => c.valor === atual);
  return (
    <span className="mt-1.5 block">
      {lista.length > 1 && (
        <span className="flex flex-wrap gap-1.5">
          {lista.map((c) => (
            <button
              key={String(c.valor)}
              type="button"
              title={c.trecho}
              onClick={() => onEscolher(c.valor)}
              className={`num border px-1.5 py-px text-[11px] transition-colors ${
                c.valor === atual
                  ? "border-tinta text-tinta"
                  : "border-pauta text-tinta-2 hover:border-tinta-2 hover:text-tinta"
              }`}
            >
              {rotulo(c.valor)}
            </button>
          ))}
        </span>
      )}
      {selecionado && (
        <span className="mt-1 block truncate text-[11px] text-tinta-2 italic" title={selecionado.trecho}>
          {selecionado.trecho}
        </span>
      )}
    </span>
  );
}

function Previa({
  cargos,
  materias,
  selecionados,
  onAlternar,
  cargoMaterias,
  onCargoMaterias,
}: {
  cargos: CargoJson[];
  materias: ImportacaoJson["materias"];
  selecionados: Set<string>;
  onAlternar: (id: string) => void;
  cargoMaterias: string;
  onCargoMaterias: (id: string) => void;
}) {
  return (
    <div className="space-y-6 border-t border-pauta pt-4">
      <div>
        <h3 className="mb-2 font-serif text-base">
          Cargos <span className="num text-sm text-tinta-2">({cargos.length})</span>
        </h3>
        {cargos.length === 0 ? (
          <p className="text-sm text-tinta-2">Nenhum cargo no JSON.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-pauta bg-papel-2 text-left">
                  <th className="w-8 px-2 py-1.5" />
                  <th className="rotulo px-2 py-1.5 font-normal">Cargo</th>
                  <th className="rotulo px-2 py-1.5 text-right font-normal">Vagas</th>
                  <th className="rotulo px-2 py-1.5 text-right font-normal">Horas/Salário</th>
                  <th className="rotulo px-2 py-1.5 font-normal">Requisitos</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-pauta align-top ${selecionados.has(c.id) ? "" : "text-tinta-2 line-through decoration-pauta"}`}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Importar ${c.nome}`}
                        className="accent-[var(--tinta)]"
                        checked={selecionados.has(c.id)}
                        onChange={() => onAlternar(c.id)}
                      />
                    </td>
                    <td className="px-2 py-1.5">{c.nome}</td>
                    <td className="num px-2 py-1.5 text-right">{vagasTexto(c)}</td>
                    <td className="num px-2 py-1.5 text-right whitespace-nowrap">
                      {horasSalario({ carga_horaria_semanal: c.carga_horaria, salario: c.salario })}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-tinta-2">{c.requisitos ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h3 className="font-serif text-base">
            Matérias <span className="num text-sm text-tinta-2">({materias.length})</span>
          </h3>
          {materias.length > 0 && cargos.length > 0 && (
            <label className="flex items-baseline gap-2 text-sm">
              <span className="rotulo">do cargo</span>
              <select
                className="campo w-auto py-0.5 text-sm"
                value={cargoMaterias}
                onChange={(e) => onCargoMaterias(e.target.value)}
              >
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {materias.length === 0 ? (
          <p className="text-sm text-tinta-2">Nenhuma matéria no JSON.</p>
        ) : (
          <ul className="border-t border-pauta">
            {materias.map((m, i) => (
              <li key={`${m.nome}-${i}`} className="border-b border-pauta">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-baseline gap-3 py-1.5 text-sm hover:bg-papel-2">
                    <span className="text-tinta-2 transition-transform group-open:rotate-90">›</span>
                    <span className="flex-1">{m.nome}</span>
                    <span className="num text-xs text-tinta-2">{m.topicos.length} tópicos</span>
                  </summary>
                  <ol className="mb-2 ml-6 list-decimal space-y-0.5 pl-4 text-xs text-tinta-2 marker:font-mono">
                    {m.topicos.map((t, j) => (
                      <li key={j}>{t}</li>
                    ))}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
