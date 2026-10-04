import type { Cargo } from "@/types/database";

const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const kmFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "R$ 8.500,00" (com espaço comum, não o NBSP do Intl). */
export function moeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return moedaFmt.format(valor).replace(/\xa0/g, " ");
}

/** Hoje em America/Sao_Paulo como "AAAA-MM-DD". */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "2026-10-03" -> "03/10/2026". */
export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function diaUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

/** Dias de `hoje` até `alvo` (negativo = passou). */
export function diasAte(alvo: string, hoje: string): number {
  return diaUTC(alvo) - diaUTC(hoje);
}

export type Prazo = { texto: string; urgente: boolean; passou: boolean } | null;

/** Contagem para prazo de inscrição. Urgente = vence em até 7 dias. */
export function contagemPrazo(alvo: string | null, hoje: string): Prazo {
  if (!alvo) return null;
  const d = diasAte(alvo, hoje);
  if (d < 0) {
    return { texto: d === -1 ? "encerrou ontem" : `encerrou há ${-d} dias`, urgente: false, passou: true };
  }
  if (d === 0) return { texto: "último dia", urgente: true, passou: false };
  if (d === 1) return { texto: "falta 1 dia", urgente: true, passou: false };
  return { texto: `faltam ${d} dias`, urgente: d <= 7, passou: false };
}

/** Contagem neutra para a data da prova. */
export function contagemProva(alvo: string | null, hoje: string): string | null {
  if (!alvo) return null;
  const d = diasAte(alvo, hoje);
  if (d < 0) return "realizada";
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

export function km(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return `${kmFmt.format(valor)} km`;
}

/** 250 -> "4h10". */
export function duracao(min: number | null | undefined): string {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

/** Cargo marcado como principal, senão o primeiro pela ordem. */
export function cargoPrincipal(cargos: Cargo[]): Cargo | undefined {
  return cargos.find((c) => c.principal) ?? [...cargos].sort((a, b) => a.ordem - b.ordem)[0];
}

/** "1 + CR", "CR", "3", "0". */
export function vagasTexto(c: Pick<Cargo, "vagas" | "cadastro_reserva">): string {
  const partes: string[] = [];
  if (c.vagas > 0) partes.push(String(c.vagas));
  if (c.cadastro_reserva) partes.push("CR");
  return partes.join(" + ") || "0";
}

/** "40h · R$ 8.500,00". */
export function horasSalario(c: Pick<Cargo, "carga_horaria_semanal" | "salario"> | undefined): string {
  if (!c) return "—";
  const h = c.carga_horaria_semanal ? `${c.carga_horaria_semanal}h` : "—";
  return `${h} · ${moeda(c.salario)}`;
}

/** Aceita "8.500,00", "8500,5", "8500.50", "R$ 8.500". Vazio -> null; inválido -> NaN. */
export function parseNumeroBR(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

/** 8500 -> "8.500,00" (para preencher input). */
export function numeroParaInput(valor: number | null | undefined): string {
  if (valor == null) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Mesma regra de public.normaliza_nome (SQL): minúsculas, sem acento, só [a-z0-9 ]. */
export function normalizaNome(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
