import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Power, Pencil, DatabaseZap, X, Loader2, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRules, type Rule } from "@/hooks/useRules";
import type { Database } from "@/integrations/supabase/types";

type RuleTipo = Database["public"]["Enums"]["rule_tipo"];

export const Route = createFileRoute("/reglas")({
  head: () => ({
    meta: [
      { title: "Reglas Lógicas — Cuadrante" },
      {
        name: "description",
        content: "Define, mide y activa tus propias reglas de análisis predictivo.",
      },
    ],
  }),
  component: Reglas,
});

function Reglas() {
  const { rules, isLoading, isError, createRule, updateRule, deleteRule } = useRules();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    nombre: string;
    tipo: RuleTipo;
    campo: string;
    operador: string;
    valor: string;
    resultado_esperado: string;
  }>({
    nombre: "",
    tipo: "racha",
    campo: "alto_bajo",
    operador: "===",
    valor: "",
    resultado_esperado: "",
  });

  const openForm = (rule?: Rule) => {
    if (rule) {
      setEditingId(rule.id);
      const cond = (rule.condiciones as Record<string, unknown>) || {};
      setFormData({
        nombre: rule.nombre,
        tipo: rule.tipo,
        campo: (cond?.campo as string) || "alto_bajo",
        operador: (cond?.operador as string) || "===",
        valor: (cond?.valor as string) || "",
        resultado_esperado: rule.resultado_esperado ?? "",
      });
    } else {
      setEditingId(null);
      setFormData({
        nombre: "",
        tipo: "racha",
        campo: "alto_bajo",
        operador: "===",
        valor: "",
        resultado_esperado: "",
      });
    }
    setModalOpen(true);
  };

  const closeForm = () => setModalOpen(false);

  const handleSave = () => {
    if (!formData.nombre.trim() || !formData.resultado_esperado.trim()) return;

    const condicionObj = {
      campo: formData.campo,
      operador: formData.operador,
      valor: formData.valor,
    };

    if (editingId) {
      updateRule.mutate(
        {
          id: editingId,
          updates: {
            nombre: formData.nombre,
            tipo: formData.tipo,
            condiciones: condicionObj,
            resultado_esperado: formData.resultado_esperado,
          },
        },
        { onSuccess: closeForm }
      );
    } else {
      createRule.mutate(
        {
          nombre: formData.nombre,
          tipo: formData.tipo,
          condiciones: condicionObj,
          resultado_esperado: formData.resultado_esperado,
          activo: true,
          efectividad: 0,
          aciertos: 0,
          ocurrencias: 0,
        },
        { onSuccess: closeForm }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Seguro que deseas eliminar esta regla del sistema?")) {
      deleteRule.mutate(id, { onSuccess: closeForm });
    }
  };

  const toggleStatus = (rule: Rule) => {
    updateRule.mutate({
      id: rule.id,
      updates: { activo: !rule.activo },
    });
  };

  const isSaving = createRule.isPending || updateRule.isPending;

  return (
    <div className="space-y-6 pt-2 pb-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground">Reglas Lógicas</h1>
          <p className="text-[15px] text-muted-foreground mt-1 max-w-xl">
            Leyes predictivas que el sistema audita en tiempo real sobre el histórico vivo.
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="shrink-0 flex items-center gap-2 h-12 rounded-[16px] bg-foreground px-6 text-[13px] font-bold uppercase tracking-widest text-background shadow-md hover:-translate-y-0.5 hover:bg-muted-foreground transition-all duration-300"
        >
          <Plus className="size-4" />
          <span>Definir regla</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-32 text-muted-foreground animate-pulse-subtle">
          <div className="size-14 rounded-[16px] bg-white border border-border grid place-items-center shadow-sm">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        </div>
      ) : isError ? (
        <div className="py-32 text-center bg-white rounded-[32px] border border-border shadow-sm">
          <DatabaseZap className="size-12 mx-auto text-red-500/50 mb-5" />
          <p className="text-[14px] font-bold text-foreground uppercase tracking-widest">
            ERROR DE CONEXIÓN CON SUPABASE
          </p>
          <p className="text-[13px] text-muted-foreground mt-2 max-w-md mx-auto">
            Asegúrate de que la tabla <code className="font-mono bg-muted px-1 py-0.5 rounded">rules</code> haya sido creada en la base de datos usando el archivo SQL de migración adjunto.
          </p>
        </div>
      ) : rules.length === 0 ? (
        <div className="py-32 text-center bg-white rounded-[32px] border border-border shadow-sm">
          <DatabaseZap className="size-12 mx-auto text-muted-foreground/30 mb-5" />
          <p className="text-[14px] font-bold text-muted-foreground uppercase tracking-widest">
            SIN REGLAS ACTIVAS EN EL MOTOR DE INFERENCIA
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map((r) => {
            const cond = (r.condiciones as Record<string, unknown>) || {};
            const condString = `${cond.campo ?? ""} ${cond.operador ?? ""} ${cond.valor ?? ""}`;
            const pct = r.ocurrencias > 0 ? ((r.aciertos / r.ocurrencias) * 100).toFixed(0) : "0";

            return (
              <div
                key={r.id}
                className={cn(
                  "relative flex flex-col rounded-[24px] p-8 transition-all duration-300 overflow-hidden group border",
                  r.activo
                    ? "bg-white shadow-sm border-border hover:shadow-md hover:border-primary/30"
                    : "bg-muted/40 shadow-none border-border/50 hover:bg-muted/60"
                )}
              >
                <div className="relative z-10 flex items-start justify-between gap-4 mb-8">
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest mb-3 border",
                        r.activo
                          ? "bg-muted text-foreground border-border"
                          : "bg-transparent text-muted-foreground border-border/50"
                      )}
                    >
                      {r.tipo}
                    </span>
                    <h3
                      className={cn(
                        "text-[16px] font-bold tracking-tight leading-tight",
                        r.activo ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {r.nombre}
                    </h3>
                  </div>
                  <button
                    onClick={() => toggleStatus(r)}
                    disabled={updateRule.isPending}
                    className={cn(
                      "relative shrink-0 inline-flex size-12 items-center justify-center rounded-[14px] border transition-all duration-300 disabled:opacity-50",
                      r.activo
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm hover:bg-emerald-100 hover:scale-105"
                        : "border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted shadow-sm"
                    )}
                    title={r.activo ? "Desactivar" : "Activar"}
                  >
                    {updateRule.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Power className={cn("size-5", r.activo && "text-emerald-500")} />
                    )}
                  </button>
                </div>

                <div className="relative z-10 space-y-4 mb-10 flex-1">
                  <Row k="Trigger Condición" v={condString} active={r.activo} />
                  <Row k="Resolución / Expec." v={r.resultado_esperado ?? ""} active={r.activo} />
                </div>

                {/* Progress System */}
                <div className="relative z-10 mt-auto border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Eficacia Histórica
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[14px] font-extrabold tabular-nums",
                        r.activo ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-2 rounded-full overflow-hidden border",
                      r.activo ? "bg-muted border-border shadow-inner" : "bg-muted border-border/50"
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        r.activo ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">
                      {r.aciertos} / {r.ocurrencias} VECES APLICADA
                    </span>
                  </div>
                </div>

                <div className="relative z-10 mt-6 pt-4 flex items-center justify-between border-t border-border/50">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        r.activo ? "bg-emerald-500 animate-pulse-subtle" : "bg-muted-foreground/30"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-widest",
                        r.activo ? "text-emerald-700" : "text-muted-foreground"
                      )}
                    >
                      {r.activo ? "Online" : "Bypass"}
                    </span>
                  </div>
                  <button
                    onClick={() => openForm(r)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-widest transition-colors",
                      r.activo
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                        : "text-muted-foreground/60 hover:bg-white hover:text-foreground border border-border shadow-sm"
                    )}
                  >
                    <Pencil className="size-3.5" /> Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] border border-border shadow-[0_20px_40px_rgba(0,0,0,0.1)] w-full max-w-lg overflow-hidden animate-slide-up-fade">
            <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-[18px] font-bold tracking-tight flex items-center gap-2">
                <DatabaseZap className="size-5 text-primary" />
                {editingId ? "Editar Regla" : "Nueva Regla"}
              </h2>
              <button
                onClick={closeForm}
                className="size-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Nombre de la regla</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej. Compensación tras 3 Bajos"
                    className="w-full h-11 rounded-xl border border-border px-4 text-[14px] font-medium placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as RuleTipo })}
                    className="w-full h-11 rounded-xl border border-border px-4 text-[14px] font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all bg-white"
                  >
                    <option value="racha">Racha Limitante</option>
                    <option value="compensacion">Compensación Pura</option>
                    <option value="bloqueo">Agrupación / Bloqueo</option>
                    <option value="patron">Patrón Complejo</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="p-5 bg-muted/30 rounded-2xl border border-border space-y-4">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Construcción de Condición (Trigger)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Campo</label>
                    <input
                      type="text"
                      className="w-full h-10 rounded-lg border border-border px-3 text-[13px] outline-none focus:border-primary font-mono"
                      value={formData.campo}
                      onChange={(e) => setFormData({ ...formData, campo: e.target.value })}
                      placeholder="alto_bajo"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Operador</label>
                    <select
                      className="w-full h-10 rounded-lg border border-border px-3 text-[13px] outline-none focus:border-primary font-mono bg-white"
                      value={formData.operador}
                      onChange={(e) => setFormData({ ...formData, operador: e.target.value })}
                    >
                      <option value="===">===</option>
                      <option value=">=">&gt;=</option>
                      <option value="<=">&lt;=</option>
                      <option value="includes">INCL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Valor</label>
                    <input
                      type="text"
                      className="w-full h-10 rounded-lg border border-border px-3 text-[13px] outline-none focus:border-primary font-mono"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      placeholder="'ALTO'"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Resultado / Expresión Esperada</label>
                <input
                  type="text"
                  value={formData.resultado_esperado}
                  onChange={(e) => setFormData({ ...formData, resultado_esperado: e.target.value })}
                  placeholder="Ej. ALTO_PAR o ALTO"
                  className="w-full h-11 rounded-xl border border-border px-4 text-[14px] font-bold placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all uppercase tracking-widest text-foreground"
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row items-center sm:justify-between gap-3">
              {editingId ? (
                <button
                  onClick={() => handleDelete(editingId)}
                  disabled={deleteRule.isPending}
                  className="w-full sm:w-auto h-11 px-5 rounded-xl text-[12px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="size-4" /> Eliminar
                </button>
              ) : (
                <div /> // spacer
              )}
              
              <div className="flex w-full sm:w-auto items-center gap-3">
                <button
                  onClick={closeForm}
                  className="flex-1 sm:flex-none h-11 px-6 rounded-xl border border-border bg-white text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.nombre || !formData.resultado_esperado}
                  className="flex-1 sm:flex-none h-11 px-8 rounded-xl bg-foreground text-background text-[12px] font-bold uppercase tracking-widest shadow-md hover:bg-muted-foreground transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, active }: { k: string; v: string; active: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {k}
      </span>
      <span
        className={cn(
          "text-[14px] font-bold leading-snug",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {v}
      </span>
    </div>
  );
}
