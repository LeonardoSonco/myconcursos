export type Ponto = { lat: number; lon: number };

/** Rota de carro entre dois pontos; null = sem rota. */
export type Trecho = { distancia_km: number; duracao_min: number } | null;

export type Provedor = "osrm" | "ors";
