import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DrawExtra } from "@shared/lottery";

type DrawRow = Database["public"]["Tables"]["draws"]["Row"];
export type DrawInsert = Database["public"]["Tables"]["draws"]["Insert"];

/** Draw enriquecido: incluye hora + nombre de la lottería madre via join.
 *  El campo `extra` sobreescribe el Json genérico de DrawRow con el tipo tipado DrawExtra.
 */
export type Draw = Omit<DrawRow, "extra"> & {
  hora: string;
  loteria: string;
  loteria_id: string;
  sorteo_nombre: string;
  extra?: DrawExtra | null;
};

interface RawDrawJoined extends DrawRow {
  lottery_draws: {
    id: string;
    hora: string;
    nombre: string;
    loteria_id: string;
    lotteries: { id: string; nombre: string };
  };
}

function mapDraw(row: RawDrawJoined): Draw {
  return {
    ...row,
    hora: row.lottery_draws.hora,
    loteria: row.lottery_draws.lotteries.nombre,
    loteria_id: row.lottery_draws.loteria_id,
    sorteo_nombre: row.lottery_draws.nombre,
    extra: (row.extra as unknown as DrawExtra | null) ?? null,
  };
}

export function useDraws(opts?: {
  limit?: number;
  loteriaId?: string;
  sorteoId?: string;
  fecha?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  return useQuery({
    queryKey: ["draws", opts],
    queryFn: async (): Promise<Draw[]> => {
      let q = supabase
        .from("draws")
        .select("*, lottery_draws!inner(id, hora, nombre, loteria_id, lotteries!inner(id, nombre))")
        .order("fecha", { ascending: false });
      if (opts?.sorteoId) q = q.eq("sorteo_id", opts.sorteoId);
      if (opts?.loteriaId) q = q.eq("lottery_draws.loteria_id", opts.loteriaId);
      if (opts?.fecha) q = q.eq("fecha", opts.fecha);
      if (opts?.fechaDesde) q = q.gte("fecha", opts.fechaDesde);
      if (opts?.fechaHasta) q = q.lte("fecha", opts.fechaHasta);
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => mapDraw(r as unknown as RawDrawJoined));
    },
  });
}

export function useCreateDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sorteo_id: string;
      fecha: string;
      numero: number;
      numero_segundo?: number | null;
      numero_tercero?: number | null;
      observacion?: string | null;
      movimiento?: string | null;
    }) => {
      // alto_bajo, par_impar y cuadrante los calcula el trigger; pasamos placeholders
      const payload: DrawInsert = {
        sorteo_id: input.sorteo_id,
        fecha: input.fecha,
        numero: input.numero,
        alto_bajo: "BAJO",
        par_impar: "PAR",
        cuadrante: "BAJO_PAR",
        origen: "manual",
        observacion: input.observacion ?? null,
        movimiento: input.movimiento ?? null,
        extra: {
          segundo: input.numero_segundo ?? null,
          tercero: input.numero_tercero ?? null,
        },
      };
      const { data, error } = await supabase.from("draws").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["draws"] });
      // Forzar evaluación de cartera al insertar manualmente
      try {
        await fetch("https://project--eaae42aa-34c4-457c-a07c-36f8131c182e.lovable.app/api/public/hooks/evaluate-results", { method: "POST" });
        qc.invalidateQueries({ queryKey: ["carterasDelDia"] });
        qc.invalidateQueries({ queryKey: ["draws"] });
      } catch (e) {
        console.error("Error triggering evaluation:", e);
      }
    },
  });
}

export function useDeleteDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("draws").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["draws"] }),
  });
}
