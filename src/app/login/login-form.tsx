"use client";

import { useActionState } from "react";
import { entrar, type LoginState } from "@/actions/auth";

const inicial: LoginState = { erro: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(entrar, inicial);

  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="rotulo">E-mail</span>
        <input
          className="campo mt-1"
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
      </label>
      <label className="block">
        <span className="rotulo">Senha</span>
        <input
          className="campo mt-1"
          type="password"
          name="senha"
          autoComplete="current-password"
          required
        />
      </label>

      <p aria-live="polite" className="min-h-5 text-sm text-acento">
        {state.erro}
      </p>

      <button className="botao botao-primario w-full justify-center" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
