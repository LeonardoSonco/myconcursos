/** Fallback de rota: folha pautada em branco. Só aparece se a espera passar de ~200ms. */
export default function Carregando() {
  return (
    <div className="carregando-atraso max-w-6xl" role="status" aria-live="polite">
      <p className="rotulo mb-4">Carregando…</p>
      <div className="pauta-pulsando space-y-0 border-t border-pauta" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-9 border-b border-pauta" />
        ))}
      </div>
    </div>
  );
}
