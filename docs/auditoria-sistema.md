# Auditoría de dominio — Newsoft Sales CRM

> Barrido de todo el sistema con el marco de 8 capas × 5 modos de rotura. Anclado en `archivo:línea`. Cierra con un plan de remediación **por invariante y por contexto acotado** (no por camino), priorizado por riesgo.

## Veredicto

El **núcleo derivado (scoring) está bien construido**: un solo adaptador (`lib/deal-score.ts`), nadie re-deriva la fórmula, el filtro `eliminada:false` es consistente en todos los reads. Ese pilar es sólido.

Las grietas — reales y que **van a doler al escalar** — están concentradas en **ventas/financiero, integridad de estado, y trazabilidad deal↔orden**, más una **observabilidad casi nula**. No es "todo inestable"; son ~6 invariantes de carga que hoy se sostienen por convención y hay que blindar **antes** de agregar features encima.

---

## Matriz 8×5 (capa × modo de rotura)

| Capa | A · Ausente | B · Duplicada | C · Ambigua | D · Huérfana | E · Inobservable |
|---|---|---|---|---|---|
| **1 Ontología** | — | Motivos de pérdida hardcodeados en 3 lugares | `activo`(bool) vs `ACTIVO`(estatus); `estatus`(orden) vs `resultado`(deal); `/temperatura` ya no fija temperatura | `TemperaturaDeal` enum muerto; `MotivoPerdida` no es FK de `Deal.razon_perdida` | — |
| **2 Ciclo de vida** | — | Enums re-hardcodeados en handlers (`RESULTADOS`,`TEMPS`,`ESTADOS`) | 3 campos de estado en `DealActividad` (`estado_accion`+`completada`+`estado_plan`) | Enums Prisma duplicados como uniones en `types/` | — |
| **3 Transiciones** | `Deal.resultado` acepta cualquier→cualquiera; `stage` sin orden/dirección; `estado_accion` sin máquina | Máquina de órdenes existe pero **la ruta general la evita**; idempotencia reimplementada 4 formas | — | Transición `Cliente→INACTIVO` nunca ocurre (usa `activo` bool) | — |
| **4 Invariantes** | ≥1 contacto / 1 principal / `orden` único: solo convención; `USD⇒tipo_cambio`, `VENTA⇒fecha_venta` solo en zod | — | — | — | Solo hay 1 health-check (score); nada verifica los demás |
| **5 Autoridad** | — | Guarda "ya está en estado X" repetida sin helper | — | `requireRole` definido y sin uso | — |
| **6 Derivación** | — | KPIs duplicados cliente/servidor; `completada` denormalizado; `Deal.valor` vs total de orden | — | — | — |
| **7 Efectos/bordes** | Hand-off deal→orden y avance AUTOMÁTICO **sin transacción** | — | — | `Deal.orden_id` declarado, **nunca escrito** | — |
| **8 Caminos no felices** | Hard-delete de orden VENTA; `cliente.activo=false` **no** se excluye de financieros; reabrir ganado no desvincula orden | — | Deal SUSPENDIDO: excluido de métricas pero vivo | Catálogos con `.delete()` duro → señal de score huérfana | Errores tragados en `catch{}`; sin snapshot fiscal al cerrar venta |

---

## Hallazgos críticos (ordenados por riesgo)

### 🔴 P0 — Integridad financiera (toca plata)
1. **Orden VENTA se puede borrar en DURO** — `DELETE /api/ordenes/[id]` no chequea `estatus` (`ordenes/[id]/route.ts:222`), contra el propio comentario del schema (`schema.prisma:289`). Una venta contada en todos los reportes desaparece sin rastro.
2. **La máquina de estados de órdenes es evitable** — `PATCH /api/ordenes/[id]` escribe `estatus` sin consultar `TRANSICIONES_PERMITIDAS` (`ordenes/[id]/route.ts:147`, schema zod `ordenes.ts:146`), mientras `/estatus` sí la aplica. Dos puertas, una sin control.
3. **`cliente.activo=false` NO se excluye de financieros** — ningún reporte de ventas filtra por cliente activo (`ventas-mensuales`, `top-clientes:28`, `ordenes/route.ts:72`, `lib/kpis.ts`). Desactivar un cliente lo oculta de la lista pero **sus ventas siguen sumando**. Invariante inconsistente y no documentado.

### 🔴 P0 — Trazabilidad deal↔orden (traducción rota)
4. **`Deal.orden_id` (@unique) nunca se escribe** (`schema.prisma:538`; ausencia en `ganar/route.ts` y `ordenes/route.ts`). El hand-off pasa `cliente_id/valor` por query params a `/ventas/nueva`; el deal↔orden **no queda vinculado en DB**. Ganar un deal y no completar la orden deja un deal GANADO sin venta y **sin forma de detectarlo**.
5. **Hand-off y avance automático de etapa NO son transaccionales** (`ganar/route.ts:31`, `actividades/route.ts:162-177`: 3 writes sueltos). Una falla parcial deja `stage_id` avanzado sin `DealStageEvent` → **el funnel diverge del pipeline real**.

### 🟠 P1 — Integridad de estado
6. **`Deal.resultado` sin máquina de estados** — cualquier estado→cualquiera (GANADO↔PERDIDO↔ABIERTO), `resultado/route.ts:32`. Reabrir un ganado no desvincula la orden.
7. **`stage_id` con dos caminos divergentes** — `/stage` valida+historial vs `PATCH /deals/[id]` escribe crudo sin historial (`route.ts:63`).
8. **`INACTIVO` huérfano** — el enum tiene INACTIVO pero `desactivar` escribe `activo=false` (`desactivar/route.ts:36`). Dos representaciones de "inactivo".

### 🟡 P2-P3 — SSOT y ontología (deuda, no sangra)
9. **`completada` denormalizado** de `estado_accion`, sync a mano (`actividades/[id]/route.ts:76,83`).
10. **KPIs duplicados** cliente (`lib/kpis.ts`) vs servidor (`ordenes/kpis/route.ts`) con uso inconsistente de `netAmount`.
11. **`MotivoPerdida` no es FK** — `Deal.razon_perdida` es string libre; renombrar/borrar un motivo deja históricos sueltos.
12. **Enum `TemperaturaDeal` muerto** + listas de enum re-hardcodeadas en 3 handlers (drift si el enum cambia).

### 🟡 P4 — Observabilidad (todo lo anterior es inverificable en prod)
13. **Errores tragados**: el patrón es `catch {}` → 500 genérico **sin loguear** (`ordenes/[id]/route.ts:225`, `resultado/route.ts:94`, casi todos). `logger.error` casi no se usa.
14. **Un solo health-check** (`/api/admin/audit-score`) que cubre solo score. Nada verifica: deal sin contacto, orden VENTA sin fecha_venta, fuga de cliente inactivo, `estado_accion`/`completada` desincronizados, orden huérfana.

---

## Hallazgos adicionales (frontend / hardcode / UX)

- **`window.confirm` / `window.alert`** en 6 lugares (`TabModeloActividad.tsx:61,64,82,85`, `TabMotivosPerdida.tsx:59`, `DealDetalleClient.tsx:259`) — diálogos nativos del browser en vez de modal/toast del sistema. Peor: el `alert("No se pudo eliminar (puede tener actividades asociadas)")` es un **mensaje genérico hardcodeado que esconde el error real** del backend (modo C/E). *(Mi `TabScoring` nuevo copió este patrón — a revisar.)*
- **Panel de IA construido pero no liberado** (`analizar`/`resumen` gateados por `ANTHROPIC_API_KEY`, devuelven 503 si falta; comentario "Fase 2"). Código vivo sin ruta de UI liberada — dead-path controlado, pero es superficie sin usar.
- **`RAZONES_PERDIDA` hardcodeado** (`DealDetalleClient.tsx:21`) como fallback del catálogo `MotivoPerdida` — es la 3ª copia del catálogo (ver B-1 / D-1 arriba).
- **Filtro de clientes sin `INACTIVO`** (`ClientesClient.tsx:229` ofrece solo todos/ACTIVO/PROSPECTO) — confirma que `EstatusCliente.INACTIVO` es **inalcanzable desde la UI** (nadie lo setea ni lo filtra).
- **Campo "Temperatura" en el alta de deal** (`NuevoDealModal.tsx`) — capturado y **ignorado** por el backend (se deriva del score). Campo muerto en el form.
- Sin UUIDs, credenciales ni URLs hardcodeadas en componentes (login por env, IA por API key). ✔️

## Aplicando tus dos trampas (la parte de criterio)

**Duplicación accidental (unificar) vs diferencia legítima entre contextos (traducir, no forzar):**

| Caso | ¿Mismo contexto? | Acción |
|---|---|---|
| `activo`(bool) vs `estatus=INACTIVO` | **Sí** (ambos = "cliente inactivo") | **Duplicación accidental → unificar** en un solo campo de estado. |
| `completada` vs `estado_accion` | **Sí** (mismo hecho) | **Accidental → derivar** `completada` de `estado_accion` o eliminarla. |
| KPIs cliente vs servidor | **Sí** | **Accidental → un solo cálculo** (ya hicimos esto con `metricasPipeline`; falta órdenes). |
| Listas de enum re-hardcodeadas | **Sí** | **Accidental → una fuente** (el enum Prisma). |
| `Deal.resultado=GANADO` vs `OrdenVenta.estatus=VENTA` | **No** (pipeline ≠ ventas) | **Diferencia legítima → NO fusionar.** Arreglar la **traducción nombrada**: persistir `orden_id`, hacer el hand-off atómico. |
| `Deal.valor` (estimado) vs total real de la orden | **No** (estimación ≠ facturado) | **Legítima → NO sincronizar.** Nombrarlos distinto ("valor estimado" vs "total"), no pretender que coincidan. |
| "Cliente" prospecto (pipeline) vs cliente facturable (ventas) | **No** (dos contextos) | Es el **mismo registro con estatus** — hoy funciona; el error a evitar es el God-model. La traducción es la conversión (que ya existe). |

> Regla que sale de esto: **el `Cliente` único-con-estados está bien** (no es God-model para este tamaño de negocio); lo que hay que blindar no es "unificar todo" sino **las traducciones entre pipeline y ventas** (deal→orden) y **las duplicaciones accidentales dentro de un mismo contexto**.

---

## Plan de remediación — por invariante, priorizado

En vez de criterios caso-por-caso, cada bloque es un **enunciado universal** + cómo se **enforcea** + cómo se **observa** (para que no quede inobservable).

### Bloque F — Integridad financiera (P0)
- **Invariante:** *"Una orden VENTA es inmutable salvo por su máquina de estados, nunca se borra en duro, siempre tiene `fecha_venta`, y siempre aparece en financieros."*
- Enforce: bloquear `DELETE` si `estatus≠BORRADOR`; **una sola puerta** para `estatus` (quitar el bypass del PATCH general → todo pasa por la máquina); `fecha_venta` NOT NULL a nivel garantía cuando VENTA; decidir y **documentar** la política de `cliente.activo` en financieros (excluir o no) y aplicarla en TODOS los reads.
- Observa: health-check "toda orden VENTA tiene fecha_venta y cliente resoluble; no hay VENTA borrada".

### Bloque T — Traducción deal↔orden (P0)
- **Invariante:** *"Un deal GANADO tiene exactamente una orden vinculada (`orden_id`), y ganar⇒crear-orden es atómico o reconciliable."*
- Enforce: persistir `orden_id` al crear la orden desde el hand-off (una transacción o un paso de reconciliación); al reabrir un ganado, desvincular explícitamente.
- Observa: health-check "deals GANADO sin `orden_id`" y "órdenes con `deal_id` colgante".

### Bloque E — Integridad de estado (P1)
- **Invariante:** *"Toda transición de estado (deal.resultado, deal.stage, orden.estatus, actividad) es legal según su máquina, y no hay ruta paralela que la evite."*
- Enforce: matriz de transiciones para `Deal.resultado`; **un solo choke-point** por entidad (el PATCH general no toca estado); unificar `INACTIVO` (un campo de estado, no `activo` bool); envolver el avance automático en `$transaction`.
- Observa: los intentos ilegales devuelven 409 (como ya hace órdenes), y se loguean.

### Bloque C — Contactos (P2) — *la feature que querías, ahora como invariante*
- **Invariante:** *"Un cliente tiene ≥1 contacto y exactamente un principal; un deal referencia contactos de su cliente."*
- Es el plan de unificación de contactos ya escrito (`plan-unificacion-contactos.md`), pero ahora **enforceado por schema** (`@@unique` parcial del principal, FK) en vez de convención. Se hace **después** de F/T/E, sobre base estable.

### Bloque S — SSOT y ontología (P3)
- **Invariante:** *"Cada número/lista se define en un solo lugar."*
- Unificar KPIs de órdenes (como hicimos con pipeline); derivar/eliminar `completada`; `MotivoPerdida` → FK; borrar enum `TemperaturaDeal` muerto y las listas re-hardcodeadas (derivar del enum).

### Bloque O — Observabilidad (P4) — *transversal, barato, primero*
- **Invariante:** *"Todo error se loguea y todo invariante crítico tiene un chequeo de salud."*
- Loguear en los `catch`; extender `/api/admin/audit-score` (o un `/api/admin/health`) para cubrir F/T/E/C. **Esto va primero porque hace verificables a todos los demás.**

### Bloque B — Bordes (P5)
- Chromium `userDataDir` por invocación (concurrencia); TZ explícita en rangos de reportes; gate manual para migraciones destructivas en deploy.

---

## Secuencia recomendada

1. **O (observabilidad)** — barato y hace medibles a los demás.
2. **F + T (financiero + traducción deal↔orden)** — el mayor riesgo, y son fixes chicos y quirúrgicos.
3. **E (integridad de estado)** — cierra las puertas paralelas.
4. **C (contactos)** — la feature, ahora sobre base blindada.
5. **S + B (SSOT/ontología + bordes)** — deuda, en paralelo o después.

> **Recomendación de PO:** no agregar contactos/ciclo-de-vida (features nuevas) hasta cerrar **F, T y E**. Son los invariantes de carga; construir encima de ellos rotos es lo que hace un backend no escalable. Son pocas líneas cada uno, no un refactor grande.
