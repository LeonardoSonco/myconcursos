// Scraper de oportunidades: baixa as fontes, normaliza, grava em `oportunidades` e
// geocodifica cidades novas. Roda no GitHub Actions (.github/workflows/scraper.yml).
//
//   npm run scraper            # grava no Supabase (precisa das variáveis abaixo)
//   npm run scraper -- --seco  # só baixa e mostra o resumo, sem banco
//
// Variáveis: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (ou as NEXT_PUBLIC_* do .env),
// ROBO_EMAIL, ROBO_SENHA, NOMINATIM_USER_AGENT, GEOCODIFICAR_MAX (opcional, padrão 150).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { cnbUrl, parseCnb } from "./fontes/cnb";
import { PCI_URL, parsePci } from "./fontes/pci";
import { geocodificar } from "./geo";
import { UFS_SUL, deduplicar } from "./texto";
import { validar, type Item } from "./tipos";

type Db = SupabaseClient<Database>;

const FONTES = [
  { nome: "pci", url: PCI_URL, parse: (html: string) => parsePci(html) },
  ...UFS_SUL.map((uf) => ({
    nome: `cnb/${uf.toLowerCase()}`,
    url: cnbUrl(uf),
    parse: (html: string) => parseCnb(html),
  })),
];

const INTERVALO_SITES_MS = 2000;
const LOTE = 500;
const PAGINA = 1000; // limite padrão de linhas do PostgREST

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chave = (cidade: string, uf: string) => `${cidade}|${uf}`;

function env(...nomes: string[]): string {
  for (const n of nomes) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Falta a variável ${nomes[0]}`);
}

async function baixar(url: string, userAgent: string): Promise<string> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent, "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (tentativa >= 2) throw new Error(`${url}: ${msg(e)}`);
      await dormir(5000);
    }
  }
}

/** Todas as linhas (paginando o limite de 1000 do PostgREST). */
async function lerTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return todas;
  }
}

async function gravar(db: Db, itens: Item[]) {
  const existentes = await lerTudo((de, ate) =>
    db.from("oportunidades").select("url, cidade, uf").order("url").range(de, ate),
  );
  const lugarAntigo = new Map(existentes.map((e) => [e.url, chave(e.cidade ?? "", e.uf ?? "")]));
  const agora = new Date().toISOString();

  // Lugar mudou: zera o cache de coordenadas. Grupos separados porque o upsert
  // do supabase-js usa a união das chaves e preencheria lat/lon com null nos demais.
  const mudou = itens
    .filter((i) => lugarAntigo.has(i.url) && lugarAntigo.get(i.url) !== chave(i.cidade ?? "", i.uf ?? ""))
    .map((i) => ({ ...i, visto_em: agora, lat: null, lon: null, geocodificado_em: null, geocode_erro: null }));
  const mudouUrls = new Set(mudou.map((m) => m.url));
  const resto = itens.filter((i) => !mudouUrls.has(i.url)).map((i) => ({ ...i, visto_em: agora }));

  for (const grupo of [resto, mudou]) {
    for (let i = 0; i < grupo.length; i += LOTE) {
      const { error } = await db
        .from("oportunidades")
        .upsert(grupo.slice(i, i + LOTE), { onConflict: "url" });
      if (error) throw new Error(`Erro ao gravar: ${error.message}`);
    }
  }
  return { novos: itens.filter((i) => !lugarAntigo.has(i.url)).length, lugarMudou: mudou.length };
}

/** Geocodifica cidades pendentes, reaproveitando o que já foi achado para a mesma cidade/UF. */
async function geocodificarPendentes(db: Db, userAgent: string, max: number) {
  const linhas = await lerTudo((de, ate) =>
    db
      .from("oportunidades")
      .select("id, cidade, uf, lat, lon, geocodificado_em, geocode_erro")
      .not("cidade", "is", null)
      .not("uf", "is", null)
      .order("id")
      .range(de, ate),
  );

  type Cache = { lat: number | null; lon: number | null; geocode_erro: string | null };
  const conhecidas = new Map<string, Cache>();
  const pendentes = new Set<string>();
  for (const l of linhas) {
    const k = chave(l.cidade!, l.uf!);
    if (l.geocodificado_em) conhecidas.set(k, { lat: l.lat, lon: l.lon, geocode_erro: l.geocode_erro });
    else pendentes.add(k);
  }

  let consultas = 0;
  let reaproveitadas = 0;
  let falhas = 0;
  for (const k of pendentes) {
    const [cidade, uf] = k.split("|");
    let cache = conhecidas.get(k);
    if (cache) reaproveitadas++;
    else {
      if (consultas >= max) continue;
      consultas++;
      try {
        const g = await geocodificar(userAgent, cidade, uf);
        cache = g
          ? { lat: g.lat, lon: g.lon, geocode_erro: null }
          : { lat: null, lon: null, geocode_erro: `"${cidade} – ${uf}" não encontrado no OpenStreetMap` };
        conhecidas.set(k, cache);
      } catch (e) {
        // Erro de rede/serviço: fica pendente para a próxima execução.
        falhas++;
        console.warn(`  geocodificação falhou (${cidade}/${uf}): ${msg(e)}`);
        continue;
      }
    }
    const { error } = await db
      .from("oportunidades")
      .update({ ...cache, geocodificado_em: new Date().toISOString() })
      .eq("cidade", cidade)
      .eq("uf", uf)
      .is("geocodificado_em", null);
    if (error) throw new Error(`Erro ao gravar coordenadas: ${error.message}`);
  }

  const restantes = [...pendentes].filter((k) => !conhecidas.has(k)).length;
  return { consultas, reaproveitadas, falhas, restantes };
}

async function main() {
  const seco = process.argv.includes("--seco");
  const userAgent = env("SCRAPER_USER_AGENT", "NOMINATIM_USER_AGENT");
  const erros: string[] = [];
  const brutos: Item[] = [];

  for (const [i, fonte] of FONTES.entries()) {
    if (i > 0) await dormir(INTERVALO_SITES_MS);
    try {
      const { itens: validos, invalidos } = validar(fonte.parse(await baixar(fonte.url, userAgent)));
      console.log(`${fonte.nome}: ${validos.length} itens, ${invalidos.length} inválidos`);
      for (const inv of invalidos.slice(0, 5)) console.warn(`  inválido: ${inv}`);
      // Zero itens quase sempre é o HTML do site que mudou: falha para avisar por e-mail.
      if (!validos.length) erros.push(`${fonte.nome}: nenhum item (o layout do site mudou?)`);
      brutos.push(...validos);
    } catch (e) {
      erros.push(`${fonte.nome}: ${msg(e)}`);
    }
  }
  const itens = deduplicar(brutos);

  if (seco) {
    const porSituacao = new Map<string, number>();
    for (const i of itens) {
      const k = `${i.fonte}/${i.situacao}`;
      porSituacao.set(k, (porSituacao.get(k) ?? 0) + 1);
    }
    for (const [k, n] of porSituacao) console.log(`  ${k}: ${n}`);
    console.log(`  com cidade: ${itens.filter((i) => i.cidade).length}`);
  } else if (itens.length) {
    const db = createClient<Database>(
      env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
      env("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: errLogin } = await db.auth.signInWithPassword({
      email: env("ROBO_EMAIL"),
      password: env("ROBO_SENHA"),
    });
    if (errLogin) throw new Error(`Login do robô falhou: ${errLogin.message}`);

    try {
      const g = await gravar(db, itens);
      console.log(`gravados: ${itens.length} (${g.novos} novos, ${g.lugarMudou} com lugar alterado)`);

      const limite = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { count, error: errDel } = await db
        .from("oportunidades")
        .delete({ count: "exact" })
        .is("concurso_id", null)
        .lt("visto_em", limite);
      if (errDel) erros.push(`limpeza: ${errDel.message}`);
      else console.log(`removidos (fora do site há 30+ dias): ${count ?? 0}`);

      const max = Number(process.env.GEOCODIFICAR_MAX) || 150;
      const geo = await geocodificarPendentes(db, userAgent, max);
      console.log(
        `geocodificação: ${geo.consultas} consultas, ${geo.reaproveitadas} reaproveitadas, ` +
          `${geo.falhas} falhas, ${geo.restantes} cidades para a próxima execução`,
      );
    } finally {
      await db.auth.signOut();
    }
  }

  if (erros.length) {
    for (const e of erros) console.error(`ERRO ${e}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`ERRO ${msg(e)}`);
  process.exitCode = 1;
});
