/**
 * Newsoft Sales — Seed de datos iniciales
 *
 * Crea:
 *  - 1 Usuario admin (roldan@newsoft.mx)
 *  - 1 Empresa (Newsoft Technologies)
 *  - 4 Tipos de cotización
 *  - 7 Condiciones comerciales
 *  - 3 Clientes demo con órdenes de ejemplo
 *
 * Uso: npm run db:seed
 */

import { PrismaClient, EstatusOrden, Moneda } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Datos demo (clientes/órdenes/deals/bitácora de ejemplo) SOLO con --demo.
  // Sin la bandera, el seed crea únicamente la CONFIG (empresa, catálogos, etapas, usuarios):
  // seguro para setup de producción / staging. Demo para local: `npm run db:seed:demo`.
  const SEED_DEMO = process.argv.includes("--demo");
  console.log(`🌱 Iniciando seed de Newsoft Sales${SEED_DEMO ? " (con datos demo)" : " (solo config)"}...\n`);

  // ──────────────────────────────────────────
  // 0. USUARIOS
  // ──────────────────────────────────────────
  console.log("🔐 Creando usuario administrador...");

  const adminPassword = process.env.ADMIN_PASSWORD ?? "newsoft2026";
  const salesPassword = process.env.SALES_PASSWORD ?? "newsoft2026";

  const [userRoldan, userElva] = await Promise.all([
    prisma.user.upsert({
      where: { email: "roldan@newsoft.mx" },
      update: {},
      create: {
        nombre: "Roldán",
        email: "roldan@newsoft.mx",
        password_hash: await bcrypt.hash(adminPassword, 12),
        activo: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "elva@newsoft.mx" },
      update: {},
      create: {
        nombre: "Elva",
        email: "elva@newsoft.mx",
        password_hash: await bcrypt.hash(salesPassword, 12),
        activo: true,
      },
    }),
  ]);

  await Promise.all([
    prisma.$executeRaw`UPDATE "user" SET rol = 'ADMIN'::user_role WHERE id = ${userRoldan.id}::uuid`,
    prisma.$executeRaw`UPDATE "user" SET rol = 'GERENTE_COMERCIAL'::user_role WHERE id = ${userElva.id}::uuid`,
  ]);

  console.log(`   ✓ ${userRoldan.email}`);
  console.log(`   ✓ ${userElva.email}\n`);

  // ──────────────────────────────────────────
  // 1. EMPRESA
  // ──────────────────────────────────────────
  console.log("📋 Creando configuración de empresa...");

  const empresa = await prisma.empresa.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      nombre: "Newsoft Technologies S.A. de C.V.",
      nombre_comercial: "NewSoft",
      rfc: "NTE150615GH7",
      direccion: "Av. Insurgentes Sur 1234, Piso 8, Col. Del Valle, CDMX, C.P. 03100",
      email: "ventas@newsoft.mx",
      telefono: "+52 55 1234 5678",
      prefijo_folio: "NS",
      siguiente_folio: 1,
      vigencia_cotizacion_dias: 30,
      aplicar_iva: true,
      tasa_iva: 16.00,
      notas_documentos:
        "Esta propuesta tiene una vigencia de {vigencia}. Los precios están expresados en la moneda indicada. " +
        "Para activar el servicio, favor de confirmar por escrito la aceptación de esta propuesta.",
    },
  });

  console.log(`   ✓ Empresa: ${empresa.nombre}\n`);

  // ──────────────────────────────────────────
  // 2. TIPOS DE COTIZACIÓN
  // ──────────────────────────────────────────
  console.log("📂 Creando tipos de cotización...");

  const tipos = await Promise.all([
    prisma.tipoCotizacion.upsert({
      where: { id: "10000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "10000000-0000-0000-0000-000000000001",
        nombre: "Proyecto Fijo",
        descripcion:
          "Desarrollo de software a precio fijo. Alcance, entregables y tiempos definidos al inicio.",
        activo: true,
      },
    }),
    prisma.tipoCotizacion.upsert({
      where: { id: "10000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "10000000-0000-0000-0000-000000000002",
        nombre: "SEC Plan",
        descripcion:
          "Suscripción mensual recurrente de servicios de software. Facturación periódica.",
        activo: true,
      },
    }),
    prisma.tipoCotizacion.upsert({
      where: { id: "10000000-0000-0000-0000-000000000003" },
      update: {},
      create: {
        id: "10000000-0000-0000-0000-000000000003",
        nombre: "Soporte",
        descripcion:
          "Servicios de soporte técnico y mantenimiento. Puede ser por horas o mensual.",
        activo: true,
      },
    }),
    prisma.tipoCotizacion.upsert({
      where: { id: "10000000-0000-0000-0000-000000000004" },
      update: {},
      create: {
        id: "10000000-0000-0000-0000-000000000004",
        nombre: "TrackPoint",
        descripcion:
          "Licencia de plataforma TrackPoint. Cuota mensual por usuarios/módulos activos.",
        activo: true,
      },
    }),
  ]);

  tipos.forEach((t) => console.log(`   ✓ ${t.nombre}`));
  console.log();

  // ──────────────────────────────────────────
  // 3. CONDICIONES COMERCIALES
  // ──────────────────────────────────────────
  console.log("💳 Creando condiciones comerciales...");

  const condiciones = await Promise.all([
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000001",
        nombre: "Contado",
        dias_credito: 0,
        descripcion: "Pago al momento de la aceptación de la propuesta.",
        activo: true,
      },
    }),
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000002",
        nombre: "15 días",
        dias_credito: 15,
        descripcion: "Pago a 15 días naturales a partir de la fecha de factura.",
        activo: true,
      },
    }),
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000003" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000003",
        nombre: "30 días",
        dias_credito: 30,
        descripcion: "Pago a 30 días naturales a partir de la fecha de factura.",
        activo: true,
      },
    }),
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000004" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000004",
        nombre: "60 días",
        dias_credito: 60,
        descripcion: "Pago a 60 días naturales a partir de la fecha de factura.",
        activo: true,
      },
    }),
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000005" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000005",
        nombre: "50% inicio / 50% entrega",
        dias_credito: null,
        descripcion:
          "50% al inicio del proyecto y 50% a la entrega final acordada.",
        activo: true,
      },
    }),
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000006" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000006",
        nombre: "Pago anticipado anual",
        dias_credito: null,
        descripcion:
          "Pago total anual por adelantado. Aplica descuento especial.",
        activo: true,
      },
    }),
    prisma.condicionComercial.upsert({
      where: { id: "20000000-0000-0000-0000-000000000007" },
      update: {},
      create: {
        id: "20000000-0000-0000-0000-000000000007",
        nombre: "30 días contra entrega",
        dias_credito: 30,
        descripcion:
          "Pago a 30 días una vez validada y aceptada la entrega del servicio.",
        activo: true,
      },
    }),
  ]);

  condiciones.forEach((c) => console.log(`   ✓ ${c.nombre}`));
  console.log();

  // ──────────────────────────────────────────
  // 4. CLIENTES DEMO  (solo con --demo)
  // ──────────────────────────────────────────
  if (SEED_DEMO) {
  console.log("👥 Creando clientes demo...");

  const clientes = await Promise.all([
    prisma.cliente.upsert({
      where: { rfc: "TCM210501AB3" },
      update: {},
      create: {
        id: "30000000-0000-0000-0000-000000000001",
        nombre: "TechCorp México S.A. de C.V.",
        rfc: "TCM210501AB3",
        contacto: "Carlos Mendoza",
        ciudad: "Ciudad de México",
        email: "carlos.mendoza@techcorp.mx",
        telefono: "+52 55 9876 5432",
        condicion_pago_id: "20000000-0000-0000-0000-000000000005", // 50/50
        notas:
          "Cliente clave — proyectos de transformación digital. Contacto técnico: Luis Flores (luis@techcorp.mx).",
        activo: true,
      },
    }),
    prisma.cliente.upsert({
      where: { rfc: "DNO180312CD4" },
      update: {},
      create: {
        id: "30000000-0000-0000-0000-000000000002",
        nombre: "Distribuidora Norte S.A. de C.V.",
        rfc: "DNO180312CD4",
        contacto: "María Gómez",
        ciudad: "Monterrey",
        email: "mgomez@disnorte.com.mx",
        telefono: "+52 81 2345 6789",
        condicion_pago_id: "20000000-0000-0000-0000-000000000003", // 30 días
        notas:
          "Cliente de soporte recurrente. Prefiere comunicación por WhatsApp.",
        activo: true,
      },
    }),
    prisma.cliente.upsert({
      where: { rfc: "SIB190823EF5" },
      update: {},
      create: {
        id: "30000000-0000-0000-0000-000000000003",
        nombre: "Servicios Integrales del Bajío S.C.",
        rfc: "SIB190823EF5",
        contacto: "Roberto Jiménez",
        ciudad: "Guadalajara",
        email: "roberto.jimenez@sibajio.com",
        telefono: "+52 33 8765 4321",
        condicion_pago_id: "20000000-0000-0000-0000-000000000001", // Contado
        notas: null,
        activo: true,
      },
    }),
  ]);

  clientes.forEach((c) => console.log(`   ✓ ${c.nombre} (${c.rfc})`));

  // Prospecto demo (REQ-02): alta rápida desde el pipeline, sin datos fiscales aún
  await prisma.cliente.upsert({
    where: { id: "30000000-0000-0000-0000-000000000009" },
    update: {},
    create: {
      id: "30000000-0000-0000-0000-000000000009",
      nombre: "Innovatec Soluciones (prospecto)",
      contacto: "Laura Méndez",
      ciudad: "",
      email: "laura@innovatec.mx",
      telefono: "+52 55 4444 3333",
      condicion_pago_id: "20000000-0000-0000-0000-000000000001",
      estatus: "PROSPECTO",
      activo: true,
    },
  });
  console.log("   ✓ Innovatec Soluciones (PROSPECTO)");
  console.log();

  // ──────────────────────────────────────────
  // 5. ÓRDENES DEMO
  // ──────────────────────────────────────────
  console.log("📦 Creando órdenes de venta demo...");

  // Orden 1: Proyecto Fijo — VENTA — MXN
  const orden1 = await prisma.ordenVenta.upsert({
    where: { folio: "NS00001" },
    update: {},
    create: {
      folio: "NS00001",
      cliente_id: "30000000-0000-0000-0000-000000000001",
      tipo_cotizacion_id: "10000000-0000-0000-0000-000000000001", // Proyecto Fijo
      condicion_pago_id: "20000000-0000-0000-0000-000000000005",  // 50/50
      descripcion: "Desarrollo de portal web corporativo con CMS personalizado",
      estatus: EstatusOrden.VENTA,
      moneda: Moneda.MXN,
      fecha_venta: new Date("2026-02-15"),
      vigencia: new Date("2026-02-28"),
      aplica_iva: true,
      tasa_iva: 16.00,
      descuento_porcentaje: null,
      subtotal: 150000.00,
      monto_descuento: 0.00,
      subtotal_con_descuento: 150000.00,
      monto_iva: 24000.00,
      total: 174000.00,
      total_mxn: 174000.00,
      notas: "Proyecto aprobado en reunión del 15 de febrero. Inicio: 1 de marzo.",
      partidas: {
        create: [
          {
            descripcion: "Diseño UX/UI del portal (wireframes + prototipo interactivo)",
            cantidad: 1,
            precio_unitario: 35000.00,
            total_partida: 35000.00,
            orden_display: 1,
          },
          {
            descripcion: "Desarrollo frontend (React + Next.js)",
            cantidad: 1,
            precio_unitario: 65000.00,
            total_partida: 65000.00,
            orden_display: 2,
          },
          {
            descripcion: "Desarrollo backend + API + CMS",
            cantidad: 1,
            precio_unitario: 45000.00,
            total_partida: 45000.00,
            orden_display: 3,
          },
          {
            descripcion: "Capacitación y documentación",
            cantidad: 1,
            precio_unitario: 5000.00,
            total_partida: 5000.00,
            orden_display: 4,
          },
        ],
      },
    },
  });

  // Orden 2: SEC Plan — COTIZADO — USD
  const orden2 = await prisma.ordenVenta.upsert({
    where: { folio: "NS00002" },
    update: {},
    create: {
      folio: "NS00002",
      cliente_id: "30000000-0000-0000-0000-000000000001",
      tipo_cotizacion_id: "10000000-0000-0000-0000-000000000002", // SEC Plan
      condicion_pago_id: "20000000-0000-0000-0000-000000000001",  // Contado
      descripcion: "SEC Plan mensual — módulos: CRM + Inventario + Reportes",
      estatus: EstatusOrden.COTIZADO,
      moneda: Moneda.USD,
      tipo_cambio: 17.15,
      vigencia: new Date("2026-05-15"),
      aplica_iva: false,
      descuento_porcentaje: 10.00,
      descuento_descripcion: "Descuento por contrato anual",
      subtotal: 2400.00,
      monto_descuento: 240.00,
      subtotal_con_descuento: 2160.00,
      monto_iva: 0.00,
      total: 2160.00,
      total_mxn: 37044.00, // 2160 * 17.15
      notas: "Propuesta enviada por correo el 15 de abril.",
      partidas: {
        create: [
          {
            descripcion: "Licencia SEC Plan — módulo CRM",
            cantidad: 1,
            precio_unitario: 800.00,
            total_partida: 800.00,
            orden_display: 1,
          },
          {
            descripcion: "Licencia SEC Plan — módulo Inventario",
            cantidad: 1,
            precio_unitario: 900.00,
            total_partida: 900.00,
            orden_display: 2,
          },
          {
            descripcion: "Licencia SEC Plan — módulo Reportes Avanzados",
            cantidad: 1,
            precio_unitario: 700.00,
            total_partida: 700.00,
            orden_display: 3,
          },
        ],
      },
    },
  });

  // Orden 3: Soporte — BORRADOR — MXN
  const orden3 = await prisma.ordenVenta.upsert({
    where: { folio: "NS00003" },
    update: {},
    create: {
      folio: "NS00003",
      cliente_id: "30000000-0000-0000-0000-000000000002",
      tipo_cotizacion_id: "10000000-0000-0000-0000-000000000003", // Soporte
      condicion_pago_id: "20000000-0000-0000-0000-000000000003",  // 30 días
      descripcion: "Soporte técnico mensual — sistema de facturación",
      estatus: EstatusOrden.BORRADOR,
      moneda: Moneda.MXN,
      vigencia: new Date("2026-05-30"),
      aplica_iva: true,
      tasa_iva: 16.00,
      subtotal: 8000.00,
      monto_descuento: 0.00,
      subtotal_con_descuento: 8000.00,
      monto_iva: 1280.00,
      total: 9280.00,
      total_mxn: 9280.00,
      partidas: {
        create: [
          {
            descripcion: "Soporte técnico mensual (hasta 10 tickets)",
            cantidad: 1,
            precio_unitario: 6000.00,
            total_partida: 6000.00,
            orden_display: 1,
          },
          {
            descripcion: "Actualizaciones de seguridad y mantenimiento preventivo",
            cantidad: 1,
            precio_unitario: 2000.00,
            total_partida: 2000.00,
            orden_display: 2,
          },
        ],
      },
    },
  });

  // Orden 4: TrackPoint — VENTA — MXN
  const orden4 = await prisma.ordenVenta.upsert({
    where: { folio: "NS00004" },
    update: {},
    create: {
      folio: "NS00004",
      cliente_id: "30000000-0000-0000-0000-000000000003",
      tipo_cotizacion_id: "10000000-0000-0000-0000-000000000004", // TrackPoint
      condicion_pago_id: "20000000-0000-0000-0000-000000000001",  // Contado
      descripcion: "TrackPoint — licencia mensual plataforma gestión de flota",
      estatus: EstatusOrden.VENTA,
      moneda: Moneda.MXN,
      fecha_venta: new Date("2026-03-01"),
      vigencia: new Date("2026-03-31"),
      aplica_iva: true,
      tasa_iva: 16.00,
      subtotal: 12500.00,
      monto_descuento: 0.00,
      subtotal_con_descuento: 12500.00,
      monto_iva: 2000.00,
      total: 14500.00,
      total_mxn: 14500.00,
      notas: "Renovación automática mensual.",
      partidas: {
        create: [
          {
            descripcion: "TrackPoint — licencia mensual (hasta 50 unidades)",
            cantidad: 1,
            precio_unitario: 10000.00,
            total_partida: 10000.00,
            orden_display: 1,
          },
          {
            descripcion: "TrackPoint — módulo reportes gerenciales",
            cantidad: 1,
            precio_unitario: 2500.00,
            total_partida: 2500.00,
            orden_display: 2,
          },
        ],
      },
    },
  });

  console.log(`   ✓ ${orden1.folio} — ${orden1.descripcion.substring(0, 40)}...`);
  console.log(`   ✓ ${orden2.folio} — ${orden2.descripcion.substring(0, 40)}...`);
  console.log(`   ✓ ${orden3.folio} — ${orden3.descripcion.substring(0, 40)}...`);
  console.log(`   ✓ ${orden4.folio} — ${orden4.descripcion.substring(0, 40)}...`);
  console.log();

  // Actualizar siguiente_folio a 5 (ya usamos NS00001–NS00004)
  await prisma.empresa.update({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    data: { siguiente_folio: 5 },
  });
  } // fin demo clientes/órdenes

  // ──────────────────────────────────────────
  // 6. MÓDULO PIPELINE CRM
  // ──────────────────────────────────────────
  console.log("\n🧭 Sembrando módulo Pipeline CRM (config: vendedores + etapas)...");

  // 6.1 Vendedores (dueños de los deals)
  const vendedores = await Promise.all([
    prisma.vendedor.upsert({
      where: { id: "40000000-0000-0000-0000-000000000001" },
      update: {},
      create: { id: "40000000-0000-0000-0000-000000000001", nombre: "Roldán Ayala", email: "roldan@newsoft.mx", activo: true },
    }),
    prisma.vendedor.upsert({
      where: { id: "40000000-0000-0000-0000-000000000002" },
      update: {},
      create: { id: "40000000-0000-0000-0000-000000000002", nombre: "Gabriela García", email: "gabriela@newsoft.mx", activo: true },
    }),
    prisma.vendedor.upsert({
      where: { id: "40000000-0000-0000-0000-000000000003" },
      update: {},
      create: { id: "40000000-0000-0000-0000-000000000003", nombre: "Frania Padilla", email: "frania@newsoft.mx", activo: true },
    }),
  ]);

  // 6.2 Stages configurables del pipeline (secuencia actual de Roldán)
  const stagesDef = [
    { id: "50000000-0000-0000-0000-000000000001", nombre: "Leads", orden: 1, color: "#9BA5BE", probabilidad_base: 10 },
    { id: "50000000-0000-0000-0000-000000000002", nombre: "Calificado", orden: 2, color: "#4A90D9", probabilidad_base: 25 },
    { id: "50000000-0000-0000-0000-000000000003", nombre: "Req. Definidos", orden: 3, color: "#F5A623", probabilidad_base: 40 },
    { id: "50000000-0000-0000-0000-000000000004", nombre: "Propuesta", orden: 4, color: "#F47920", probabilidad_base: 60 },
    { id: "50000000-0000-0000-0000-000000000005", nombre: "Negociación", orden: 5, color: "#E8330A", probabilidad_base: 80 },
    { id: "50000000-0000-0000-0000-000000000006", nombre: "Cierre del Mes", orden: 6, color: "#1D9E75", probabilidad_base: 95 },
  ];
  const stages = await Promise.all(
    stagesDef.map((s) =>
      prisma.pipelineStage.upsert({
        where: { id: s.id },
        update: { nombre: s.nombre, orden: s.orden, color: s.color, probabilidad_base: s.probabilidad_base },
        create: { ...s, activo: true },
      })
    )
  );

  // "Pausados" dejó de ser etapa (ahora es el estado SUSPENDIDO). Desactivar la etapa legacy.
  await prisma.pipelineStage.updateMany({
    where: { id: "50000000-0000-0000-0000-000000000007" },
    data: { activo: false },
  });

  // 6.3+ Deals / contactos / bitácora / tareas DEMO (solo con --demo)
  if (SEED_DEMO) {
  // Helper: fecha hace N días (para "días en etapa")
  const hace = (dias: number) => new Date(Date.now() - dias * 86400000);

  // 6.3 Deals demo a lo largo del pipeline
  const dealsDef = [
    { id: "60000000-0000-0000-0000-000000000001", nombre: "Portal de Proveedores", cliente: "30000000-0000-0000-0000-000000000001", stage: 3, vend: 0, tipo: "10000000-0000-0000-0000-000000000001", temp: "MUY_CALIENTE", valor: 950000, setup: 150000, mensualidad: 0, prob: 65, dias: 2, canal: "Referido interno", origen: "Referido" },
    { id: "60000000-0000-0000-0000-000000000002", nombre: "Suite Operativa — Calificación de Leads", cliente: "30000000-0000-0000-0000-000000000002", stage: 5, vend: 0, tipo: "10000000-0000-0000-0000-000000000004", temp: "MUY_CALIENTE", valor: 650000, setup: 25000, mensualidad: 15000, prob: 78, dias: 1, canal: "WhatsApp API", origen: "Inbound web" },
    { id: "60000000-0000-0000-0000-000000000003", nombre: "Sistema de Cotizaciones", cliente: "30000000-0000-0000-0000-000000000003", stage: 2, vend: 1, tipo: "10000000-0000-0000-0000-000000000001", temp: "TIBIO", valor: 380000, setup: 380000, mensualidad: 0, prob: 30, dias: 7, canal: "Llamada", origen: "Prospección" },
    { id: "60000000-0000-0000-0000-000000000004", nombre: "Soporte Anual Plataforma", cliente: "30000000-0000-0000-0000-000000000002", stage: 6, vend: 0, tipo: "10000000-0000-0000-0000-000000000003", temp: "CALIENTE", valor: 240000, setup: 0, mensualidad: 20000, prob: 85, dias: 0, canal: "Email", origen: "Cliente actual" },
    { id: "60000000-0000-0000-0000-000000000005", nombre: "TrackPoint Flota", cliente: "30000000-0000-0000-0000-000000000001", stage: 1, vend: 2, tipo: "10000000-0000-0000-0000-000000000004", temp: "FRIO", valor: 180000, setup: 0, mensualidad: 12000, prob: 15, dias: 14, canal: "Email", origen: "Inbound web" },
    { id: "60000000-0000-0000-0000-000000000006", nombre: "ERP Manufactura (en pausa)", cliente: "30000000-0000-0000-0000-000000000003", stage: 5, vend: 1, tipo: "10000000-0000-0000-0000-000000000001", temp: "MUY_FRIO", valor: 1800000, setup: 1800000, mensualidad: 0, prob: 10, dias: 45, canal: "Llamada", origen: "Prospección" },
  ];

  const deals = await Promise.all(
    dealsDef.map((d) =>
      prisma.deal.upsert({
        where: { id: d.id },
        update: {},
        create: {
          id: d.id,
          nombre: d.nombre,
          cliente_id: d.cliente,
          vendedor_id: vendedores[d.vend].id,
          stage_id: stages[d.stage - 1].id,
          tipo_cotizacion_id: d.tipo,
          temperatura: d.temp as never,
          probabilidad: d.prob,
          moneda: "MXN",
          valor: d.valor,
          setup: d.setup || null,
          mensualidad: d.mensualidad || null,
          meses: d.mensualidad ? 12 : null,
          canal: d.canal,
          origen: d.origen,
          fecha_cierre_estimada: new Date("2026-06-30"),
          fecha_entrada_stage: hace(d.dias),
          resultado: "ABIERTO",
        },
      })
    )
  );

  // Deal 006 queda SUSPENDIDO (demo de la columna Pausados)
  await prisma.deal.update({
    where: { id: "60000000-0000-0000-0000-000000000006" },
    data: { resultado: "SUSPENDIDO", stage_id: stages[4].id },
  }).catch(() => {});

  // 6.4 Contactos + bitácora demo en el deal "Suite Operativa"
  const dealDemo = "60000000-0000-0000-0000-000000000002";
  await prisma.dealContacto.upsert({
    where: { id: "61000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "61000000-0000-0000-0000-000000000001", deal_id: dealDemo, nombre: "Irvin Álvarez", rol: "DECISOR", email: "irvin@cliente.mx", telefono: "+52 81 1111 2222", whatsapp: "+52 81 1111 2222" },
  });
  await prisma.dealContacto.upsert({
    where: { id: "61000000-0000-0000-0000-000000000002" },
    update: {},
    create: { id: "61000000-0000-0000-0000-000000000002", deal_id: dealDemo, nombre: "Marcela Robles", rol: "INFLUENCIADOR", email: "marcela@cliente.mx" },
  });
  await prisma.dealActividad.upsert({
    where: { id: "62000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "62000000-0000-0000-0000-000000000001", deal_id: dealDemo, tipo: "NOTA", autor: "Roldán Ayala", contenido: "Irvin confirmó presupuesto aprobado para Q2. Piden integración con Salesforce. Siguiente paso: enviar adenda esta semana." },
  });
  await prisma.dealActividad.upsert({
    where: { id: "62000000-0000-0000-0000-000000000002" },
    update: {},
    create: { id: "62000000-0000-0000-0000-000000000002", deal_id: dealDemo, tipo: "LLAMADA", autor: "Gabriela García", contenido: "Llamada 32 min con Irvin. Dudas sobre modelo de consumo por conversación. Interés alto, pide referencias." },
  });

  // 6.5 Tareas pendientes (alimentan el inbox "Mis acciones")
  const enDias = (d: number) => new Date(Date.now() + d * 86400000);
  const tareasDef = [
    { id: "63000000-0000-0000-0000-000000000001", deal: "60000000-0000-0000-0000-000000000002", tipo: "EMAIL", texto: "Enviar adenda con módulo Salesforce a Irvin Álvarez", dias: 0 },
    { id: "63000000-0000-0000-0000-000000000002", deal: "60000000-0000-0000-0000-000000000001", tipo: "LLAMADA", texto: "Confirmar reunión con TI para validación técnica de integración", dias: 1 },
    { id: "63000000-0000-0000-0000-000000000003", deal: "60000000-0000-0000-0000-000000000004", tipo: "LLAMADA", texto: "Agendar llamada de cierre antes del 30 de junio", dias: 5 },
    { id: "63000000-0000-0000-0000-000000000004", deal: "60000000-0000-0000-0000-000000000003", tipo: "EMAIL", texto: "Compartir caso de éxito de implementación similar", dias: 6 },
  ];
  await Promise.all(
    tareasDef.map((t) =>
      prisma.dealActividad.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          deal_id: t.deal,
          tipo: t.tipo as never,
          autor: "Roldán Ayala",
          contenido: t.texto,
          es_tarea: true,
          completada: false,
          fecha_tarea: enDias(t.dias),
        },
      })
    )
  );

  console.log(`   ✓ ${deals.length} deals demo, ${tareasDef.length} tareas`);
  } // fin demo CRM (deals/bitácora/tareas)

  console.log("✅ Seed completado exitosamente!\n");
  console.log("📊 Resumen (config):");
  console.log(`   - 2 usuarios (roldan@newsoft.mx, elva@newsoft.mx)`);
  console.log(`   - 1 empresa configurada`);
  console.log(`   - ${tipos.length} tipos de cotización`);
  console.log(`   - ${condiciones.length} condiciones comerciales`);
  console.log(`   - ${vendedores.length} vendedores, ${stages.length} etapas de pipeline`);
  console.log(SEED_DEMO ? "   + datos DEMO (clientes, órdenes, deals, bitácora)" : "   (sin datos demo — usa --demo para sembrarlos)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error en seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
