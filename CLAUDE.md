# myconcursos — guia para o assistente

Sistema web pessoal (2 usuários) para organizar concursos públicos: cadastro de concursos e cargos, distâncias de carro até cidades base, importação de edital (PDF) sem IA paga e checklist de estudo.

**Antes de qualquer mudança, leia os documentos relevantes em `docs/`.** Eles são a fonte de verdade; se uma decisão nova contrariar algo lá, atualize o documento no mesmo trabalho.

| Documento | Quando ler |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Requisitos funcionais, campos, regras de negócio |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, estrutura de pastas, fluxo de dados, decisões |
| [docs/DATABASE.md](docs/DATABASE.md) | Tabelas, RLS, views, como criar migrations |
| [docs/DESIGN.md](docs/DESIGN.md) | Identidade visual "fichário de concurseiro", tokens, componentes |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Nominatim, OSRM/ORS, pdf.js, prompt para LLM gratuito |
| [docs/SETUP.md](docs/SETUP.md) | Variáveis de ambiente, Supabase, Vercel |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Etapas, status atual e próximos passos |

## Regras inegociáveis

1. **Custo zero.** Só serviços com free tier sem cartão obrigatório. Nada de API paga (inclusive IA). Se uma ideia exigir serviço pago, pare e pergunte.
2. **Trabalho em etapas.** Concluir uma etapa do ROADMAP, mostrar ao usuário e esperar aprovação antes da próxima. Atualizar o status no ROADMAP.
3. **Segurança via RLS.** Todo acesso a dados passa pelo Supabase com a sessão do usuário (chave pública + RLS). Não usar `service_role` no app. Toda tabela nova precisa de RLS e policy (ver DATABASE.md).
4. **Distâncias são cache.** Calcular só ao salvar/editar o lugar (ou cidade base). Nunca no carregamento de página.
5. **Validação com Zod** em toda entrada (formulários, JSON colado, respostas de APIs externas).
6. **Design não-genérico.** Seguir DESIGN.md à risca. Proibido: gradiente roxo/azul, glassmorphism, emoji como ícone, sombras grandes, hero centralizado, fonte Inter, cantos muito arredondados.
7. **Idioma.** Interface, nomes de tabelas/colunas e docs em português. Código (variáveis, funções) pode misturar quando o termo de domínio for português (`concurso`, `cargo`, `materia`).

## Comandos

```bash
npm run dev        # desenvolvimento (http://localhost:3000)
npm run build      # build de produção
npm run lint       # ESLint (inclui regras do React Compiler)
npm run typecheck  # next typegen + tsc --noEmit
```

Antes de entregar qualquer etapa: `npm run lint && npm run typecheck && npm run build` sem erros.

**O assistente nunca inicia o servidor** (`npm run dev`, `next dev`, `next start`), nem em segundo plano — quem roda é o usuário. Bloqueado em `.claude/settings.json`. Para testar em execução, pedir ao usuário e ler `.next/dev/logs/next-development.log` se necessário.

## Next.js 16

Versão com mudanças em relação ao que costuma estar no treinamento: `middleware.ts` virou `src/proxy.ts`, `params`/`searchParams` são Promises, `PageProps<'/rota'>`/`LayoutProps` são globais. Consultar `node_modules/next/dist/docs/` antes de usar APIs do Next.

@AGENTS.md
