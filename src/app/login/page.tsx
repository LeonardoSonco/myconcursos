import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · my Concursos" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-[14vh]">
      <div className="w-full max-w-sm border-l-2 border-margem pl-6">
        
        <h1 className="font-serif text-4xl leading-none tracking-tight">my Concursos</h1>
        <div className="mt-1 mb-8 h-px bg-pauta" />
        <LoginForm />
      </div>
    </main>
  );
}
