/**
 * @juegosemi/personajes — el catálogo: los DATOS de verdad, cargados y revisados.
 *
 * Es la puerta por la que entra todo el contenido del paquete (plantilla, paletas,
 * animaciones, caras, personajes, visemas). Los JSON viven en `data/` y se
 * importan tal cual: son datos, no código, así que se editan escribiendo texto.
 *
 * Al cargar se VALIDA todo. Si algo está mal, no se revienta a mitad del juego:
 * se junta la lista de problemas (`problemasDeDatos()`) y los accesores devuelven
 * null mientras el contenido esté roto. El test `datos.test.ts` exige que esa
 * lista esté vacía, así que un JSON mal escrito se caza en la suite, no en la tablet.
 */

import carasBrutos from '../data/caras.json';
import paletasBrutas from '../data/paletas.json';
import personajesBrutos from '../data/personajes.json';
import plantillaBruta from '../data/plantilla-humano.json';
import posesBrutas from '../data/poses.json';
import visemasBrutos from '../data/visemas.json';
import { armar, Rig } from './rig.ts';
import type {
  Animacion,
  CatalogoCaras,
  Paleta,
  PersonajeDatos,
  PlantillaRig,
  ResultadoValidacion,
  TablaVisemas,
} from './tipo.ts';
import {
  validarAnimacion,
  validarCatalogoCaras,
  validarCoherenciaPersonaje,
  validarPaleta,
  validarPersonaje,
  validarPlantilla,
  validarTablaVisemas,
} from './validar.ts';

export interface Catalogo {
  plantillas: PlantillaRig[];
  paletas: Paleta[];
  animaciones: Animacion[];
  caras: CatalogoCaras[];
  personajes: PersonajeDatos[];
  visemas: TablaVisemas;
}

/** Saca la lista de adentro de un JSON con forma `{ "<campo>": [...] }`. */
function listaDe(dato: unknown, campo: string): unknown[] {
  if (typeof dato !== 'object' || dato === null) return [];
  const lista = (dato as Record<string, unknown>)[campo];
  return Array.isArray(lista) ? lista : [];
}

function validarTodos<T>(
  brutos: unknown[],
  validador: (dato: unknown) => ResultadoValidacion<T>,
  problemas: string[],
): T[] {
  const salida: T[] = [];
  brutos.forEach((bruto, i) => {
    const r = validador(bruto);
    if (r.ok && r.valor !== undefined) {
      salida.push(r.valor);
    } else {
      for (const error of r.errores) problemas.push(`[${i}] ${error}`);
    }
  });
  return salida;
}

interface Construccion {
  catalogo: Catalogo | null;
  problemas: string[];
}

function construir(): Construccion {
  const problemas: string[] = [];

  const plantillas = validarTodos(listaDe({ plantillas: [plantillaBruta] }, 'plantillas'), validarPlantilla, problemas);
  const paletas = validarTodos(listaDe(paletasBrutas, 'paletas'), validarPaleta, problemas);
  const animaciones = validarTodos(listaDe(posesBrutas, 'animaciones'), validarAnimacion, problemas);
  const caras = validarTodos(listaDe(carasBrutos, 'catalogos'), validarCatalogoCaras, problemas);
  const personajes = validarTodos(listaDe(personajesBrutos, 'personajes'), validarPersonaje, problemas);
  const visemasResultado = validarTablaVisemas(visemasBrutos);
  if (!visemasResultado.ok || visemasResultado.valor === undefined) {
    problemas.push(...visemasResultado.errores.map((e) => `[visemas] ${e}`));
  }

  // Coherencia: cada personaje tiene que calzar con su plantilla y sus animaciones.
  const idsPlantillas = new Set(plantillas.map((p) => p.id));
  const idsPaletas = new Set(paletas.map((p) => p.id));
  const idsCaras = new Set(caras.map((c) => c.id));
  for (const personaje of personajes) {
    if (!idsPlantillas.has(personaje.plantilla)) {
      problemas.push(`personaje "${personaje.id}": usa la plantilla "${personaje.plantilla}", que no existe`);
      continue;
    }
    if (!idsPaletas.has(personaje.paleta)) {
      problemas.push(`personaje "${personaje.id}": usa la paleta "${personaje.paleta}", que no existe`);
    }
    if (personaje.cara !== undefined && !idsCaras.has(personaje.cara)) {
      problemas.push(`personaje "${personaje.id}": usa el catálogo de caras "${personaje.cara}", que no existe`);
    }
    const plantilla = plantillas.find((p) => p.id === personaje.plantilla);
    if (plantilla) problemas.push(...validarCoherenciaPersonaje(plantilla, personaje, animaciones));
  }

  if (problemas.length > 0 || visemasResultado.valor === undefined) {
    return { catalogo: null, problemas };
  }

  return {
    catalogo: {
      plantillas,
      paletas,
      animaciones,
      caras,
      personajes,
      visemas: visemasResultado.valor,
    },
    problemas: [],
  };
}

const CONSTRUIDO = construir();

/** Todo lo que está mal en los datos. Lista vacía = el contenido está sano. */
export function problemasDeDatos(): string[] {
  return [...CONSTRUIDO.problemas];
}

/** ¿Los datos cargaron sin un solo problema? */
export function datosSanos(): boolean {
  return CONSTRUIDO.problemas.length === 0;
}

function catalogo(): Catalogo | null {
  return CONSTRUIDO.catalogo;
}

export function plantillas(): PlantillaRig[] {
  const c = catalogo();
  return c ? c.plantillas : [];
}

export function plantillaPorId(id: string): PlantillaRig | null {
  const c = catalogo();
  if (!c) return null;
  return c.plantillas.find((p) => p.id === id) ?? null;
}

export function paletas(): Paleta[] {
  const c = catalogo();
  return c ? c.paletas : [];
}

export function paletaPorId(id: string): Paleta | null {
  const c = catalogo();
  if (!c) return null;
  return c.paletas.find((p) => p.id === id) ?? null;
}

export function animaciones(): Animacion[] {
  const c = catalogo();
  return c ? c.animaciones : [];
}

export function animacionPorId(id: string): Animacion | null {
  const c = catalogo();
  if (!c) return null;
  return c.animaciones.find((a) => a.id === id) ?? null;
}

export function catalogosDeCaras(): CatalogoCaras[] {
  const c = catalogo();
  return c ? c.caras : [];
}

export function catalogoDeCarasPorId(id: string): CatalogoCaras | null {
  const c = catalogo();
  if (!c) return null;
  return c.caras.find((k) => k.id === id) ?? null;
}

export function personajes(): PersonajeDatos[] {
  const c = catalogo();
  return c ? c.personajes : [];
}

export function personajePorId(id: string): PersonajeDatos | null {
  const c = catalogo();
  if (!c) return null;
  return c.personajes.find((p) => p.id === id) ?? null;
}

export function tablaVisemas(): TablaVisemas | null {
  const c = catalogo();
  return c ? c.visemas : null;
}

/** Las animaciones que trae puestas un personaje, en orden. */
export function animacionesDePersonaje(personaje: PersonajeDatos): Animacion[] {
  const salida: Animacion[] = [];
  for (const id of personaje.animaciones ?? []) {
    const animacion = animacionPorId(id);
    if (animacion) salida.push(animacion);
  }
  return salida;
}

/**
 * Arma el rig de un personaje del catálogo, ya con su paleta y sus rasgos.
 * Devuelve null si los datos están rotos o el personaje no existe.
 */
export function armarPersonaje(
  idPersonaje: string,
  opciones: { contorno?: boolean; paleta?: string } = {},
): Rig | null {
  const personaje = personajePorId(idPersonaje);
  if (!personaje) return null;
  const plantilla = plantillaPorId(personaje.plantilla);
  if (!plantilla) return null;
  const paleta = paletaPorId(opciones.paleta ?? personaje.paleta);
  if (!paleta) return null;
  return armar(plantilla, paleta, personaje, { contorno: opciones.contorno === true });
}

/**
 * Arma el rig "pelado" de una plantilla, con su paleta (para el taller de
 * personajes, cuando todavía no hay personaje elegido).
 */
export function armarPlantilla(idPlantilla: string, idPaleta: string, contorno = false): Rig | null {
  const plantilla = plantillaPorId(idPlantilla);
  const paleta = paletaPorId(idPaleta);
  if (!plantilla || !paleta) return null;
  return armar(plantilla, paleta, null, { contorno });
}

/** El catálogo completo (null si los datos tienen problemas). */
export function contenido(): Catalogo | null {
  return catalogo();
}
