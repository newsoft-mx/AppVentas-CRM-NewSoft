# Módulo: Pipeline de Ventas (CRM) — Definición / Requerimiento

> **Estado:** Borrador para revisión (Jesús + Víctor). Base: reunión con Roldán (08/06/2026) + 3 mockups HTML (`crm-pipeline`, `crm-deal-detail-v2`, `crm-action-inbox`).
> **Autor:** Lisandro. **Fecha:** 2026-06-18.
> Documenta el **qué** y el **cómo encaja** con el sistema actual. Las decisiones abiertas están al final.

---

## 1. Objetivo

Convertir Newsoft Sales de un cotizador en un **CRM con pipeline de ventas + copiloto de IA**. El corazón del módulo **no es el Kanban** (eso ya existe en otras herramientas) — es la **guía de IA que le dice al vendedor la siguiente acción concreta**, para que *nunca se quede parado*. El Kanban es el contenedor; la IA es el diferenciador.

Cita de Roldán: *"que siempre tengas algo que hacer"* · *"que el vendedor solo entre... y empiece a ejecutar y que no se quede parado"*.

**Visión mayor (contexto, no alcance de esta fase):** postventa como negocio recurrente, agentes que observan la plataforma, y **cobro por consumo de IA**. Este pipeline es el primer agente "a nivel usuario" de esa visión.

**Restricción arquitectónica (Roldán):** *"no quiero que lo hagamos de forma diferente... sigue siendo una plataforma"*. Alinear el diseño con Víctor (dueño del enfoque de plataformas) antes de construir.

---

## 2. Concepto clave: el Deal es una entidad nueva, pre-venta

Un **Deal** (prospecto/oportunidad) es distinto de la **Orden de Venta** existente:

| | Deal (nuevo) | Orden de Venta (existente) |
|---|---|---|
| Qué es | Oportunidad en seguimiento comercial | Cotización o venta formal con partidas y montos |
| Estados | **Stages configurables** (Leads → … → Cierre) | `BORRADOR / COTIZADO / VENTA` (fijo) |
| Vive en | Módulo **Pipeline CRM** (nuevo) | Módulo **Ventas** (actual) |
| Relación | **Al ganarse → genera/sugiere una Orden de Venta** | — |

El deal arranca como "estado de pipeline previo" a la venta. **Al cerrarse (ganar), hace hand-off al módulo de Ventas** (sugiere crear la orden). Las cotizaciones dentro del CRM **no son prioritarias** (Roldán).

---

## 3. Las tres vistas (según mockups)

### 3.1 Pipeline CRM — tablero Kanban (`crm-pipeline`)

- **Nuevo ítem de menú** "Pipeline CRM" en el sidebar (entre Reportes y Configuración).
- **Barra de KPIs (arriba):** Valor del pipeline (MXN), Deals activos, 🔥 Calientes, Promedio por deal.
- **Columnas = stages configurables.** Default actual: Leads · Calificado · Req. Definidos · Propuesta · Negociación · Cierre del Mes · Pausados. Cada columna muestra nombre, conteo, color y **total $ de la columna**.
- **Tarjeta de deal:** nombre del proyecto, cliente, monto, **días en la etapa**, dueño (avatar), y **temperatura** (5 niveles: Muy caliente → Caliente → Tibio → Frío → Muy frío).
- **Acciones:** botón "Nuevo Deal", filtros (Todos / Mis deals / Este mes), drag & drop entre columnas (mueve de stage).

### 3.2 Detalle del deal — 3 columnas (`crm-deal-detail-v2`)

- **Topbar:** breadcrumb (Pipeline › Stage › Deal), botones **Editar** y **Marcar ganado**.
- **Columna izquierda — info del deal:**
  - Badge de temperatura + stage; nombre; cliente.
  - **Barra de progreso de stages** (recorrido visual).
  - **KPIs 2×2:** Monto · Cierre estimado (fecha) · Días abierto · **Probabilidad de cierre (%)**.
  - **Datos del deal:** Tipo (reusa *Tipo de Cotización*, ej. "Plataforma Administrada"), **Setup ($)**, **Mensualidad ($/mes)**, Canal (ej. WhatsApp API), Origen (ej. Referido), Responsable.
  - **Contactos:** múltiples, con rol (Decisor / Influenciador) y accesos (Llamar / Email / WhatsApp).
  - **Historial con el cliente:** proyectos anteriores, total facturado, LTV, antigüedad. *(Reusa las órdenes del sistema. Roldán: opcional/nice-to-have.)*
- **Columna central — bitácora/actividades:**
  - Tabs/filtros: Actividad · Emails · Llamadas · Archivos.
  - **Compositor:** registrar Nota / Llamada / Email (**+ WhatsApp**, pedido por Roldán); con tarea + check opcional.
  - **Timeline:** cada evento con tipo, autor, fecha y contenido. Incluye eventos de sistema (cambios de stage) y adjuntos.
- **Columna derecha — Panel de IA "Asistente de Ventas":**
  - **Subir transcript** (pegar texto o archivo .txt/.docx/.pdf/.csv) → **Analizar**.
  - Resultados en 3 bloques:
    1. **Siguiente acción recomendada** — exactamente **3 acciones**, cada una con urgencia (alta/media/baja).
    2. **Objeciones detectadas** — tipo (precio/integración/tiempo/otro), cita del cliente, respuesta sugerida.
    3. **Señales de riesgo** — nivel (bajo/medio/alto) + % + señales (🔴/🟡/🟢).
  - Historial de análisis anteriores.
  - También: **resumen/chat del deal on-demand** (Roldán: *"dame un resumen del deal"*).

### 3.3 Mis acciones — inbox consolidado (`crm-action-inbox`)

- **Nuevo ítem de menú** "Mis acciones" con badge de pendientes.
- Selector de vendedor (cubrir a un compañero ausente) + filtros (Urgente / Esta semana / Llamadas / Emails / Propuestas).
- **Filas de acción:** check para completar, texto, temperatura, deal + monto, dueño, urgencia, tipo, y botones rápidos (Posponer / Llamar|Redactar|Abrir deal).
- Agrupadas por urgencia (Hoy / Esta semana / Próximo mes / Completadas).
- Las acciones provienen de las **sugerencias de IA consolidadas por deal**. Es el *"inbox de acciones"* que pidió Roldán.

---

## 4. Modelo de datos propuesto (entidades nuevas)

Reutiliza `Cliente`, `Vendedor`, `OrdenVenta`, `TipoCotizacion` existentes (ver [docs funcional](../funcional/modelo-de-datos.md)). Montos en `Decimal` (regla del proyecto).

| Entidad nueva | Campos clave | Relaciones |
|---|---|---|
| **PipelineStage** | `nombre`, `orden`, `color`, `activo` (catálogo configurable, soft-delete) | 1:N → Deal |
| **Deal** | `nombre`, `valor` (Decimal), `setup`, `mensualidad`, `meses`, `moneda`, `temperatura` (enum 5), `probabilidad` (%), `fecha_cierre_estimada`, `canal`, `origen`, `fecha_entrada_stage` (para "días en etapa") | N:1 → Cliente, Vendedor (dueño), PipelineStage, TipoCotizacion; N:1 opcional → OrdenVenta (al ganar) |
| **DealContacto** | `nombre`, `rol` (decisor/influenciador), `email`, `telefono`, `whatsapp` | N:1 → Deal *(o reutilizar contacto de Cliente — decidir)* |
| **DealActividad** | `tipo` (nota/llamada/email/whatsapp/sistema), `contenido`, `autor`, `fecha`, `tarea`, `completada` | N:1 → Deal |
| **DealAdjunto** | `nombre`, `tipo`, `url/blob` (transcripts, propuestas) | N:1 → Deal |
| **DealAnalisisIA** | `transcript`, `acciones[]`, `objeciones[]`, `riesgo`, `creado_en`, `modelo` | N:1 → Deal |

**Enum temperatura:** `MUY_FRIO, FRIO, TIBIO, CALIENTE, MUY_CALIENTE`.
**Stages no son enum** — son catálogo configurable (a diferencia del `estatus` de las órdenes).

---

## 5. Motores de negocio nuevos

| Motor | Qué hace | Cómo (propuesta) |
|---|---|---|
| **Días en etapa** | Cuántos días lleva el deal en su stage actual | `now - fecha_entrada_stage`; se reinicia al mover de stage |
| **Temperatura** | Clasifica el deal en 5 niveles | Manual al inicio; a futuro derivable de actividad reciente + IA |
| **Probabilidad de cierre** | % de probabilidad | **Híbrido LLM + determinístico** (decidido): base fija por stage, **ajustada por la IA** según actividad/objeciones del deal. El LLM etiqueta señales; el motor determinístico calcula el % final |
| **Sugerencias IA** | 3 acciones + objeciones + riesgo por deal | Backend → Claude (ver §6) |
| **Inbox consolidado** | Junta las acciones sugeridas de todos los deals del vendedor | Query sobre `DealAnalisisIA` / acciones pendientes |

---

## 6. Arquitectura de IA (importante — corrige el mockup)

El mockup llama a `api.anthropic.com` **directo desde el navegador** con el modelo `claude-sonnet-4-20250514`. **Eso NO va a producción** por dos razones: (1) expondría la API key en el cliente; (2) ese modelo está desactualizado.

**Arquitectura correcta:**
- **Toda llamada a Claude pasa por un route handler del backend** (`app/api/crm/deals/[id]/analizar/route.ts`), nunca desde el browser. La API key vive en variables de entorno del servidor.
- **SDK oficial** `@anthropic-ai/sdk` (el proyecto es Next.js/TypeScript).
- **Modelo: configurable por entorno** (decidido). Variable de entorno `CRM_AI_MODEL` para alternar entre `claude-opus-4-8` (calidad, default de arranque) y `claude-sonnet-4-6` (~5× más barato en output) sin tocar código. Se decide el modelo de producción con **datos de consumo reales** (relevante para el cobro-por-consumo).
- **Salida estructurada:** usar `output_config: { format: { type: "json_schema", schema: … } }` (structured outputs) para garantizar el JSON de acciones/objeciones/riesgo — más robusto que el "responde solo JSON" + limpieza con regex del mockup.
- **Patrón híbrido LLM + determinístico** (lo que Roldán y Lisandro discutieron): el LLM **propone/etiqueta** (objeciones, señales, acciones); un motor determinístico **decide/ejecuta** según parámetros (ej. probabilidad de cierre, priorización del inbox). Aplica directo a este módulo.
- **Contexto del análisis:** datos del deal + bitácora + transcript subido → prompt del sistema (como en el mockup, pero server-side).

---

## 7. Integración con el sistema actual

- **Entrada de deals:** desde el módulo **Clientes** se puede "agregar un deal" (Roldán). A futuro, captura automática desde la **web** (formulario) → primer stage. *(Web = fase 2, decisión abierta.)*
- **Hand-off al ganar:** al "Marcar ganado", el deal **sugiere crear la Orden de Venta** en el módulo Ventas (reusa el motor de montos/folios existente).
- **Histórico del cliente:** se arma con las `OrdenVenta` existentes del cliente (no duplicar datos).
- **Reutiliza:** Cliente, Vendedor (dueño del deal), TipoCotizacion (tipo del deal), motor de montos `Decimal`, patrón de filtros multi-selección y de KPIs.

---

## 8. Roles y visibilidad

- **Por ahora, visibilidad abierta:** todos los vendedores ven todos los deals (Roldán: un vendedor cubre a otro ausente). **Esto difiere del scoping por vendedor** que hoy tienen las órdenes — es una decisión deliberada para el CRM.
- El selector de vendedor del inbox permite ver las acciones de cualquiera.
- *(A futuro, si se requiere scoping, se reutiliza el patrón de [roles-y-accesos](../funcional/roles-y-accesos.md).)*

---

## 9. Alcance por fases

**MVP (lo más prioritario según Roldán):**
1. Entidades Deal + PipelineStage (stages configurables) + DealActividad.
2. Vista Kanban con KPIs, tarjetas, drag & drop entre stages.
3. Detalle del deal: info + bitácora (nota/llamada/email/**WhatsApp como registro manual**). Alta de deals **manual** (desde Clientes). Contactos del deal como entidad propia (`DealContacto`).
4. **Panel de IA:** subir transcript → 3 acciones + objeciones + riesgo (backend + Claude).
5. Hand-off básico: "Marcar ganado" → sugiere crear orden.

**Fase 2:**
- Inbox de acciones consolidado.
- Resumen/chat del deal on-demand.
- Probabilidad de cierre (motor definido).
- Historial del cliente embebido.

**Fase 3:**
- Integración real de WhatsApp (WhatsApp Business API).
- Cobro por consumo de IA / métricas de uso.

**Sin fecha (a evaluar más adelante):**
- Captura automática de prospectos desde la web (formulario → primer stage). Por ahora el alta es **manual**.

---

## 10. Decisiones resueltas (2026-06-18, con Lisandro)

| # | Decisión | Resolución |
|---|---|---|
| 1 | **Probabilidad de cierre** | **Híbrido LLM + determinístico** — base por stage, ajustada por la IA según actividad/objeciones. |
| 2 | **Modelo de IA** | **Configurable por entorno** (`CRM_AI_MODEL`): `claude-opus-4-8` ↔ `claude-sonnet-4-6`. Se decide producción con consumo real. |
| 3 | **Captura desde la web** | **Alta manual por ahora** (desde Clientes). La captura web queda sin fecha, a evaluar. |
| 4 | **WhatsApp** | **Registro manual en el MVP** (tipo de actividad). Integración real con WhatsApp Business API → fase 3. |
| 5 | **Visibilidad** | **Abierta** — todos los vendedores ven todos los deals (≠ scoping de órdenes). Confirmado lo que pidió Roldán. |
| 6 | **Deal → Orden** | **Sugiere y precarga** — al ganar, crea un borrador de orden con los datos del deal; el usuario confirma y completa partidas. |
| 7 | **Contactos** | **Entidad propia** `DealContacto` (nombre, rol, email, tel, WhatsApp) — soporta múltiples contactos con rol como en el mockup. |

### Pendiente (confirmación externa)

| # | Decisión | Responsable |
|---|---|---|
| 8 | **Alineación de plataforma** — validar que el enfoque encaja con la "plataforma de plataformas". | **Víctor** |
