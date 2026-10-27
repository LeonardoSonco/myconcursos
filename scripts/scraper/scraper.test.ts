// npm run test:scraper — parsers contra trechos reais das páginas (fixtures/).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseCnb } from "./fontes/cnb";
import { parsePci } from "./fontes/pci";
import { dataBR, deduplicar, extrairCidade, salarioMax, vagas } from "./texto";
import { validar } from "./tipos";
import { agruparFontes, chaveOrgao } from "../../src/lib/oportunidades";

const fixture = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), "utf8");
const HOJE = new Date("2026-10-27T12:00:00Z");

test("valores, vagas e datas", () => {
  assert.equal(salarioMax("348 vagas até R$ 14.117,18"), 14117.18);
  assert.equal(salarioMax("salário de R$ 9,5 mil e bolsa de R$ 1.200"), 9500);
  assert.equal(salarioMax("sem salário"), null);
  assert.equal(vagas("348 vagas até R$ 14.117,18"), 348);
  assert.equal(vagas("3.360"), 3360);
  assert.equal(vagas("1 vaga"), 1);
  assert.equal(vagas("Várias"), null);
  assert.equal(vagas("Cadastro de reserva até R$ 6.749,53"), null);
  assert.equal(dataBR("até 05/11/2026"), "2026-11-05");
  assert.equal(dataBR("31/02/2026"), null);
});

test("cidade só de órgão municipal", () => {
  assert.deepEqual(extrairCidade("Câmara de Jundiaí do Sul - PR abre processo"), {
    cidade: "Jundiaí do Sul",
    uf: "PR",
  });
  assert.deepEqual(extrairCidade("Concurso Prefeitura de Tio Hugo (RS) abre 66 vagas"), {
    cidade: "Tio Hugo",
    uf: "RS",
  });
  assert.deepEqual(extrairCidade("Concurso Câmara de Altamira do Paraná PR abre vagas"), {
    cidade: "Altamira do Paraná",
    uf: "PR",
  });
  assert.deepEqual(extrairCidade("Câmara de Iporã", "PR"), { cidade: "Iporã", uf: "PR" });
  assert.equal(extrairCidade("Hospital de Clínicas de Porto Alegre - RS abre seleções"), null);
  assert.equal(extrairCidade("Autarquia Municipal de Saúde de Cambira (PR) abre vagas"), null);
});

test("PCI: itens abertos com prazo, salário e cidade", () => {
  const { itens, invalidos } = validar(parsePci(fixture("pci.html")));
  assert.equal(invalidos.length, 0);
  assert.equal(itens.length, 5);
  assert.ok(itens.every((i) => i.fonte === "pci" && i.situacao === "aberto"));

  const cantagalo = itens[0];
  assert.equal(cantagalo.orgao, "Câmara de Cantagalo");
  assert.equal(cantagalo.uf, "PR");
  assert.equal(cantagalo.cidade, "Cantagalo");
  assert.equal(cantagalo.vagas, 1);
  assert.equal(cantagalo.salario_max, 9278.5);
  assert.equal(cantagalo.cargos_texto, "Assessor Jurídico");
  assert.equal(cantagalo.inscricao_fim, "2026-10-28");

  const reserva = itens.find((i) => i.cidade === "Francisco Beltrão")!;
  assert.equal(reserva.vagas, null);
  assert.equal(reserva.vagas_texto, "Cadastro de reserva");
  assert.equal(reserva.salario_max, 6749.53);
});

test("CNB: previsto pela marcação, nacional sem UF, antigo descartado", () => {
  const { itens, invalidos } = validar(parseCnb(fixture("cnb-rs.html"), HOJE));
  assert.equal(invalidos.length, 0);
  assert.equal(itens.length, 6); // a notícia de 2024 (aberto, > 12 meses) sai

  const previstos = itens.filter((i) => i.situacao === "previsto").map((i) => i.orgao);
  assert.deepEqual(previstos, ["Brigada Militar RS", "CGU"]);

  const cgu = itens.find((i) => i.orgao === "CGU")!;
  assert.equal(cgu.uf, null);
  assert.equal(cgu.vagas, 60);

  const bage = itens.find((i) => i.orgao === "Câmara de Bagé")!;
  assert.equal(bage.uf, "RS");
  assert.equal(bage.cidade, "Bagé");
  assert.equal(bage.salario_max, 3800);
  assert.equal(bage.publicado_em, "2026-10-09");
});

test("mesmo concurso nas duas fontes vira um grupo (casos reais de 2026-10-27)", () => {
  const op = (fonte: "pci" | "cnb", orgao: string, uf: string | null = "RS") => ({
    fonte,
    orgao,
    uf,
    situacao: "aberto",
    estagio: false,
  });
  const grupos = agruparFontes([
    op("cnb", "Câmara de Ijuí"),
    op("pci", "Câmara de Ijuí"),
    op("pci", "Prefeitura de Ijuí"),
    op("cnb", "Prefeitura Municipal de Ijuí"),
    op("pci", "PREVIJUÍ - Instituto de Previdência dos Servidores Públicos do Município de Ijuí"),
    op("cnb", "PREVIJUÍ"),
    op("pci", "UEL - Universidade Estadual de Londrina", "PR"),
    op("cnb", "UEL", "PR"),
    // vários seletivos do mesmo órgão: não dá para parear, ficam separados
    op("pci", "Prefeitura de Igrejinha"),
    op("pci", "Prefeitura de Igrejinha"),
    op("cnb", "Prefeitura de Igrejinha"),
    // mesma fonte duas vezes também não junta
    op("cnb", "HCPA"),
    op("cnb", "HCPA"),
    // mesmo nome em outro estado
    op("pci", "Prefeitura de Tijucas", "SC"),
    op("cnb", "Prefeitura de Tijucas", "PR"),
  ]);
  const juntos = grupos.filter((g) => g.length === 2);
  assert.deepEqual(
    juntos.map((g) => g.map((o) => o.fonte)),
    [["pci", "cnb"], ["pci", "cnb"], ["pci", "cnb"], ["pci", "cnb"]],
  );
  assert.deepEqual(
    juntos.map((g) => g[1].orgao),
    ["Câmara de Ijuí", "Prefeitura Municipal de Ijuí", "PREVIJUÍ", "UEL"],
  );
  assert.equal(grupos.length, 4 + 3 + 2 + 2);
  assert.notEqual(chaveOrgao(op("pci", "Câmara de Ijuí")), chaveOrgao(op("pci", "Prefeitura de Ijuí")));
});

test("deduplicar mantém a primeira ocorrência", () => {
  const r = deduplicar([
    { url: "a", n: 1 },
    { url: "b", n: 2 },
    { url: "a", n: 3 },
  ]);
  assert.deepEqual(r.map((x) => x.n), [1, 2]);
});
