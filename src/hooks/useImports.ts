import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { BuiltRow } from "@/lib/excelParser";

export type ImportRow = Database["public"]["Tables"]["imports"]["Row"];

export function useImports(limit = 10) {
  return useQuery({
    queryKey: ["imports", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface ImportSummary {
  importados: number;
  duplicados: number;
  errores: number;
}

interface SorteoLookupRow {
  id: string;
  hora: string;
  loteria_id: string;
  lotteries: { nombre: string };
}

/**
 * Resuelve sorteo_id buscando por (lotería madre, hora). Si no existe el sorteo,
 * lo crea automáticamente bajo la lotería indicada.
 */
async function resolveSorteoIds(
  rows: BuiltRow[],
): Promise<{ map: Map<string, string>; missing: string[] }> {
  // 1. Cargar todos los sorteos activos con su lotería
  const { data: sorteos, error } = await supabase
    .from("lottery_draws")
    .select("id, hora, loteria_id, lotteries!inner(nombre)")
    .eq("activa", true);
  if (error) throw error;

  const lookup = new Map<string, string>(); // "loteria|hora" -> sorteo_id
  const lotteryByName = new Map<string, string>(); // nombre -> loteria_id
  for (const s of (sorteos ?? []) as unknown as SorteoLookupRow[]) {
    const lotName = s.lotteries.nombre;
    lookup.set(`${lotName.toLowerCase()}|${s.hora}`, s.id);
    lotteryByName.set(lotName.toLowerCase(), s.loteria_id);
  }

  const map = new Map<string, string>();
  const missing: string[] = [];
  const toCreate: Array<{ loteria_id: string; hora: string; key: string }> = [];

  for (const r of rows) {
    const key = `${r.loteria.toLowerCase()}|${r.hora}`;
    if (map.has(key)) continue;
    const id = lookup.get(key);
    if (id) {
      map.set(key, id);
      continue;
    }
    const loteriaId = lotteryByName.get(r.loteria.toLowerCase());
    if (!loteriaId) {
      if (!missing.includes(r.loteria)) missing.push(r.loteria);
      continue;
    }
    if (!toCreate.find((c) => c.key === key)) {
      toCreate.push({ loteria_id: loteriaId, hora: r.hora, key });
    }
  }

  // Crear sorteos faltantes (auto-provisión por horario)
  if (toCreate.length > 0) {
    const payload = toCreate.map((c) => ({
      loteria_id: c.loteria_id,
      hora: c.hora,
      nombre: `Sorteo ${c.hora}`,
    }));
    const { data: created, error: createErr } = await supabase
      .from("lottery_draws")
      .insert(payload)
      .select("id, hora, loteria_id");
    if (createErr) throw createErr;
    for (const c of created ?? []) {
      const lotName = [...lotteryByName.entries()].find(([, id]) => id === c.loteria_id)?.[0];
      if (lotName) map.set(`${lotName}|${c.hora}`, c.id);
    }
  }

  return { map, missing };
}

export function useExecuteImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fileName: string;
      rows: BuiltRow[];
      errorsCount?: number;
      errorDetails?: Array<{ index: number; message: string }>;
    }): Promise<ImportSummary> => {
      let importados = 0;
      let duplicados = 0;
      const erroresInsert: Array<{ index: number; message: string }> = [];

      // Resolver sorteo_id por (lotería, hora)
      const { map: sorteoMap, missing } = await resolveSorteoIds(input.rows);
      if (missing.length > 0) {
        throw new Error(
          `Las siguientes loterías no existen en el sistema: ${missing.join(", ")}. Créalas en Configuración antes de importar.`,
        );
      }

      const enriched = input.rows
        .map((r) => {
          const key = `${r.loteria.toLowerCase()}|${r.hora}`;
          const sorteo_id = sorteoMap.get(key);
          return sorteo_id ? { row: r, sorteo_id } : null;
        })
        .filter((x): x is { row: BuiltRow; sorteo_id: string } => x !== null);

      // Pre-cargar duplicados existentes UNA sola vez por (sorteo_id, fecha) usando IN
      const sorteoIdsAll = Array.from(new Set(enriched.map((e) => e.sorteo_id)));
      const fechasAll = Array.from(new Set(enriched.map((e) => e.row.fecha)));
      const existingSet = new Set<string>();
      if (sorteoIdsAll.length > 0 && fechasAll.length > 0) {
        // Paginar por bloques de 500 sorteos x 500 fechas para no romper la URL
        const ID_CHUNK = 500;
        for (let i = 0; i < sorteoIdsAll.length; i += ID_CHUNK) {
          const idsSlice = sorteoIdsAll.slice(i, i + ID_CHUNK);
          const { data: existing, error: existErr } = await supabase
            .from("draws")
            .select("sorteo_id, fecha")
            .in("sorteo_id", idsSlice)
            .in("fecha", fechasAll);
          if (existErr) throw existErr;
          for (const e of existing ?? []) {
            existingSet.add(`${e.sorteo_id}|${e.fecha}`);
          }
        }
      }

      // Insertamos en lotes de 200
      const CHUNK = 200;
      for (let i = 0; i < enriched.length; i += CHUNK) {
        const slice = enriched.slice(i, i + CHUNK);

        const toInsert = slice.filter((s) => {
          const key = `${s.sorteo_id}|${s.row.fecha}`;
          if (existingSet.has(key)) {
            duplicados++;
            return false;
          }
          // marcar para dedupe dentro del mismo archivo
          existingSet.add(key);
          return true;
        });

        if (toInsert.length) {
          const payload = toInsert.map(({ row: r, sorteo_id }) => ({
            sorteo_id,
            fecha: r.fecha,
            numero: r.numero,
            // placeholders: el trigger recalcula
            alto_bajo: "BAJO",
            par_impar: "PAR",
            cuadrante: "BAJO_PAR",
            origen: "excel" as const,
            observacion: r.observacion,
            movimiento: r.movimiento,
            extra: r.extra as never,
          }));
          const { error, count } = await supabase
            .from("draws")
            .insert(payload, { count: "exact" });
          if (error) {
            erroresInsert.push({ index: i, message: error.message });
          } else {
            importados += count ?? toInsert.length;
          }
        }
      }

      const errorDetails = [...(input.errorDetails ?? []), ...erroresInsert];

      await supabase.from("imports").insert({
        archivo: input.fileName,
        registros_importados: importados,
        registros_duplicados: duplicados,
        errores: (input.errorsCount ?? 0) + erroresInsert.length,
        detalle_errores: errorDetails as never,
        estado: errorDetails.length === 0 ? "completado" : "con_errores",
      });

      return {
        importados,
        duplicados,
        errores: (input.errorsCount ?? 0) + erroresInsert.length,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["draws"] });
      qc.invalidateQueries({ queryKey: ["imports"] });
    },
  });
}
