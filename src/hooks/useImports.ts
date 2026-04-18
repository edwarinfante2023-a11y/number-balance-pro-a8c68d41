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

      // Insertamos en lotes de 200 para no exceder límites
      const CHUNK = 200;
      for (let i = 0; i < input.rows.length; i += CHUNK) {
        const slice = input.rows.slice(i, i + CHUNK);
        // Detectar duplicados existentes (mismo fecha+hora+loteria+numero)
        const orFilter = slice
          .map(
            (r) =>
              `and(fecha.eq.${r.fecha},hora.eq.${r.hora},loteria.eq.${encodeURIComponent(
                r.loteria,
              )},numero.eq.${r.numero})`,
          )
          .join(",");

        const { data: existing } = await supabase
          .from("draws")
          .select("fecha,hora,loteria,numero")
          .or(orFilter);

        const existingSet = new Set(
          (existing ?? []).map((e) => `${e.fecha}|${e.hora}|${e.loteria}|${e.numero}`),
        );

        const toInsert = slice.filter((r) => {
          const key = `${r.fecha}|${r.hora}|${r.loteria}|${r.numero}`;
          if (existingSet.has(key)) {
            duplicados++;
            return false;
          }
          return true;
        });

        if (toInsert.length) {
          const payload = toInsert.map((r) => ({
            fecha: r.fecha,
            hora: r.hora,
            loteria: r.loteria,
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

      // Registrar en tabla imports
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
