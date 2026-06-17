export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { canAccessOrden } from "@/lib/access-control";
import { logger } from "@/lib/logger";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "MXN",
  }).format(value);
}

function date(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getLogoDataUri() {
  try {
    const logo = readFileSync(join(process.cwd(), "public", "newsoft-logo.png"));
    return `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    return null;
  }
}

function markdownToHtml(markdown: string | null | undefined) {
  if (!markdown?.trim()) return "";

  const lines = markdown
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const renderInline = (value: string) =>
    escapeHtml(value)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.*?)__/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/_(.*?)_/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const isTableLine = (line: string) =>
    /^\s*\|.*\|\s*$/.test(line) && line.split("|").filter(Boolean).length > 1;
  const isTableSeparator = (line: string) =>
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const splitTableCells = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      html.push("<br />");
      i += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (isTableLine(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableCells(line);
      const bodyRows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableLine(lines[i])) {
        bodyRows.push(splitTableCells(lines[i]));
        i += 1;
      }
      html.push(`<table class="md-table"><thead><tr>${headers
        .map((cell) => `<th>${renderInline(cell)}</th>`)
        .join("")}</tr></thead><tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${headers
              .map((_, index) => `<td>${renderInline(row[index] ?? "")}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table>`);
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      html.push(`<h3>${renderInline(trimmed.replace(/^#{1,6}\s+/, ""))}</h3>`);
      i += 1;
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      html.push("<hr />");
      i += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      html.push(`<blockquote>${renderInline(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    html.push(`<p>${renderInline(trimmed)}</p>`);
    i += 1;
  }

  return html.join("");
}

function htmlDocument({
  empresa,
  orden,
}: {
  empresa: NonNullable<Awaited<ReturnType<typeof prisma.empresa.findFirst>>>;
  orden: NonNullable<
    Awaited<ReturnType<typeof prisma.ordenVenta.findUnique>>
  > & {
    cliente: {
      nombre: string;
      rfc: string | null;
      contacto: string;
      email: string | null;
      ciudad: string;
    };
    tipo_cotizacion: {
      nombre: string;
      texto_contrato?: string | null;
    };
    condicion_pago: {
      nombre: string;
      descripcion: string | null;
    };
    partidas: Array<{
      orden_display: number;
      descripcion: string;
      cantidad: { toNumber(): number };
      precio_unitario: { toNumber(): number };
      total_partida: { toNumber(): number };
    }>;
  };
}) {
  const brandBase = empresa.nombre_comercial?.trim() || "Newsoft Technologies";
  const brand = /^newsoft$/i.test(brandBase) ? "Newsoft Technologies" : brandBase;
  const logoDataUri = getLogoDataUri();
  const status =
    orden.estatus === "VENTA"
      ? "VENTA"
      : orden.estatus === "COTIZADO"
      ? "COTIZACIÓN"
      : "BORRADOR";
  const vigenciaTexto = date(orden.vigencia);
  const notas = empresa.notas_documentos?.replace("{vigencia}", vigenciaTexto);
  const tipoContrato = (orden.tipo_cotizacion as typeof orden.tipo_cotizacion & {
    texto_contrato?: string | null;
  }).texto_contrato;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 34px 38px 44px; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1A1A2E; font-size: 11px; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1B2A4A; padding-bottom: 16px; margin-bottom: 18px; }
    .brand { display: flex; gap: 18px; align-items: flex-start; }
    .logo-wrap { width: 120px; min-width: 120px; border-radius: 8px; background: white; display: flex; align-items: flex-start; padding-top: 2px; }
    .logo { width: 120px; height: auto; display: block; }
    .mark { width: 42px; height: 42px; border-radius: 10px; background: #E8751A; color: white; display: grid; place-items: center; font-weight: 700; font-size: 16px; }
    h1 { margin: 0 0 3px; color: #1B2A4A; font-size: 13px; line-height: 1.15; }
    .tagline { color: #E8751A; font-weight: 700; font-size: 10px; margin-bottom: 7px; }
    .muted { color: #667085; }
    .right { text-align: right; }
    .badge { display: inline-block; background: #E8751A; color: white; border-radius: 5px; padding: 6px 12px; font-weight: 700; letter-spacing: .08em; margin-bottom: 8px; }
    .folio { color: #1B2A4A; font-size: 22px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
    .box { background: #F5F7FA; border: 1px solid #D0D5DD; border-radius: 8px; padding: 12px; }
    .box-title { color: #667085; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #D0D5DD; padding-bottom: 6px; margin-bottom: 8px; }
    .field { display: grid; grid-template-columns: 92px 1fr; gap: 8px; margin-bottom: 4px; }
    .label { color: #667085; }
    .value { font-weight: 600; }
    .desc { border-left: 4px solid #E8751A; background: #FDF0E6; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
    .desc-title { color: #E8751A; text-transform: uppercase; font-weight: 700; font-size: 10px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #D0D5DD; }
    th { background: #1B2A4A; color: white; text-align: left; font-size: 10px; padding: 8px; }
    td { padding: 8px; border-top: 1px solid #D0D5DD; vertical-align: top; }
    tr:nth-child(even) td { background: #F9FAFB; }
    .num { text-align: right; white-space: nowrap; }
    .summary { margin-left: auto; width: 280px; border: 1px solid #D0D5DD; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    .sum-row { display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #D0D5DD; }
    .total { background: #1B2A4A; color: white; font-weight: 700; font-size: 14px; }
    .section { border: 1px solid #D0D5DD; border-radius: 8px; padding: 12px; margin-top: 10px; page-break-inside: avoid; }
    .section h2 { color: #1B2A4A; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 8px; }
    .section h3 { color: #1B2A4A; font-size: 12px; margin: 8px 0 4px; }
    .section p { margin: 0 0 5px; line-height: 1.45; }
    .section ul, .section ol { margin: 0 0 8px 16px; padding: 0; line-height: 1.45; }
    .section li { margin-bottom: 3px; }
    .section blockquote { margin: 6px 0 8px; padding: 6px 10px; border-left: 3px solid #D0D5DD; background: #F9FAFB; color: #344054; }
    .section hr { border: 0; border-top: 1px solid #D0D5DD; margin: 10px 0; }
    .section pre { margin: 6px 0 8px; padding: 8px; background: #F2F4F7; border: 1px solid #D0D5DD; border-radius: 6px; white-space: pre-wrap; font-size: 10px; }
    .md-table { margin: 8px 0 10px; }
    .md-table th { background: #F2F4F7; color: #1B2A4A; border: 1px solid #D0D5DD; }
    .md-table td { border: 1px solid #D0D5DD; background: white; }
    code { background: #F2F4F7; padding: 1px 3px; border-radius: 3px; }
    .footer { border-top: 1px solid #D0D5DD; margin-top: 14px; padding-top: 10px; color: #667085; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      ${
        logoDataUri
          ? `<div class="logo-wrap"><img class="logo" src="${logoDataUri}" alt="NewSoft" /></div>`
          : `<div class="mark">NS</div>`
      }
      <div>
        <h1>${escapeHtml(brand)}</h1>
        <div class="tagline">Aceleración Tecnológica</div>
        <div class="value">${escapeHtml(empresa.nombre)}</div>
        <div class="muted">RFC: ${escapeHtml(empresa.rfc)}</div>
        <div class="muted">${escapeHtml(empresa.direccion)}</div>
        <div class="muted">${escapeHtml(empresa.email)} · Tel: ${escapeHtml(empresa.telefono)}</div>
      </div>
    </div>
    <div class="right">
      <div class="badge">${status}</div>
      <div class="muted">Folio</div>
      <div class="folio">${escapeHtml(orden.folio)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">Datos de la cotización</div>
      <div class="field"><span class="label">Fecha</span><span>${date(orden.created_at)}</span></div>
      <div class="field"><span class="label">Vigencia</span><span>${vigenciaTexto}</span></div>
      <div class="field"><span class="label">Tipo</span><span>${escapeHtml(orden.tipo_cotizacion.nombre)}</span></div>
      <div class="field"><span class="label">Condición</span><span>${escapeHtml(orden.condicion_pago.nombre)}</span></div>
      <div class="field"><span class="label">Moneda</span><span>${escapeHtml(orden.moneda)}${orden.tipo_cambio ? ` (TC: ${money(orden.tipo_cambio.toNumber(), "MXN")})` : ""}</span></div>
    </div>
    <div class="box">
      <div class="box-title">Cliente</div>
      <div class="field"><span class="label">Empresa</span><span class="value">${escapeHtml(orden.cliente.nombre)}</span></div>
      <div class="field"><span class="label">RFC</span><span>${escapeHtml(orden.cliente.rfc || "No registrado")}</span></div>
      <div class="field"><span class="label">Contacto</span><span>${escapeHtml(orden.cliente.contacto)}</span></div>
      <div class="field"><span class="label">Email</span><span>${escapeHtml(orden.cliente.email || "No registrado")}</span></div>
      <div class="field"><span class="label">Ciudad</span><span>${escapeHtml(orden.cliente.ciudad)}</span></div>
    </div>
  </div>

  <div class="desc">
    <div class="desc-title">Descripción</div>
    <div class="value">${escapeHtml(orden.descripcion)}</div>
  </div>

  <table>
    <thead><tr><th>#</th><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Total</th></tr></thead>
    <tbody>
      ${orden.partidas
        .map(
          (p, index) => `<tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(p.descripcion)}</td>
            <td class="num">${p.cantidad.toNumber()}</td>
            <td class="num">${money(p.precio_unitario.toNumber(), orden.moneda)}</td>
            <td class="num"><strong>${money(p.total_partida.toNumber(), orden.moneda)}</strong></td>
          </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <div class="summary">
    <div class="sum-row"><span>Subtotal</span><strong>${money(orden.subtotal.toNumber(), orden.moneda)}</strong></div>
    ${
      orden.descuento_porcentaje
        ? `<div class="sum-row"><span>Descuento (${orden.descuento_porcentaje.toNumber()}%)</span><strong>-${money(orden.monto_descuento.toNumber(), orden.moneda)}</strong></div>
           <div class="sum-row"><span>Subtotal c/descuento</span><strong>${money(orden.subtotal_con_descuento.toNumber(), orden.moneda)}</strong></div>`
        : ""
    }
    ${orden.aplica_iva ? `<div class="sum-row"><span>IVA (${orden.tasa_iva?.toNumber() ?? 0}%)</span><strong>${money(orden.monto_iva.toNumber(), orden.moneda)}</strong></div>` : ""}
    <div class="sum-row total"><span>Total</span><span>${money(orden.total.toNumber(), orden.moneda)} ${escapeHtml(orden.moneda)}</span></div>
    ${orden.moneda === "USD" ? `<div class="sum-row"><span>Equivalente MXN</span><strong>${money(orden.total_mxn.toNumber(), "MXN")}</strong></div>` : ""}
  </div>

  ${tipoContrato ? `<div class="section"><h2>Contrato / condiciones del servicio</h2>${markdownToHtml(tipoContrato)}</div>` : ""}
  ${orden.condicion_pago.descripcion ? `<div class="section"><h2>Condiciones comerciales</h2>${markdownToHtml(orden.condicion_pago.descripcion)}</div>` : ""}
  ${notas ? `<div class="footer"><strong>Notas y condiciones</strong><br />${escapeHtml(notas)}</div>` : ""}
</body>
</html>`;
}

async function renderPdf(html: string) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    userDataDir: "/tmp/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}

// ── GET /api/pdf/:id ──────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const orden = await prisma.ordenVenta.findUnique({
      where: { id },
      include: {
        cliente: true,
        tipo_cotizacion: true,
        condicion_pago: true,
        partidas: { orderBy: { orden_display: "asc" } },
      },
    });

    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (!canAccessOrden(session, orden)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const empresa = await prisma.empresa.findFirst();
    if (!empresa) {
      return NextResponse.json(
        { error: "Empresa no configurada" },
        { status: 500 }
      );
    }

    const pdfBuffer = await renderPdf(htmlDocument({ empresa, orden }));
    const nombreArchivo = `${orden.folio}_${orden.cliente.nombre
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .substring(0, 30)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logger.error("Error al generar PDF con Chromium", "GET /api/pdf/:id", err);
    return NextResponse.json(
      { error: "Error al generar el PDF" },
      { status: 500 }
    );
  }
}
