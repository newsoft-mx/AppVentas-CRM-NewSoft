/**
 * Tipos de datos para el módulo de Configuración.
 * Reflejan los modelos de Prisma con los campos Decimal/Date
 * ya serializados como primitivos JS (para pasar de server a client components).
 */

export interface Empresa {
  id: string;
  nombre: string;
  nombre_comercial: string | null;
  rfc: string;
  direccion: string;
  email: string;
  telefono: string;
  prefijo_folio: string;
  siguiente_folio: number;
  vigencia_cotizacion_dias: number;
  aplicar_iva: boolean;
  tasa_iva: number;
  notas_documentos: string | null;
  created_at: string;
  updated_at: string;
}

export interface TipoCotizacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  texto_contrato: string | null;
  activo: boolean;
  created_at: string;
}

export interface CondicionComercial {
  id: string;
  nombre: string;
  dias_credito: number | null;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface Vendedor {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStageConfig {
  id: string;
  nombre: string;
  orden: number;
  color: string;
  activo: boolean;
  probabilidad_base: number;
  umbral_avance: string | null;
}
