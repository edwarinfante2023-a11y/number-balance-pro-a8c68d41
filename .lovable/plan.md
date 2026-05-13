## Recomendación basada en datos reales

**Hit rate últimos 30 días (40 carteras evaluadas):**
- 1ro: **55%** (22/40) → muy por encima del 36% de break-even
- 2do: 20% (8/40)
- 3ro: 22.5% (9/40)

**EV por jugada de cartera completa (25 nums × $25 = $625 costo):**

```text
Cobro esperado = 0.55×$1750 + 0.20×$250 + 0.225×$100
               = $962 + $50 + $22 = ~$1.035
EV neto        = $1.035 − $625 = +$410 por jugada
ROI esperado   = +65%
```

El número está bien — la cartera completa es **EV positivo** con buen margen.

**Caveat honesto:** muestra de 40 jugadas es chica. Para las 18:00 puntualmente solo hay 2 evaluaciones (las dos acertaron, pero estadísticamente irrelevante). El 55% global se sostiene cruzando todas las horas.

---

## Cartera 18:00 de hoy (13-may-2026) — lista para enviar

```text
03, 17, 23, 33, 37, 44, 45, 47, 50, 51, 56, 57, 62,
65, 66, 67, 70, 75, 77, 80, 85, 88, 96, 98, 99
```

25 números. Internal score: 65. Alta convicción (≥80): **77, 96, 98**.

**Acción inmediata:** abrir `/cartera`, seleccionar hora 18:00, pulsar el botón **"Copiar números"** que ya está en el grid → pegar en WhatsApp.

---

## Plan técnico (opcional, para próximas veces)

Si querés que el envío al cliente sea más rápido y profesional, propongo agregar:

### Botón "Copiar para cliente" mejorado en `/cartera`

En vez del copy actual (lista cruda), un botón secundario que copie un mensaje pre-formateado:

```text
🎯 Cartera 18:00 · 13 may

03 - 17 - 23 - 33 - 37 - 44 - 45 - 47 - 50 - 51
56 - 57 - 62 - 65 - 66 - 67 - 70 - 75 - 77 - 80
85 - 88 - 96 - 98 - 99

⭐ Alta convicción: 77, 96, 98
```

Solo frontend, 10 líneas en `src/routes/cartera.tsx` al lado del botón Copiar existente. Sin tocar backend ni schema.

### Archivo a modificar
- `src/routes/cartera.tsx` — agregar segundo botón `Copy → "Copiar para cliente"` que arme el string con header (hora + fecha), grilla 10 por línea, y línea de alta convicción.

### Lo que NO se toca
- Schema, evaluador, scraper, RLS — nada.
- El botón "Copiar números" actual queda como está (formato técnico).
