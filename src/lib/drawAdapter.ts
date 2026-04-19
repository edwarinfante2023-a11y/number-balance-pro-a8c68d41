import type { Sorteo, AltoBajo, ParImpar, Subcuadrante, Origen, DrawExtra } from "@/lib/lottery";
import type { Draw } from "@/hooks/useDraws";

export function drawToSorteo(d: Draw): Sorteo {
  return {
    id: d.id,
    fecha: d.fecha,
    hora: d.hora,
    loteria: d.loteria,
    numero: d.numero,
    altoBajo: d.alto_bajo as AltoBajo,
    parImpar: d.par_impar as ParImpar,
    subcuadrante: (d.subcuadrante ?? d.cuadrante) as Subcuadrante,
    observacion: d.observacion ?? undefined,
    movimiento: d.movimiento ?? undefined,
    origen: d.origen as Origen,
    patronDetectado: d.patron_detectado ?? undefined,
    // Pasar campo extra tipado para que manual_analysis sea accesible en UI
    extra: (d.extra as unknown as DrawExtra) ?? undefined,
  };
}
