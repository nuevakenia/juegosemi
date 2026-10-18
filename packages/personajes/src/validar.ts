/**
 * @juegosemi/personajes — validación de los DATOS del personaje.
 *
 * Igual que @juegosemi/contenido: si un JSON está mal, se dice QUÉ está mal y
 * DÓNDE, con el nombre del campo y el id de la pieza. Nada de "el personaje es
 * inválido" a secas, que eso no le sirve a nadie.
 *
 * Sin dependencias externas a propósito (validador propio, chico y testeado).
 */

import { esHexValido } from './color.ts';
import type {
  Animacion,
  CatalogoCaras,
  Paleta,
  PersonajeDatos,
  PiezaRig,
  PlantillaRig,
  Pose,
  RasgoPieza,
  ResultadoValidacion,
  TablaVisemas,
  Visema,
} from './tipo.ts';

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function esTextoNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function esNumeroFinito(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function texto(dato: Record<string, unknown>, campo: string, errores: string[], donde: string): string | undefined {
  const v = dato[campo];
  if (!esTextoNoVacio(v)) {
    errores.push(`${donde}: el campo "${campo}" debe ser un texto no vacío`);
    return undefined;
  }
  return v;
}

function textoOpcional(dato: Record<string, unknown>, campo: string, errores: string[], donde: string): string | undefined {
  const v = dato[campo];
  if (v === undefined || v === null) return undefined;
  if (!esTextoNoVacio(v)) {
    errores.push(`${donde}: el campo "${campo}" debe ser un texto no vacío`);
    return undefined;
  }
  return v;
}

function numeroOpcional(dato: Record<string, unknown>, campo: string, errores: string[], donde: string): number | undefined {
  const v = dato[campo];
  if (v === undefined || v === null) return undefined;
  if (!esNumeroFinito(v)) {
    errores.push(`${donde}: el campo "${campo}" debe ser un número`);
    return undefined;
  }
  return v;
}

/** Lee un {x, y} de los datos. `porDefecto` es lo que se usa si el campo no está. */
function desplazamiento(
  dato: Record<string, unknown>,
  campo: string,
  errores: string[],
  donde: string,
  porDefecto: { x: number; y: number } | null,
): { x: number; y: number } | undefined {
  const v = dato[campo];
  if (v === undefined || v === null) return porDefecto ?? undefined;
  if (!esObjeto(v)) {
    errores.push(`${donde}: el campo "${campo}" debe ser un objeto {x, y}`);
    return undefined;
  }
  const x = numeroOpcional(v, 'x', errores, `${donde}.${campo}`);
  const y = numeroOpcional(v, 'y', errores, `${donde}.${campo}`);
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

// ─── Piezas y plantilla ──────────────────────────────────────────────────────

function validarPieza(bruta: unknown, i: number, errores: string[]): PiezaRig | null {
  const donde = `piezas[${i}]`;
  if (!esObjeto(bruta)) {
    errores.push(`${donde}: debe ser un objeto`);
    return null;
  }
  const id = texto(bruta, 'id', errores, donde);
  const desplazamientoBase = desplazamiento(bruta, 'desplazamiento', errores, donde, null);
  const tamanoBruto = bruta['tamano'];
  if (!esObjeto(tamanoBruto)) {
    errores.push(`${donde}: falta el campo "tamano"`);
  }
  const pieza: PiezaRig = {
    id: id ?? '',
    desplazamiento: desplazamientoBase ?? { x: 0, y: 0 },
    tamano: { ancho: 0, alto: 0 },
  };

  if (esObjeto(tamanoBruto)) {
    const ancho = numeroOpcional(tamanoBruto, 'ancho', errores, `${donde}.tamano`);
    const alto = numeroOpcional(tamanoBruto, 'alto', errores, `${donde}.tamano`);
    if (ancho !== undefined && ancho <= 0) errores.push(`${donde}.tamano.ancho debe ser mayor que 0`);
    if (alto !== undefined && alto <= 0) errores.push(`${donde}.tamano.alto debe ser mayor que 0`);
    pieza.tamano = { ancho: ancho ?? 0, alto: alto ?? 0 };
  }

  const padre = bruta['padre'];
  if (padre !== undefined && padre !== null) {
    if (!esTextoNoVacio(padre)) errores.push(`${donde}: "padre" debe ser un id de pieza o null`);
    else if (padre === pieza.id) errores.push(`${donde}: la pieza "${pieza.id}" no puede ser su propio padre`);
    else pieza.padre = padre;
  }

  // El pivote tiene que caer DENTRO del rectángulo; si no, la pieza gira en el aire.
  const pivote = desplazamiento(bruta, 'pivote', errores, donde, null);
  if (pivote) {
    pieza.pivote = pivote;
    if (pivote.x < 0 || pivote.x > pieza.tamano.ancho || pivote.y < 0 || pivote.y > pieza.tamano.alto) {
      errores.push(`${donde}: el pivote (${pivote.x}, ${pivote.y}) se sale del rectángulo de "${pieza.id}"`);
    }
  }

  const escala = desplazamiento(bruta, 'escala', errores, donde, null);
  if (escala) {
    if (escala.x === 0 || escala.y === 0) errores.push(`${donde}: "escala" no puede tener un 0 (la pieza desaparecería)`);
    else pieza.escala = escala;
  }

  const grados = numeroOpcional(bruta, 'grados', errores, donde);
  if (grados !== undefined) pieza.grados = grados;

  const rol = textoOpcional(bruta, 'rol', errores, donde);
  if (rol) pieza.rol = rol;

  const color = textoOpcional(bruta, 'color', errores, donde);
  if (color) {
    if (!esHexValido(color)) errores.push(`${donde}: el color "${color}" no es un hex válido (#rrggbb)`);
    else pieza.color = color;
  }

  const textura = bruta['textura'];
  if (textura !== undefined && textura !== null) {
    if (!esTextoNoVacio(textura)) errores.push(`${donde}: "textura" debe ser un id de textura o null`);
    else pieza.textura = textura;
  }

  const orden = numeroOpcional(bruta, 'orden', errores, donde);
  if (orden !== undefined) pieza.orden = orden;

  const visible = bruta['visible'];
  if (visible !== undefined) {
    if (typeof visible !== 'boolean') errores.push(`${donde}: "visible" debe ser true o false`);
    else pieza.visible = visible;
  }

  return pieza;
}

/**
 * Valida una plantilla de rig completa: ids únicos, un solo árbol, sin ciclos,
 * y todas las piezas alcanzables desde la raíz.
 */
export function validarPlantilla(dato: unknown): ResultadoValidacion<PlantillaRig> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['la plantilla debe ser un objeto'] };

  const id = texto(dato, 'id', errores, 'plantilla');
  const nombre = texto(dato, 'nombre', errores, 'plantilla');

  const altoReferencia = numeroOpcional(dato, 'altoReferencia', errores, 'plantilla');
  if (altoReferencia === undefined) errores.push('plantilla: falta "altoReferencia"');
  else if (altoReferencia <= 0) errores.push('plantilla: "altoReferencia" debe ser mayor que 0');

  const piezasBrutas = dato['piezas'];
  const piezas: PiezaRig[] = [];
  const vistos = new Set<string>();
  if (!Array.isArray(piezasBrutas) || piezasBrutas.length === 0) {
    errores.push('plantilla.piezas debe ser una lista con al menos una pieza');
  } else {
    piezasBrutas.forEach((p, i) => {
      const pieza = validarPieza(p, i, errores);
      if (!pieza || !pieza.id) return;
      if (vistos.has(pieza.id)) {
        errores.push(`piezas[${i}]: id repetido "${pieza.id}"`);
        return;
      }
      vistos.add(pieza.id);
      piezas.push(pieza);
    });
  }

  const raiz = textoOpcional(dato, 'raiz', errores, 'plantilla');
  if (!raiz) errores.push('plantilla: falta "raiz"');
  else if (!vistos.has(raiz)) errores.push(`plantilla: la raíz "${raiz}" no existe entre las piezas`);

  // Todo padre tiene que existir.
  for (const pieza of piezas) {
    if (pieza.padre !== undefined && pieza.padre !== null && !vistos.has(pieza.padre)) {
      errores.push(`pieza "${pieza.id}": el padre "${pieza.padre}" no existe`);
    }
  }

  // Desde la raíz se tiene que llegar a TODAS las piezas (si no, hay un ciclo o
  // una pieza suelta que nunca se va a dibujar).
  if (raiz && vistos.has(raiz)) {
    const alcanzadas = new Set<string>();
    const porId = new Map(piezas.map((p) => [p.id, p]));
    const pila = [raiz];
    while (pila.length > 0) {
      const actual = pila.pop()!;
      if (alcanzadas.has(actual)) {
        errores.push(`la jerarquía tiene un ciclo en "${actual}"`);
        break;
      }
      alcanzadas.add(actual);
      for (const pieza of piezas) {
        if (pieza.padre === actual) pila.push(pieza.id);
      }
    }
    for (const pieza of piezas) {
      if (!alcanzadas.has(pieza.id)) {
        const padre = porId.get(pieza.id)?.padre;
        errores.push(`pieza "${pieza.id}": no se llega desde la raíz "${raiz}" (padre "${padre ?? '-'}")`);
      }
    }
  }

  if (errores.length > 0 || !id || !nombre || !raiz || altoReferencia === undefined) {
    return { ok: false, errores };
  }
  return { ok: true, valor: { id, nombre, altoReferencia, raiz, piezas }, errores: [] };
}

// ─── Personaje, rasgos y paleta ──────────────────────────────────────────────

function validarRasgo(bruto: unknown, idPieza: string, errores: string[]): RasgoPieza | null {
  const donde = `rasgos["${idPieza}"]`;
  if (!esObjeto(bruto)) {
    errores.push(`${donde}: debe ser un objeto`);
    return null;
  }
  const rasgo: RasgoPieza = {};
  const rol = textoOpcional(bruto, 'rol', errores, donde);
  if (rol) rasgo.rol = rol;
  const color = textoOpcional(bruto, 'color', errores, donde);
  if (color) {
    if (!esHexValido(color)) errores.push(`${donde}: el color "${color}" no es un hex válido (#rrggbb)`);
    else rasgo.color = color;
  }
  const textura = bruto['textura'];
  if (textura !== undefined && textura !== null) {
    if (!esTextoNoVacio(textura)) errores.push(`${donde}: "textura" debe ser un id de textura o null`);
    else rasgo.textura = textura;
  }
  const visible = bruto['visible'];
  if (visible !== undefined) {
    if (typeof visible !== 'boolean') errores.push(`${donde}: "visible" debe ser true o false`);
    else rasgo.visible = visible;
  }
  const grados = numeroOpcional(bruto, 'grados', errores, donde);
  if (grados !== undefined) rasgo.grados = grados;
  const des = desplazamiento(bruto, 'desplazamiento', errores, donde, null);
  if (des) rasgo.desplazamiento = des;
  const escala = desplazamiento(bruto, 'escala', errores, donde, null);
  if (escala) rasgo.escala = escala;
  return rasgo;
}

/** Valida un personaje (estructura). La coherencia con su plantilla se revisa aparte. */
export function validarPersonaje(dato: unknown): ResultadoValidacion<PersonajeDatos> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['el personaje debe ser un objeto'] };

  const id = texto(dato, 'id', errores, 'personaje');
  const nombre = texto(dato, 'nombre', errores, 'personaje');
  const plantilla = texto(dato, 'plantilla', errores, 'personaje');
  const paleta = texto(dato, 'paleta', errores, 'personaje');

  const rasgos: Record<string, RasgoPieza> = {};
  const rasgosBrutos = dato['rasgos'];
  if (rasgosBrutos !== undefined && rasgosBrutos !== null) {
    if (!esObjeto(rasgosBrutos)) {
      errores.push('personaje.rasgos debe ser un objeto {pieza: rasgo}');
    } else {
      for (const clave of Object.keys(rasgosBrutos)) {
        const rasgo = validarRasgo(rasgosBrutos[clave], clave, errores);
        if (rasgo) rasgos[clave] = rasgo;
      }
    }
  }

  const animaciones: string[] = [];
  const animacionesBrutas = dato['animaciones'];
  if (animacionesBrutas !== undefined && animacionesBrutas !== null) {
    if (!Array.isArray(animacionesBrutas)) {
      errores.push('personaje.animaciones debe ser una lista de ids');
    } else {
      animacionesBrutas.forEach((a, i) => {
        if (!esTextoNoVacio(a)) errores.push(`personaje.animaciones[${i}]: debe ser un id`);
        else animaciones.push(a);
      });
    }
  }

  if (errores.length > 0 || !id || !nombre || !plantilla || !paleta) {
    return { ok: false, errores };
  }
  const personaje: PersonajeDatos = { id, nombre, plantilla, paleta, rasgos };
  const cara = textoOpcional(dato, 'cara', errores, 'personaje');
  if (cara) personaje.cara = cara;
  if (animaciones.length > 0) personaje.animaciones = animaciones;
  if (errores.length > 0) return { ok: false, errores };
  return { ok: true, valor: personaje, errores: [] };
}

/**
 * Revisa que el personaje calce con su plantilla: que todos sus rasgos apunten
 * a piezas que existen, y que su animación de reposo exista.
 */
export function validarCoherenciaPersonaje(
  plantilla: PlantillaRig,
  personaje: PersonajeDatos,
  animaciones?: readonly Animacion[],
): string[] {
  const errores: string[] = [];
  const ids = new Set(plantilla.piezas.map((p) => p.id));
  if (personaje.rasgos) {
    for (const idPieza of Object.keys(personaje.rasgos)) {
      if (!ids.has(idPieza)) {
        errores.push(`personaje "${personaje.id}": el rasgo apunta a la pieza "${idPieza}", que no está en la plantilla "${plantilla.id}"`);
      }
    }
  }
  if (personaje.animaciones && animaciones) {
    const disponibles = new Set(animaciones.map((a) => a.id));
    for (const idAnimacion of personaje.animaciones) {
      if (!disponibles.has(idAnimacion)) {
        errores.push(`personaje "${personaje.id}": la animación "${idAnimacion}" no existe`);
      }
    }
  }
  return errores;
}

export function validarPaleta(dato: unknown): ResultadoValidacion<Paleta> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['la paleta debe ser un objeto'] };
  const id = texto(dato, 'id', errores, 'paleta');
  const nombre = texto(dato, 'nombre', errores, 'paleta');

  const colores: Record<string, string> = {};
  const coloresBrutos = dato['colores'];
  if (!esObjeto(coloresBrutos) || Object.keys(coloresBrutos).length === 0) {
    errores.push('paleta.colores debe ser un objeto con al menos un color');
  } else {
    for (const clave of Object.keys(coloresBrutos)) {
      const valor = coloresBrutos[clave];
      if (!esHexValido(valor)) errores.push(`paleta.colores["${clave}"]: "${String(valor)}" no es un hex válido (#rrggbb)`);
      else colores[clave] = valor;
    }
  }

  if (errores.length > 0 || !id || !nombre) return { ok: false, errores };
  return { ok: true, valor: { id, nombre, colores }, errores: [] };
}

// ─── Animaciones ─────────────────────────────────────────────────────────────

function validarPose(bruto: unknown, donde: string, errores: string[]): Pose | null {
  if (!esObjeto(bruto)) {
    errores.push(`${donde}: la pose debe ser un objeto`);
    return null;
  }
  const pose: Pose = {};
  const gradosBrutos = bruto['grados'];
  if (gradosBrutos !== undefined && gradosBrutos !== null) {
    if (!esObjeto(gradosBrutos)) {
      errores.push(`${donde}.grados debe ser un objeto {pieza: número}`);
    } else {
      const grados: Record<string, number> = {};
      for (const clave of Object.keys(gradosBrutos)) {
        const v = gradosBrutos[clave];
        if (!esNumeroFinito(v)) errores.push(`${donde}.grados["${clave}"]: debe ser un número`);
        else grados[clave] = v;
      }
      pose.grados = grados;
    }
  }
  const visibleBruto = bruto['visible'];
  if (visibleBruto !== undefined && visibleBruto !== null) {
    if (!esObjeto(visibleBruto)) {
      errores.push(`${donde}.visible debe ser un objeto {pieza: true|false}`);
    } else {
      const visible: Record<string, boolean> = {};
      for (const clave of Object.keys(visibleBruto)) {
        const v = visibleBruto[clave];
        if (typeof v !== 'boolean') errores.push(`${donde}.visible["${clave}"]: debe ser true o false`);
        else visible[clave] = v;
      }
      pose.visible = visible;
    }
  }
  const desBruto = bruto['desplazamientos'];
  if (desBruto !== undefined && desBruto !== null) {
    if (!esObjeto(desBruto)) {
      errores.push(`${donde}.desplazamientos debe ser un objeto {pieza: {x, y}}`);
    } else {
      const des: Record<string, { x: number; y: number }> = {};
      for (const clave of Object.keys(desBruto)) {
        const v = desplazamiento(desBruto, clave, errores, `${donde}.desplazamientos`, null);
        if (v) des[clave] = v;
      }
      pose.desplazamientos = des;
    }
  }
  const escalasBruto = bruto['escalas'];
  if (escalasBruto !== undefined && escalasBruto !== null) {
    if (!esObjeto(escalasBruto)) {
      errores.push(`${donde}.escalas debe ser un objeto {pieza: {x, y}}`);
    } else {
      const escalas: Record<string, { x: number; y: number }> = {};
      for (const clave of Object.keys(escalasBruto)) {
        const v = desplazamiento(escalasBruto, clave, errores, `${donde}.escalas`, null);
        if (v) escalas[clave] = v;
      }
      pose.escalas = escalas;
    }
  }
  return pose;
}

export function validarAnimacion(dato: unknown): ResultadoValidacion<Animacion> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['la animación debe ser un objeto'] };
  const id = texto(dato, 'id', errores, 'animacion');
  const nombre = textoOpcional(dato, 'nombre', errores, 'animacion');
  const duracion = numeroOpcional(dato, 'duracion', errores, 'animacion');
  if (duracion === undefined) errores.push('animacion: falta "duracion"');
  else if (duracion <= 0) errores.push('animacion: "duracion" debe ser mayor que 0');

  const bucle = dato['bucle'];
  if (typeof bucle !== 'boolean') errores.push('animacion: "bucle" debe ser true o false');

  const fotogramas: Array<{ en: number; pose: Pose }> = [];
  const brutos = dato['fotogramas'];
  if (!Array.isArray(brutos) || brutos.length < 2) {
    errores.push('animacion.fotogramas debe ser una lista con al menos 2 fotogramas');
  } else {
    let anterior = -Infinity;
    brutos.forEach((f, i) => {
      const donde = `animacion.fotogramas[${i}]`;
      if (!esObjeto(f)) {
        errores.push(`${donde}: debe ser un objeto`);
        return;
      }
      const en = numeroOpcional(f, 'en', errores, donde);
      const pose = validarPose(f['pose'], donde, errores);
      if (en === undefined || !pose) return;
      if (en < anterior) errores.push(`${donde}: los fotogramas tienen que venir ordenados por "en"`);
      anterior = en;
      if (duracion !== undefined && en > duracion) errores.push(`${donde}: "en" (${en}) se pasa de la duración (${duracion})`);
      fotogramas.push({ en, pose });
    });
  }

  if (errores.length > 0 || !id || duracion === undefined || typeof bucle !== 'boolean') {
    return { ok: false, errores };
  }
  return { ok: true, valor: { id, nombre: nombre ?? id, duracion, bucle, fotogramas }, errores: [] };
}

// ─── Boca de ventrílocuo ─────────────────────────────────────────────────────

export function validarTablaVisemas(dato: unknown): ResultadoValidacion<TablaVisemas> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['la tabla de visemas debe ser un objeto'] };
  const id = texto(dato, 'id', errores, 'visemas');
  const cerrada = texto(dato, 'cerrada', errores, 'visemas');

  const visemas: Visema[] = [];
  const vistos = new Set<string>();
  const brutos = dato['visemas'];
  if (!Array.isArray(brutos) || brutos.length === 0) {
    errores.push('visemas.visemas debe ser una lista con al menos una forma');
  } else {
    brutos.forEach((v, i) => {
      const donde = `visemas.visemas[${i}]`;
      if (!esObjeto(v)) {
        errores.push(`${donde}: debe ser un objeto`);
        return;
      }
      const visemaId = texto(v, 'id', errores, donde);
      const boca = texto(v, 'boca', errores, donde);
      const apertura = numeroOpcional(v, 'apertura', errores, donde);
      if (apertura !== undefined && (apertura < 0 || apertura > 1)) {
        errores.push(`${donde}: "apertura" tiene que estar entre 0 y 1`);
      }
      if (!visemaId || !boca || apertura === undefined) return;
      if (vistos.has(visemaId)) {
        errores.push(`${donde}: id repetido "${visemaId}"`);
        return;
      }
      vistos.add(visemaId);
      visemas.push({ id: visemaId, boca, apertura });
    });
  }

  if (cerrada !== undefined && !vistos.has(cerrada)) {
    errores.push(`visemas: la boca cerrada "${cerrada}" no está entre los visemas`);
  }

  const letras: Record<string, string> = {};
  const letrasBrutas = dato['letras'];
  if (!esObjeto(letrasBrutas) || Object.keys(letrasBrutas).length === 0) {
    errores.push('visemas.letras debe ser un objeto {letra: visema}');
  } else {
    for (const clave of Object.keys(letrasBrutas)) {
      const valor = letrasBrutas[clave];
      if (!esTextoNoVacio(valor)) {
        errores.push(`visemas.letras["${clave}"]: debe ser un id de visema`);
      } else if (!vistos.has(valor)) {
        errores.push(`visemas.letras["${clave}"]: apunta al visema "${valor}", que no existe`);
      } else {
        letras[clave] = valor;
      }
    }
  }

  if (errores.length > 0 || !id || !cerrada) return { ok: false, errores };
  return { ok: true, valor: { id, cerrada, visemas, letras }, errores: [] };
}

// ─── Catálogo de caras ───────────────────────────────────────────────────────

function listaDeTextos(bruto: unknown, errores: string[], donde: string): string[] {
  const salida: string[] = [];
  if (!Array.isArray(bruto) || bruto.length === 0) {
    errores.push(`${donde} debe ser una lista con al menos una textura`);
    return salida;
  }
  bruto.forEach((v, i) => {
    if (!esTextoNoVacio(v)) errores.push(`${donde}[${i}]: debe ser un id de textura`);
    else salida.push(v);
  });
  return salida;
}

export function validarCatalogoCaras(dato: unknown): ResultadoValidacion<CatalogoCaras> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['el catálogo de caras debe ser un objeto'] };
  const id = texto(dato, 'id', errores, 'caras');
  const nombre = textoOpcional(dato, 'nombre', errores, 'caras');
  const ojos = listaDeTextos(dato['ojos'], errores, 'caras.ojos');
  const cejas = listaDeTextos(dato['cejas'], errores, 'caras.cejas');
  const narices = listaDeTextos(dato['narices'], errores, 'caras.narices');
  const bocas = listaDeTextos(dato['bocas'], errores, 'caras.bocas');
  const pelos = listaDeTextos(dato['pelos'], errores, 'caras.pelos');
  if (errores.length > 0 || !id) return { ok: false, errores };
  return { ok: true, valor: { id, nombre: nombre ?? id, ojos, cejas, narices, bocas, pelos }, errores: [] };
}
