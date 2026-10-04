/** Remonta a cada navegação: entrada curta da página (DESIGN.md › Movimento). */
export default function Template({ children }: LayoutProps<"/">) {
  return <div className="entrar">{children}</div>;
}
