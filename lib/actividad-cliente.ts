// Cliente HTTP de una actividad: los endpoints en un solo lugar.
//
// La bitácora y la agenda hacen las MISMAS operaciones (marcar Listo, destacar,
// reprogramar, borrar). Con el fetch escrito en cada pantalla, la URL y la forma del body
// se repetían y podían divergir al cambiar el endpoint.
import type { DealActividadItem } from "@/types/crm";

/** Lo que devuelve el PATCH: la actividad ya serializada (+ efectos del termómetro). */
export interface RespuestaActividad {
  actividad: DealActividadItem;
  temperatura?: string;
  sugerir_avance?: boolean;
  avanzo_etapa?: boolean;
}

export type CamposActividad = {
  completada?: boolean;
  destacada?: boolean;
  fecha_tarea?: string;
  resultado_id?: string;
};

export async function patchActividad(id: string, campos: CamposActividad): Promise<RespuestaActividad> {
  const res = await fetch(`/api/crm/actividades/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(campos),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "No se pudo actualizar la actividad.");
  return data as RespuestaActividad;
}

export async function borrarActividad(id: string): Promise<void> {
  const res = await fetch(`/api/crm/actividades/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("No se pudo eliminar la entrada.");
}
