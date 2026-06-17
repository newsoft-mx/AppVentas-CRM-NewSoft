export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { catalogKey, parseImportBuffer, parseYesNo, nullable } from "@/lib/csv";
import { canWrite, requireAuth } from "@/lib/session";
import { calcularOrden, generarFolio } from "@/lib/utils";
import type { EstatusOrden, Moneda } from "@/types/ordenes";

interface ImportError {
  fila: number;
  mensaje: string;
}

interface OrderGroup {
  firstRow: number;
  folio: string | null;
  fecha_cotizacion: string | null;
  cliente: string;
  tipo_cotizacion: string;
  condicion_pago: string;
  vendedor: string;
  descripcion: string;
  estatus: EstatusOrden;
  moneda: Moneda;
  tipo_cambio: number | null;
  vigencia: string | null;
  fecha_venta: string | null;
  aplica_iva: boolean;
  tasa_iva: number | null;
  descuento_porcentaje: number | null;
  descuento_descripcion: string | null;
  notas: string | null;
  partidas: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    orden_display: number;
  }>;
}

function parseNumber(value: string, fallback: number | null = null) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeDate(value: string | null) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slashOrDash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashOrDash) {
    const day = Number(slashOrDash[1]);
    const month = Number(slashOrDash[2]);
    const year = Number(slashOrDash[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date.toISOString().slice(0, 10);
    }
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (Number.isFinite(serial) && serial > 0) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + Math.floor(serial) * 86_400_000);
      return date.toISOString().slice(0, 10);
    }
  }

  return undefined;
}

function groupKey(row: Record<string, string>) {
  if (row.folio?.trim()) return `folio:${row.folio.trim()}`;
  return [
    row.fecha_cotizacion,
    row.cliente,
    row.tipo_cotizacion,
    row.condicion_pago,
    row.vendedor,
    row.descripcion,
    row.estatus,
    row.moneda,
    row.vigencia,
    row.fecha_venta,
  ]
    .map((value) => (value ?? "").trim().toLowerCase())
    .join("|");
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canWrite(session)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (session.rol === "VENDEDOR" && !session.vendedorId) {
    return NextResponse.json({ error: "Usuario sin vendedor asignado" }, { status: 403 });
  }

  const rows = parseImportBuffer(Buffer.from(await req.arrayBuffer()), "Ordenes");
  const errors: ImportError[] = [];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "El archivo no contiene filas válidas" },
      { status: 400 }
    );
  }

  const [clientes, tipos, condiciones, vendedores] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    prisma.tipoCotizacion.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    prisma.condicionComercial.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    prisma.vendedor.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
  ]);

  const clienteByName = new Map(clientes.map((c) => [catalogKey(c.nombre), c.id]));
  const tipoByName = new Map(tipos.map((t) => [catalogKey(t.nombre), t.id]));
  const condicionByName = new Map(condiciones.map((c) => [catalogKey(c.nombre), c.id]));
  const vendedorByName = new Map(vendedores.map((v) => [catalogKey(v.nombre), v.id]));

  const groups = new Map<string, OrderGroup>();

  rows.forEach((row, index) => {
    const fila = index + 2;
    const estatus = ((row.estatus || "BORRADOR").trim().toUpperCase() || "BORRADOR") as EstatusOrden;
    const moneda = ((row.moneda || "MXN").trim().toUpperCase() || "MXN") as Moneda;
    const cantidad = parseNumber(row.cantidad ?? "", Number.NaN);
    const precio = parseNumber(row.precio_unitario ?? "", Number.NaN);
    const tipoCambio = parseNumber(row.tipo_cambio ?? "");
    const tasaIva = parseNumber(row.tasa_iva ?? "16", 16);
    const descuento = parseNumber(row.descuento_porcentaje ?? "");
    const fechaCotizacion = normalizeDate(nullable(row.fecha_cotizacion ?? ""));
    const vigencia = normalizeDate(nullable(row.vigencia ?? ""));
    const fechaVenta = normalizeDate(nullable(row.fecha_venta ?? ""));

    if (!["BORRADOR", "COTIZADO", "VENTA"].includes(estatus)) {
      errors.push({ fila, mensaje: "Estatus inválido" });
      return;
    }
    if (!["MXN", "USD"].includes(moneda)) {
      errors.push({ fila, mensaje: "Moneda inválida" });
      return;
    }
    if (fechaCotizacion === undefined || vigencia === undefined || fechaVenta === undefined) {
      errors.push({ fila, mensaje: "Fecha inválida. Usa YYYY-MM-DD o DD/MM/YYYY" });
      return;
    }
    if (
      !row.partida_descripcion?.trim() ||
      cantidad === null ||
      precio === null ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      errors.push({ fila, mensaje: "Partida inválida" });
      return;
    }
    if (moneda === "USD" && (!tipoCambio || Number.isNaN(tipoCambio))) {
      errors.push({ fila, mensaje: "Tipo de cambio requerido para USD" });
      return;
    }

    const key = groupKey(row);
    const group = groups.get(key) ?? {
      firstRow: fila,
      folio: nullable(row.folio ?? ""),
      fecha_cotizacion: fechaCotizacion,
      cliente: row.cliente ?? "",
      tipo_cotizacion: row.tipo_cotizacion ?? "",
      condicion_pago: row.condicion_pago ?? "",
      vendedor: row.vendedor ?? "",
      descripcion: row.descripcion ?? "",
      estatus,
      moneda,
      tipo_cambio: tipoCambio && !Number.isNaN(tipoCambio) ? tipoCambio : null,
      vigencia,
      fecha_venta: fechaVenta,
      aplica_iva: parseYesNo(row.aplica_iva ?? "SI"),
      tasa_iva: tasaIva && !Number.isNaN(tasaIva) ? tasaIva : null,
      descuento_porcentaje: descuento && !Number.isNaN(descuento) ? descuento : null,
      descuento_descripcion: nullable(row.descuento_descripcion ?? ""),
      notas: nullable(row.notas ?? ""),
      partidas: [],
    };

    group.partidas.push({
      descripcion: row.partida_descripcion.trim(),
      cantidad,
      precio_unitario: precio,
      orden_display: group.partidas.length + 1,
    });
    groups.set(key, group);
  });

  let created = 0;

  for (const group of groups.values()) {
    const clienteId = clienteByName.get(catalogKey(group.cliente));
    const tipoId = tipoByName.get(catalogKey(group.tipo_cotizacion));
    const condicionId = condicionByName.get(catalogKey(group.condicion_pago));
    const vendedorId = session.rol === "VENDEDOR"
      ? session.vendedorId
      : vendedorByName.get(catalogKey(group.vendedor));

    if (!clienteId || !tipoId || !condicionId || !vendedorId || !group.descripcion.trim()) {
      errors.push({
        fila: group.firstRow,
        mensaje: `Cliente, tipo, condición, vendedor o descripción no encontrados: cliente="${group.cliente}", tipo="${group.tipo_cotizacion}", condición="${group.condicion_pago}", vendedor="${group.vendedor}"`,
      });
      continue;
    }

    if (group.folio) {
      const folioExistente = await prisma.ordenVenta.findUnique({
        where: { folio: group.folio },
      });
      if (folioExistente) {
        errors.push({ fila: group.firstRow, mensaje: "Ya existe una orden con ese folio" });
        continue;
      }
    }

    try {
      const calculo = calcularOrden({
        partidas: group.partidas,
        descuento_porcentaje: group.descuento_porcentaje,
        aplica_iva: group.aplica_iva,
        tasa_iva: group.tasa_iva,
        moneda: group.moneda,
        tipo_cambio: group.tipo_cambio,
      });

      await prisma.$transaction(async (tx) => {
        let folio = group.folio;

        if (!folio) {
          const empresa = await tx.empresa.findFirst();
          if (!empresa) throw new Error("Empresa no configurada");
          folio = generarFolio(empresa.prefijo_folio, empresa.siguiente_folio);
          await tx.empresa.update({
            where: { id: empresa.id },
            data: { siguiente_folio: empresa.siguiente_folio + 1 },
          });
        }

        const orden = await tx.ordenVenta.create({
          data: {
            folio,
            cliente_id: clienteId,
            tipo_cotizacion_id: tipoId,
            condicion_pago_id: condicionId,
            vendedor_id: vendedorId,
            descripcion: group.descripcion.trim(),
            estatus: group.estatus,
            moneda: group.moneda,
            tipo_cambio: group.tipo_cambio ? new Decimal(group.tipo_cambio) : null,
            fecha_venta: group.fecha_venta ? new Date(group.fecha_venta) : null,
            vigencia: group.vigencia ? new Date(group.vigencia) : null,
            aplica_iva: group.aplica_iva,
            tasa_iva: group.aplica_iva && group.tasa_iva ? new Decimal(group.tasa_iva) : null,
            descuento_porcentaje: group.descuento_porcentaje ? new Decimal(group.descuento_porcentaje) : null,
            descuento_descripcion: group.descuento_descripcion,
            notas: group.notas,
            subtotal: calculo.subtotal,
            monto_descuento: calculo.monto_descuento,
            subtotal_con_descuento: calculo.subtotal_con_descuento,
            monto_iva: calculo.monto_iva,
            total: calculo.total,
            total_mxn: calculo.total_mxn,
            created_at: group.fecha_cotizacion ? new Date(group.fecha_cotizacion) : undefined,
          },
        });

        await tx.partida.createMany({
          data: group.partidas.map((partida) => ({
            orden_id: orden.id,
            descripcion: partida.descripcion,
            cantidad: new Decimal(partida.cantidad),
            precio_unitario: new Decimal(partida.precio_unitario),
            total_partida: new Decimal(partida.cantidad)
              .times(new Decimal(partida.precio_unitario))
              .toDecimalPlaces(2),
            orden_display: partida.orden_display,
          })),
        });
      });

      created += 1;
    } catch {
      errors.push({ fila: group.firstRow, mensaje: "No se pudo crear la orden" });
    }
  }

  return NextResponse.json({
    created,
    errors,
    total: rows.length,
    ordenes_procesadas: groups.size,
  });
}
