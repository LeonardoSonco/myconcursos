# Design — "fichário de concurseiro"

Papelaria + planilha bem feita. Denso, alinhado, sóbrio, com um único acento forte.

## Proibido

Gradiente roxo/azul · glassmorphism · emoji como ícone · sombra grande em tudo · hero centralizado · fonte Inter · cantos muito arredondados (máx. `rounded-sm` = 2px; carimbos e inputs até 3px) · animações chamativas · cards soltos para dados tabulares no desktop.

## Cores (tokens em `globals.css`, expostos ao Tailwind)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--papel` | `#F5F0E6` | `#1D1B17` | fundo da página |
| `--papel-2` | `#EDE6D8` | `#25221D` | linhas zebradas, cabeçalho da tabela, inputs |
| `--tinta` | `#1A2233` | `#E6DFD0` | texto principal (azul-escuro quase preto / papel claro) |
| `--tinta-2` | `#4A5263` | `#A9A294` | texto secundário, rótulos |
| `--pauta` | `#D8CEBB` | `#3A362F` | linhas finas, bordas |
| `--margem` | `#E4A6A0` | `#6B3A35` | linha vertical de "margem de caderno" (detalhe, uso mínimo) |
| `--acento` | `#C42B1C` | `#E5604F` | **só** prazos urgentes e erros |

Escuro = papel escuro quente, nunca `#000`. Respeitar `prefers-color-scheme` + alternância manual (`data-theme` no `<html>`).

### Carimbos de status

Texto caixa alta, `letter-spacing: .08em`, borda 1.5px, `rotate(-2deg)` (alternar levemente por linha: -2°, -1°, 1°), fundo transparente, cor da borda = cor do texto.

| Status | Claro | Escuro |
|---|---|---|
| Previsto | `#8A5A12` | `#D4A55A` |
| Edital publicado | `#2B4C7E` | `#7FA2D6` |
| Inscrições abertas | `#2F6B3A` | `#7FC08A` |
| Inscrições encerradas | `#6B6F78` | `#9A9EA6` |
| Prova realizada | `#5B4636` | `#B89A80` |
| Resultado | `#1A2233` | `#E6DFD0` (borda dupla) |

## Tipografia (via `next/font/google`)

| Papel | Fonte | Uso |
|---|---|---|
| Títulos | **Fraunces** (serifada, eixo `SOFT`/`opsz`) | h1–h3, nome do app, títulos de seção |
| Corpo | **IBM Plex Sans** | texto, tabela, formulários |
| Números | **IBM Plex Mono** + `tabular-nums` | salários, datas, distâncias, contagens, vagas |

Escala compacta: corpo 14px na tabela, 15px em formulários; títulos 28/22/18px. Números alinhados à direita nas colunas.

## Componentes-chave

- **Tabela**: linhas de 1px `--pauta`, sem bordas verticais exceto após "Lugar"; cabeçalho `--papel-2` em caixa alta pequena (11px, `--tinta-2`), fixo no scroll; hover da linha só muda o fundo para `--papel-2`. Altura de linha ~36px. A linha inteira abre o concurso (Ctrl/clique do meio = nova aba); links e botões dentro dela mantêm o próprio comportamento.
- **Prazo**: data em mono + linha abaixo com contagem ("faltam 5 dias"). ≤ 7 dias: texto `--acento` e sublinhado ondulado discreto; encerrado: `--tinta-2` riscado.
- **Vagas**: `Cargo: 1 + CR`; `+2 cargos` como botão-texto que expande sub-linhas indentadas.
- **Card mobile** (< 768px): ficha com borda `--pauta`, sem sombra; título serifado, carimbo no canto, números em grade 2 colunas; botão "Ver detalhes" na largura toda ao pé da ficha.
- **Botões**: retangulares, borda 1px `--tinta`, fundo transparente; primário preenchido `--tinta` com texto `--papel`. Sem gradiente.
- **Inputs**: fundo `--papel-2`, borda inferior 1px (estilo linha de formulário), foco com borda `--tinta` 2px.
- **Barra de progresso**: trilho fino (4px) `--pauta`, preenchimento `--tinta`; porcentagem em mono ao lado.
- **Ícones**: SVG de traço fino (ex.: lucide em `strokeWidth={1.5}`), usados com parcimônia.

## Movimento

Transições de 120–180ms em cor/opacidade/altura (expandir cargos). Marcar tópico: risco suave no texto. Nada de bounce, parallax ou skeleton chamativo. Respeitar `prefers-reduced-motion`.

Implementação (classes em `globals.css`):

- **Navegação**: usar `Link` de `@/components/ui/link` (não `next/link` direto) — mostra uma barra de 2px `--tinta` fixa no topo enquanto a rota não troca (`useLinkStatus`).
- **Carregamento de rota**: `(app)/loading.tsx` = folha pautada em branco, que só aparece após ~200ms (`.carregando-atraso`). `(app)/template.tsx` aplica `.entrar` (fade + 3px, 180ms) a cada página.
- **Botões que esperam o servidor**: `<Girando ativo={pending} />` + `aria-busy` + texto no gerúndio ("Salvando…"). `.botao` afunda 1px no `:active`.
- **Blocos que aparecem** (mensagens, formulários abertos, sub-linhas): `.surgir` (só opacidade) ou `.entrar`.
- **Tópico estudado**: `.risco[data-feito]` desenha o risco da esquerda para a direita.
- **Barra de progresso**: enche a partir de zero ao montar (`.preenchimento`).
