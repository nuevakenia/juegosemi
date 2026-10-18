/**
 * El validador de los datos del nivel.
 *
 * Un nivel mal escrito (un `requiere` que apunta a una misión que no existe, un ciclo
 * de requisitos, una acción que no conocemos) NO tiene que reventar en mitad de la
 * partida: se detecta al cargar y se dice QUÉ campo y QUÉ valor está mal. Es la misma
 * regla que ya usa el contenido de la familia.
 */
import type { Accion, Condicion, Nivel } from './tipo.ts';

export interface ResultadoValidacion {
  ok: boolean;
  errores: string[];
}

/** Los gestos que el sistema sabe reconocer (los adaptadores los implementan). */
export const GESTOS_CONOCIDOS = ['toque_repetido', 'mantener', 'circulo', 'direccion', 'deslizar', 'sacudir', 'palabra'];

const ACCIONES_CONOCIDAS = [
  'marcar', 'sumar', 'activar', 'desactivar', 'pedir_gesto', 'cancelar_gesto', 'completar', 'terminar_nivel',
  'mostrar', 'ocultar', 'mover', 'animar', 'escalar', 'decir', 'sonar', 'detener_sonido',
  'reproducir_video', 'mostrar_mensaje', 'celebrar', 'esperar',
];

function nombreDeAccion(accion: Accion): string {
  if (typeof accion === 'string') {
    const abre = accion.indexOf('(');
    return (abre === -1 ? accion : accion.slice(0, abre)).trim();
  }
  return accion.tipo;
}

/** Revisa una condición y junta los problemas con el camino donde estaban. */
function revisarCondicion(condicion: Condicion | undefined, camino: string, errores: string[]): void {
  if (condicion === undefined) return;
  const c = condicion as Record<string, unknown>;

  if (Array.isArray(c['y'])) {
    (c['y'] as Condicion[]).forEach((hija, i) => revisarCondicion(hija, `${camino}.y[${i}]`, errores));
    return;
  }
  if (Array.isArray(c['o'])) {
    (c['o'] as Condicion[]).forEach((hija, i) => revisarCondicion(hija, `${camino}.o[${i}]`, errores));
    return;
  }
  if (c['no'] !== undefined) {
    revisarCondicion(c['no'] as Condicion, `${camino}.no`, errores);
    return;
  }

  const conocidas = ['activo', 'variable', 'contador', 'evento', 'zona', 'mision', 'paso', 'gesto', 'toco'];
  const tiene = conocidas.some((clave) => c[clave] !== undefined);
  if (!tiene) {
    errores.push(`${camino}: no sé qué condición es (campos: ${Object.keys(c).join(', ') || 'ninguno'})`);
  }
}

function revisarAccion(accion: Accion, camino: string, errores: string[]): void {
  const nombre = nombreDeAccion(accion);
  if (!ACCIONES_CONOCIDAS.includes(nombre)) {
    errores.push(`${camino}: acción desconocida "${nombre}"`);
  }
  if (nombre === 'pedir_gesto') {
    const gesto = typeof accion === 'string' ? extraerArgs(accion)[0] : accion.gesto;
    if (gesto !== undefined && !GESTOS_CONOCIDOS.includes(gesto)) {
      errores.push(`${camino}: gesto desconocido "${gesto}" (los que hay: ${GESTOS_CONOCIDOS.join(', ')})`);
    }
  }
}

function extraerArgs(accion: string): string[] {
  const abre = accion.indexOf('(');
  if (abre === -1 || !accion.endsWith(')')) return [];
  return accion
    .slice(abre + 1, -1)
    .split(',')
    .map((a) => a.trim());
}

/** ¿Hay un ciclo en los prerrequisitos? (A requiere B y B requiere A). */
function hayCiclo(nivel: Nivel): string | null {
  const porId = new Map((nivel.misiones ?? []).map((m) => [m.id, m]));
  const visitando = new Set<string>();
  const listos = new Set<string>();

  const visitar = (id: string): string | null => {
    if (listos.has(id)) return null;
    if (visitando.has(id)) return id;
    visitando.add(id);
    for (const requiere of porId.get(id)?.requiere ?? []) {
      const ciclo = visitar(requiere);
      if (ciclo !== null) return ciclo;
    }
    visitando.delete(id);
    listos.add(id);
    return null;
  };

  for (const mision of nivel.misiones ?? []) {
    const ciclo = visitar(mision.id);
    if (ciclo !== null) return ciclo;
  }
  return null;
}

export function validarNivel(nivel: Nivel): ResultadoValidacion {
  const errores: string[] = [];

  if (typeof nivel.id !== 'string' || nivel.id.trim() === '') {
    errores.push('id: el nivel necesita un id (texto, no vacío)');
  }
  if (!Array.isArray(nivel.reglas)) {
    errores.push('reglas: tiene que ser una lista');
    return { ok: false, errores };
  }

  const idsReglas = new Set<string>();
  nivel.reglas.forEach((regla, i) => {
    const camino = `reglas[${i}]`;
    if (typeof regla.id !== 'string' || regla.id.trim() === '') {
      errores.push(`${camino}: sin id (cada regla necesita uno para poder seguirla)`);
    } else if (idsReglas.has(regla.id)) {
      errores.push(`${camino}: el id "${regla.id}" está repetido`);
    } else {
      idsReglas.add(regla.id);
    }
    if (!Array.isArray(regla.hacer) || regla.hacer.length === 0) {
      errores.push(`${camino} (${regla.id}): no hace nada (falta "hacer")`);
    } else {
      regla.hacer.forEach((accion, j) => revisarAccion(accion, `${camino}.hacer[${j}]`, errores));
    }
    revisarCondicion(regla.si, `${camino}.si`, errores);
  });

  const idsMisiones = new Set<string>();
  (nivel.misiones ?? []).forEach((mision, i) => {
    const camino = `misiones[${i}]`;
    if (typeof mision.id !== 'string' || mision.id.trim() === '') {
      errores.push(`${camino}: sin id`);
    } else if (idsMisiones.has(mision.id)) {
      errores.push(`${camino}: el id "${mision.id}" está repetido`);
    } else {
      idsMisiones.add(mision.id);
    }
    revisarCondicion(mision.cumple, `${camino}.cumple`, errores);
    for (const requiere of mision.requiere ?? []) {
      if (!idsMisiones.has(requiere) && !(nivel.misiones ?? []).some((m) => m.id === requiere)) {
        errores.push(`${camino} (${mision.id}): requiere "${requiere}", que no existe`);
      }
    }
    (mision.recompensa ?? []).forEach((accion, j) =>
      revisarAccion(accion, `${camino}.recompensa[${j}]`, errores),
    );
  });

  const ciclo = hayCiclo(nivel);
  if (ciclo !== null) {
    errores.push(`misiones: hay un ciclo de prerrequisitos en "${ciclo}" (se piden entre ellas y nunca se puede empezar)`);
  }

  revisarCondicion(nivel.nivel_terminado, 'nivel_terminado', errores);

  return { ok: errores.length === 0, errores };
}
