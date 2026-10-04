// Escrito à mão espelhando supabase/migrations/ (0001_init … 0004_estudo_avancado).
// Pode ser substituído por: npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ConcursoStatus =
  | "previsto"
  | "edital_publicado"
  | "inscricoes_abertas"
  | "inscricoes_encerradas"
  | "prova_realizada"
  | "resultado";

export type Database = {
  public: {
    Tables: {
      membros: {
        Row: { user_id: string; nome: string; criado_em: string };
        Insert: { user_id: string; nome: string; criado_em?: string };
        Update: { user_id?: string; nome?: string; criado_em?: string };
        Relationships: [];
      };
      cidades_base: {
        Row: {
          id: number;
          nome: string;
          uf: string;
          rotulo: string;
          ordem: number;
          lat: number | null;
          lon: number | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          nome: string;
          uf: string;
          rotulo: string;
          ordem?: number;
          lat?: number | null;
          lon?: number | null;
        };
        Update: {
          nome?: string;
          uf?: string;
          rotulo?: string;
          ordem?: number;
          lat?: number | null;
          lon?: number | null;
        };
        Relationships: [];
      };
      concursos: {
        Row: {
          id: string;
          municipio: string;
          uf: string;
          orgao: string | null;
          banca: string | null;
          edital_url: string | null;
          status: ConcursoStatus;
          inscricao_fim: string | null;
          prova_data: string | null;
          observacoes: string | null;
          lat: number | null;
          lon: number | null;
          geocodificado_em: string | null;
          geocode_erro: string | null;
          criado_por: string | null;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          municipio: string;
          uf: string;
          orgao?: string | null;
          banca?: string | null;
          edital_url?: string | null;
          status?: ConcursoStatus;
          inscricao_fim?: string | null;
          prova_data?: string | null;
          observacoes?: string | null;
          lat?: number | null;
          lon?: number | null;
          geocodificado_em?: string | null;
          geocode_erro?: string | null;
          criado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["concursos"]["Insert"]>;
        Relationships: [];
      };
      cargos: {
        Row: {
          id: string;
          concurso_id: string;
          nome: string;
          vagas: number;
          cadastro_reserva: boolean;
          carga_horaria_semanal: number | null;
          salario: number | null;
          taxa_inscricao: number | null;
          requisitos: string | null;
          principal: boolean;
          ordem: number;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          id?: string;
          concurso_id: string;
          nome: string;
          vagas?: number;
          cadastro_reserva?: boolean;
          carga_horaria_semanal?: number | null;
          salario?: number | null;
          taxa_inscricao?: number | null;
          requisitos?: string | null;
          principal?: boolean;
          ordem?: number;
        };
        Update: Partial<Database["public"]["Tables"]["cargos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "cargos_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
        ];
      };
      concurso_distancias: {
        Row: {
          concurso_id: string;
          cidade_base_id: number;
          distancia_km: number | null;
          duracao_min: number | null;
          provedor: "osrm" | "ors";
          erro: string | null;
          calculado_em: string;
        };
        Insert: {
          concurso_id: string;
          cidade_base_id: number;
          distancia_km?: number | null;
          duracao_min?: number | null;
          provedor?: "osrm" | "ors";
          erro?: string | null;
          calculado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["concurso_distancias"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "concurso_distancias_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "concurso_distancias_cidade_base_id_fkey";
            columns: ["cidade_base_id"];
            isOneToOne: false;
            referencedRelation: "cidades_base";
            referencedColumns: ["id"];
          },
        ];
      };
      materias: {
        Row: {
          id: string;
          concurso_id: string;
          cargo_id: string | null;
          nome: string;
          nome_normalizado: string;
          ordem: number;
          criado_em: string;
        };
        Insert: {
          id?: string;
          concurso_id: string;
          cargo_id?: string | null;
          nome: string;
          ordem?: number;
        };
        Update: Partial<Database["public"]["Tables"]["materias"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "materias_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "materias_cargo_id_fkey";
            columns: ["cargo_id"];
            isOneToOne: false;
            referencedRelation: "cargos";
            referencedColumns: ["id"];
          },
        ];
      };
      topicos: {
        Row: { id: string; materia_id: string; titulo: string; ordem: number; criado_em: string };
        Insert: { id?: string; materia_id: string; titulo: string; ordem?: number };
        Update: { materia_id?: string; titulo?: string; ordem?: number };
        Relationships: [
          {
            foreignKeyName: "topicos_materia_id_fkey";
            columns: ["materia_id"];
            isOneToOne: false;
            referencedRelation: "materias";
            referencedColumns: ["id"];
          },
        ];
      };
      topico_progresso: {
        Row: {
          user_id: string;
          topico_id: string;
          estudado_em: string;
          revisoes: number;
          proxima_revisao: string | null;
        };
        Insert: {
          user_id?: string;
          topico_id: string;
          estudado_em?: string;
          revisoes?: number;
          proxima_revisao?: string | null;
        };
        Update: { estudado_em?: string; revisoes?: number; proxima_revisao?: string | null };
        Relationships: [
          {
            foreignKeyName: "topico_progresso_topico_id_fkey";
            columns: ["topico_id"];
            isOneToOne: false;
            referencedRelation: "topicos";
            referencedColumns: ["id"];
          },
        ];
      };
      provas_anteriores: {
        Row: {
          id: string;
          concurso_id: string;
          cargo: string;
          orgao: string | null;
          banca: string | null;
          ano: number | null;
          prova_url: string;
          gabarito_url: string | null;
          observacoes: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          concurso_id: string;
          cargo: string;
          orgao?: string | null;
          banca?: string | null;
          ano?: number | null;
          prova_url: string;
          gabarito_url?: string | null;
          observacoes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["provas_anteriores"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "provas_anteriores_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
        ];
      };
      prova_resolvida: {
        Row: {
          user_id: string;
          prova_id: string;
          acertos: number | null;
          questoes: number | null;
          resolvida_em: string;
        };
        Insert: {
          user_id?: string;
          prova_id: string;
          acertos?: number | null;
          questoes?: number | null;
          resolvida_em?: string;
        };
        Update: { acertos?: number | null; questoes?: number | null; resolvida_em?: string };
        Relationships: [
          {
            foreignKeyName: "prova_resolvida_prova_id_fkey";
            columns: ["prova_id"];
            isOneToOne: false;
            referencedRelation: "provas_anteriores";
            referencedColumns: ["id"];
          },
        ];
      };
      participacao: {
        Row: {
          user_id: string;
          concurso_id: string;
          inscrito: boolean;
          boleto_pago: boolean;
          cartao_confirmacao: boolean;
          local_prova: string | null;
          hospedagem: number | null;
          nota: number | null;
          classificacao: number | null;
          aprovado: boolean | null;
          atualizado_em: string;
        };
        Insert: {
          user_id?: string;
          concurso_id: string;
          inscrito?: boolean;
          boleto_pago?: boolean;
          cartao_confirmacao?: boolean;
          local_prova?: string | null;
          hospedagem?: number | null;
          nota?: number | null;
          classificacao?: number | null;
          aprovado?: boolean | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["participacao"]["Insert"], "user_id" | "concurso_id">>;
        Relationships: [
          {
            foreignKeyName: "participacao_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
        ];
      };
      preferencias: {
        Row: {
          user_id: string;
          consumo_km_l: number | null;
          preco_combustivel: number | null;
          atualizado_em: string;
        };
        Insert: { user_id?: string; consumo_km_l?: number | null; preco_combustivel?: number | null };
        Update: { consumo_km_l?: number | null; preco_combustivel?: number | null };
        Relationships: [];
      };
      sessoes_estudo: {
        Row: {
          id: string;
          user_id: string;
          concurso_id: string;
          materia_id: string | null;
          prova: boolean;
          dia: string;
          minutos: number;
          criado_em: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          concurso_id: string;
          materia_id?: string | null;
          prova?: boolean;
          dia?: string;
          minutos: number;
        };
        Update: { materia_id?: string | null; prova?: boolean; dia?: string; minutos?: number };
        Relationships: [
          {
            foreignKeyName: "sessoes_estudo_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessoes_estudo_materia_id_fkey";
            columns: ["materia_id"];
            isOneToOne: false;
            referencedRelation: "materias";
            referencedColumns: ["id"];
          },
        ];
      };
      caderno_erros: {
        Row: {
          id: string;
          user_id: string;
          concurso_id: string;
          prova_id: string | null;
          materia_id: string | null;
          questao: number | null;
          descricao: string;
          revisado: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          concurso_id: string;
          prova_id?: string | null;
          materia_id?: string | null;
          questao?: number | null;
          descricao: string;
          revisado?: boolean;
        };
        Update: {
          prova_id?: string | null;
          materia_id?: string | null;
          questao?: number | null;
          descricao?: string;
          revisado?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "caderno_erros_concurso_id_fkey";
            columns: ["concurso_id"];
            isOneToOne: false;
            referencedRelation: "concursos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caderno_erros_prova_id_fkey";
            columns: ["prova_id"];
            isOneToOne: false;
            referencedRelation: "provas_anteriores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caderno_erros_materia_id_fkey";
            columns: ["materia_id"];
            isOneToOne: false;
            referencedRelation: "materias";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_progresso_materia: {
        Row: {
          materia_id: string;
          concurso_id: string;
          nome: string;
          ordem: number;
          total_topicos: number;
          estudados: number;
        };
        Relationships: [];
      };
      v_progresso_concurso: {
        Row: { concurso_id: string; total_topicos: number; estudados: number };
        Relationships: [];
      };
      v_materias_em_comum: {
        Row: {
          nome_normalizado: string;
          nome_exibicao: string;
          qtd_concursos: number;
          concurso_ids: string[];
        };
        Relationships: [];
      };
    };
    Functions: {
      is_membro: { Args: Record<string, never>; Returns: boolean };
      normaliza_nome: { Args: { t: string }; Returns: string };
    };
    Enums: { concurso_status: ConcursoStatus };
    CompositeTypes: Record<string, never>;
  };
};

type Public = Database["public"];
export type Tabela<T extends keyof Public["Tables"]> = Public["Tables"][T]["Row"];

export type Concurso = Tabela<"concursos">;
export type Cargo = Tabela<"cargos">;
export type CidadeBase = Tabela<"cidades_base">;
export type Distancia = Tabela<"concurso_distancias">;

export type ConcursoCompleto = Concurso & {
  cargos: Cargo[];
  concurso_distancias: Distancia[];
};

export type ProvaAnterior = Tabela<"provas_anteriores">;
export type ProvaResolvida = Tabela<"prova_resolvida">;
export type Participacao = Tabela<"participacao">;
export type Preferencias = Tabela<"preferencias">;
export type SessaoEstudo = Tabela<"sessoes_estudo">;
export type ErroCaderno = Tabela<"caderno_erros">;
