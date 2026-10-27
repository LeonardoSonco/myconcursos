"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Campo } from "@/components/ui/campos";
import { converterEdital, type EditalConvertido } from "@/lib/edital/converter";
import { interpretarRespostaIA } from "@/lib/edital/json";
import { gerarPrompt } from "@/lib/edital/prompt";
import { hojeISO } from "@/lib/format";

const CHATS = [
  { rotulo: "ChatGPT", url: "https://chatgpt.com/" },
  { rotulo: "Gemini", url: "https://gemini.google.com/app" },
  { rotulo: "Claude", url: "https://claude.ai/new" },
];

/**
 * "Preencher com IA": gera o prompt para colar num chat gratuito junto com o PDF
 * do edital e transforma o JSON de volta em campos do formulário. Nada sai do navegador.
 */
export function PainelIA({
  aberto,
  onAplicar,
}: {
  aberto: boolean;
  onAplicar: (dados: EditalConvertido) => string;
}) {
  const [cargo, setCargo] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [resposta, setResposta] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [aplicado, setAplicado] = useState<string | null>(null);

  const prompt = gerarPrompt(cargo);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.getElementById("prompt-ia") as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand("copy");
    }
    setCopiado(true);
  }

  function aplicar() {
    const r = interpretarRespostaIA(resposta);
    if (!r.ok) {
      setErros(r.erros);
      setAplicado(null);
      return;
    }
    setErros([]);
    setAplicado(onAplicar(converterEdital(r.dados, hojeISO())));
  }

  return (
    <details open={aberto} className="group mb-10 border-y border-pauta">
      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-3 hover:bg-papel-2">
        <span className="text-tinta-2 transition-transform group-open:rotate-90">›</span>
        <span className="font-serif text-lg">Preencher com IA</span>
        <span className="text-xs text-tinta-2">
          anexe o PDF do edital num chat gratuito e cole a resposta aqui
        </span>
      </summary>

      <div className="space-y-6 pb-6">
        <ol className="space-y-6">
          <li className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-8">
            <p className="text-sm text-tinta-2">
              <span className="num mr-2 text-margem">01</span>Copie o prompt
            </p>
            <div className="min-w-0 space-y-3">
              <Campo rotulo="Cargo de interesse" dica="o chat traz ele e os cargos correlatos">
                <input
                  className="campo"
                  placeholder="Médico Veterinário"
                  value={cargo}
                  onChange={(e) => {
                    setCargo(e.target.value);
                    setCopiado(false);
                  }}
                />
              </Campo>
              <textarea
                id="prompt-ia"
                readOnly
                value={prompt}
                rows={6}
                className="campo num w-full resize-y text-xs leading-relaxed"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <button
                  type="button"
                  onClick={copiar}
                  disabled={!cargo.trim()}
                  className={`botao ${copiado ? "" : "botao-primario"}`}
                >
                  {copiado ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.5} />}
                  {copiado ? "Copiado" : "Copiar prompt"}
                </button>
                {!cargo.trim() && <span className="text-xs text-tinta-2">Informe o cargo primeiro.</span>}
                {CHATS.map((c) => (
                  <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="botao-texto">
                    abrir {c.rotulo}
                  </a>
                ))}
              </div>
            </div>
          </li>

          <li className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-8">
            <p className="text-sm text-tinta-2">
              <span className="num mr-2 text-margem">02</span>No chat
            </p>
            <p className="text-sm">
              Cole o prompt, <strong className="font-medium">anexe o PDF do edital</strong> na mesma
              mensagem e envie. Edital escaneado (sem texto) também serve. Copie a resposta pelo
              botão <strong className="font-medium">“Copiar código”</strong> do bloco de código (o
              copiar da mensagem também funciona). Se vier cortada, peça “continue o JSON” e junte as
              partes.
            </p>
          </li>

          <li className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-8">
            <p className="text-sm text-tinta-2">
              <span className="num mr-2 text-margem">03</span>Cole a resposta
            </p>
            <div className="min-w-0 space-y-3">
              <textarea
                value={resposta}
                onChange={(e) => {
                  setResposta(e.target.value);
                  setAplicado(null);
                }}
                rows={6}
                placeholder='{ "orgao": "...", "cargos": [ ... ] }'
                className="campo num w-full resize-y text-xs"
              />
              <button type="button" className="botao" onClick={aplicar} disabled={!resposta.trim()}>
                Preencher o formulário
              </button>

              {erros.length > 0 && (
                <div className="surgir border-l-2 border-acento pl-3 text-sm text-acento">
                  <p className="font-medium">A resposta não passou na validação:</p>
                  <ul className="num mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {erros.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aplicado && (
                <p className="surgir border-l-2 border-tinta pl-3 text-sm">
                  {aplicado} Confira os campos abaixo antes de salvar: o chat pode errar.
                </p>
              )}
            </div>
          </li>
        </ol>
      </div>
    </details>
  );
}
