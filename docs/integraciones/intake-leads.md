# Integración de leads — API de intake

Contrato para que **marketing** (formulario web, landing, o un middleware tipo Zapier/Make
conectado a Meta Lead Ads) cree leads directamente en el CRM. Un lead entra como **deal en la
primera etapa del pipeline**, con su **prospecto** (cliente con `estatus=PROSPECTO`) y su
**contacto** ya ligados.

> **Filosofía del contrato:** exponemos **todos** los campos con los que damos de alta un deal.
> El **único obligatorio es `nombre`** (del contacto). Todo lo demás es opcional: mandá lo que
> tu form/fuente tenga y decidí **de tu lado** qué hacés obligatorio. Un campo blando que llegue
> mal **no tumba el lead** — se ignora y te lo avisamos en la respuesta (`avisos`).

---

## Endpoint

```
POST https://crm-newsoft.vercel.app/api/public/leads
Content-Type: application/json
X-API-Key: <LEADS_API_KEY>
```

- **Autenticación:** header `X-API-Key`. La provee Newsoft (vive solo en las env vars del CRM).
  Sin key válida → `401`.
- **CORS:** si el form postea desde el navegador, avisá el/los orígenes para agregarlos al
  allowlist (`LEADS_ALLOWED_ORIGINS`). Desde un servidor/middleware no hace falta.
- **Anti-spam (opcional pero recomendado):** incluí un campo oculto `_hp` en tu form. Si un bot
  lo llena, mandalo tal cual: respondemos `201 {ok:true}` **sin crear nada** (honeypot).

---

## Campos

| Campo | Tipo | Oblig. | Notas |
|---|---|:---:|---|
| `nombre` | string | **Sí** | Nombre del **contacto**. Máx 150. |
| `email` | string | No | Se normaliza a minúsculas. Debe ser un email válido si viene. |
| `telefono` | string | No | Máx 20. |
| `whatsapp` | string | No | Máx 20. |
| `cargo` | string | No | Puesto del contacto. Máx 100. |
| `empresa` | string | No | Nombre del prospecto. Si falta, usamos el nombre del contacto. Máx 200. |
| `website` | string | No | Se normaliza con `https://` si no lo trae. Máx 255. |
| `tamano_empresa` | enum | No | Uno de: `MICRO`, `PEQUENA`, `MEDIANA`, `GRANDE` (case-insensitive). |
| `titulo` | string | No | Nombre del deal. Si falta → `"Lead — {empresa}"`. Máx 200. |
| `tipo` | string | No | Nombre del **tipo de cotización** (debe existir en el catálogo; ver abajo). |
| `moneda` | string | No | `MXN` (default) o `USD`. Otro valor → se ignora. |
| `valor` | número | No | Monto del deal. ≥ 0. |
| `setup` | número | No | Costo de setup. ≥ 0. |
| `mensualidad` | número | No | Renta mensual. ≥ 0. |
| `meses` | número | No | Plazo en meses. ≥ 0. |
| `fecha_cierre_estimada` | string | No | Fecha ISO (`YYYY-MM-DD`). |
| `campana` | string | No | Campaña/origen específico (ej. `"Google Ads - Portales Q3"`). Máx 120. |
| `mensaje` | string | No | Texto libre → queda en las notas del deal. Máx 2000. |
| `_hp` | string | No | Honeypot anti-bot (dejar vacío; ver arriba). |

Los números aceptan tanto JSON number como string (`"120000"`), porque los forms HTML mandan
strings.

### Campos que **NO** se aceptan (los pone el CRM, no la fuente)

- **Vendedor:** se asigna con la config interna (`vendedor_leads_web_id`).
- **Etapa:** siempre la primera del pipeline.
- **Cliente existente:** los leads nacen como **prospecto** nuevo.
- **Canal:** lo fija la fuente/adaptador (`Web`, `Meta`, …), no el payload. Para distinguir la
  campaña dentro de un canal, usá `campana`.

---

## Respuestas

| Código | Cuerpo | Significado |
|---|---|---|
| `201` | `{ "ok": true, "id": "<uuid>" }` | Lead creado. |
| `201` | `{ "ok": true, "id": "<uuid>", "avisos": [ "..." ] }` | Creado, pero se ignoró algún campo blando (ej. `tipo` inexistente). |
| `201` | `{ "ok": true }` | Honeypot activado (bot) — no se creó nada. |
| `401` | `{ "error": "No autorizado" }` | Falta o no coincide la `X-API-Key`. |
| `422` | `{ "error": "Datos inválidos", "details": [ { "campo", "mensaje" } ] }` | Validación (ej. sin `nombre`, email mal formado, `tamano_empresa` inválido). |
| `500` | `{ "error": "..." }` | Error interno. |

**Guardá el `id`** de la respuesta si querés conciliar del lado de la fuente.

### Sobre `tipo`

El tipo de cotización es un catálogo **curado** (tiene precios/contrato asociados), así que **no
se crea al vuelo**. Si mandás un `tipo` que no existe, el lead se crea igual **sin tipo** y te lo
avisamos, listando los válidos:

```json
{ "ok": true, "id": "…", "avisos": ["tipo \"X\" no existe; se ignoró. Válidos: SEC Plan, Proyecto Fijo, Soporte, TrackPoint"] }
```

Pedí a Newsoft la lista vigente de tipos si querés mandarlo.

---

## Ejemplos

### Mínimo (solo lo obligatorio)

```bash
curl -X POST https://crm-newsoft.vercel.app/api/public/leads \
  -H "Content-Type: application/json" -H "X-API-Key: $LEADS_API_KEY" \
  -d '{ "nombre": "Ana Pérez" }'
```

### Completo (todo lo que soportamos)

```bash
curl -X POST https://crm-newsoft.vercel.app/api/public/leads \
  -H "Content-Type: application/json" -H "X-API-Key: $LEADS_API_KEY" \
  -d '{
    "nombre": "Ana Pérez",
    "email": "ana@empresa.mx",
    "telefono": "55-1234-5678",
    "whatsapp": "55-9999-0000",
    "cargo": "Gerente de Compras",
    "empresa": "Empresa Demo SA",
    "website": "empresa.mx",
    "tamano_empresa": "MEDIANA",
    "titulo": "Portal B2B",
    "tipo": "Soporte",
    "moneda": "USD",
    "valor": 120000,
    "setup": 50000,
    "mensualidad": 8000,
    "meses": 12,
    "fecha_cierre_estimada": "2026-09-30",
    "campana": "Google Ads - Portales Q3",
    "mensaje": "Vino del landing de portales"
  }'
```

---

## Otras fuentes (Meta, etc.)

El endpoint `/api/public/leads` es el adaptador del **form web propio** (canal `Web`). Meta Lead
Ads u otras fuentes se conectan igual, mapeando su payload a estos mismos campos vía un
middleware (Zapier/Make/n8n) que postee acá con la `X-API-Key`. Internamente todas las fuentes
usan el mismo core de creación (`registrarLead` → `crearDealTx`), así que el comportamiento es
idéntico; sólo cambia el **canal/origen** con el que queda registrado el deal. Si más adelante se
quiere un endpoint nativo dedicado por fuente (con su propio canal), es un adaptador delgado más
sobre el mismo core.
