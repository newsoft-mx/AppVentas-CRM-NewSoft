# Intake de leads web → CRM

Endpoint público para que el **formulario del sitio** cree prospectos en el pipeline del CRM.
El sitio manda un payload simple; el CRM lo traduce a Prospecto + Contacto + Deal.

## Endpoint

```
POST https://crm-newsoft.vercel.app/api/public/leads
Headers:
  Content-Type: application/json
  X-API-Key: <clave secreta>        # se define en Vercel → env var LEADS_API_KEY
```

## Body

```json
{
  "nombre":   "Juan Pérez",              // obligatorio (nombre del contacto)
  "email":    "juan@empresa.com",        // opcional
  "telefono": "+52 55 1234 5678",        // opcional
  "empresa":  "Empresa XYZ",             // opcional (si falta, se usa el nombre del contacto)
  "website":  "empresa.com",             // opcional
  "mensaje":  "Quiero una demo",         // opcional (queda como nota del deal)
  "_hp":      ""                          // honeypot: campo OCULTO, debe ir vacío
}
```

## Respuestas

| Código | Significado |
|---|---|
| `201 { "ok": true }` | Lead creado (o honeypot activado — se responde ok igual para no delatar el filtro). |
| `401 { "error": "No autorizado" }` | Falta o no coincide `X-API-Key`. |
| `422 { "error": "Datos inválidos", "details": [...] }` | Payload inválido (ej. sin `nombre`, email mal formado). |
| `503` / `500` | Pipeline sin etapas / error interno. |

## Qué crea en el CRM

- **Cliente** con `estatus = PROSPECTO` (empresa).
- **Contacto** principal (nombre/email/teléfono).
- **Deal** en la **primera etapa** del pipeline, con:
  - **canal = "Web"**, **origen = "Formulario web"** (se crean en el catálogo si no existen).
  - asignado al **buzón** configurado en *Configuración → Leads web* (o sin asignar).
  - el `mensaje` como **nota** del deal.

## Seguridad

- **API key** obligatoria (`X-API-Key`). Vive en Vercel (`LEADS_API_KEY`), nunca en el repo.
- **Honeypot** `_hp`: si un bot lo llena, se descarta silenciosamente.
- **CORS**: si el form postea desde el navegador, configurar los orígenes permitidos en la env
  var `LEADS_ALLOWED_ORIGINS` (dominios separados por coma). Vacío = refleja el Origin recibido.
- **Rate limit**: pendiente (backlog de robustez). Hoy la defensa es API key + honeypot.

## Ejemplo (curl)

```bash
curl -X POST https://crm-newsoft.vercel.app/api/public/leads \
  -H "Content-Type: application/json" \
  -H "X-API-Key: LA_CLAVE" \
  -d '{"nombre":"Juan Pérez","email":"juan@empresa.com","empresa":"Empresa XYZ","mensaje":"Quiero una demo"}'
```

## Formas de integrar

- **Recomendada — backend del sitio → este endpoint** (server-to-server): la API key nunca se
  expone. El sitio recibe su form y hace el POST desde su servidor.
- **Navegador directo → este endpoint**: la key queda expuesta en el front → sumar
  `LEADS_ALLOWED_ORIGINS` + honeypot + (a futuro) rate limit / CAPTCHA.
