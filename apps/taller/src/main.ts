/**
 * El taller de personajes: la pantalla de verdad.
 *
 * Cablea las cuatro piezas que ya existen —el catálogo de personajes, el estado
 * elegido (estado.ts), el almacenamiento (guardado.ts) y el encuadre (render.ts)—
 * contra la estructura fija de index.html.
 *
 * Decisiones pensadas para Emiliano (11 años, autista, epilepsia, dificultades de
 * aprendizaje): botones GRANDES de @juegosemi/ui, nada de feedback negativo, la
 * elección queda marcada con `aria-pressed`, y el personaje se ve SIEMPRE entero
 * (se mide su caja real, no se adivina el alto). Si algo no cuadra, el taller
 * avisa en verde y sigue vivo: nunca se cae a media pantalla.
 */

import type { Desplazamiento, PersonajeDatos, Pose, Rig } from '@juegosemi/personajes';
import {
  Animador,
  Boca,
  animacionPorId,
  armar,
  catalogoDeCarasPorId,
  catalogosDeCaras,
  paletaPorId,
  paletas,
  plantillaPorId,
  plantillas,
  problemasDeDatos,
  tablaVisemas,
} from '@juegosemi/personajes';
import { crearRenderPixi, type RenderPixi } from '@juegosemi/render-pixi';
import { crearBoton, crearElemento } from '@juegosemi/ui';
import type { CatalogoCaras, Paleta } from '@juegosemi/personajes';
import {
  PARTES,
  acotarSeleccion,
  conContorno,
  conIndice,
  conPaleta,
  etiquetaDeParte,
  opcionesDeParte,
  rasgosDeSeleccion,
  seleccionInicial,
  textoBoton,
  type Seleccion,
} from './estado.ts';
import { crearAlmacenTaller, guardarSeleccion, leerSeleccion } from './guardado.ts';
import { dibujarConEncuadre, encuadrar, medirRig, type Caja } from './render.ts';

/** La plantilla del taller. Se deja fija: el taller arma humanos cabezones. */
const PLANTILLA_ID = 'humano-cabezon';

/** Frases cortas para el botón "Que hable". Todas amables: nada de retos. */
const FRASES = ['hola', 'hola emiliano', 'me gusta mi pelo', 'qué bonito', 'vamos a jugar'];

/** Cuánto queda el cartel verde en pantalla. */
const DURACION_AVISO_MS = 2200;

interface Elementos {
  escenario: HTMLElement;
  opciones: HTMLElement;
  aviso: HTMLElement;
  volver: HTMLElement;
  hablar: HTMLElement;
  caminar: HTMLElement;
  saludar: HTMLElement;
  guardar: HTMLElement;
}

/** Junta los elementos de la estructura fija. Si falta alguno, no hay taller. */
function buscarElementos(): Elementos | null {
  const escenario = document.getElementById('escenario');
  const opciones = document.getElementById('opciones');
  const aviso = document.getElementById('aviso');
  const volver = document.getElementById('volver');
  const hablar = document.getElementById('hablar');
  const caminar = document.getElementById('caminar');
  const saludar = document.getElementById('saludar');
  const guardar = document.getElementById('guardar');
  if (!escenario || !opciones || !aviso || !volver || !hablar || !caminar || !saludar || !guardar) {
    return null;
  }
  return { escenario, opciones, aviso, volver, hablar, caminar, saludar, guardar };
}

/** El almacén del taller (una sola vez para toda la vida de la pantalla). */
const almacen = crearAlmacenTaller();

/** Estado vivo de la pantalla. Se rearma en pasos chicos, no en un refactor grande. */
let elementos: Elementos | null = null;
let seleccion: Seleccion;
let rig: Rig | null = null;
let catalogoActual: CatalogoCaras | null = null;
let paletasDisponibles: Paleta[] = [];
let render: RenderPixi | null = null;
let animador: Animador | null = null;
let boca: Boca | null = null;
let animacionActual = 'quieto';
let ancho = 1;
let alto = 1;
let caja: Caja | null = null;
let poseActual: Pose | null = null;
let texturasActuales: Record<string, string | null> | null = null;
let ultimoTiempo = 0;
let temporizadorAviso = 0;

/** Muestra el cartel verde unos segundos. Es la única señal de "quedó listo". */
function aviso(texto: string): void {
  if (!elementos) return;
  elementos.aviso.textContent = texto;
  elementos.aviso.classList.add('visible');
  window.clearTimeout(temporizadorAviso);
  temporizadorAviso = window.setTimeout(() => {
    elementos?.aviso.classList.remove('visible');
  }, DURACION_AVISO_MS);
}

/** Arma el rig de la elección actual. Null si los datos no alcanzan. */
function armarRigDeSeleccion(elegida: Seleccion): Rig | null {
  const plantilla = plantillaPorId(PLANTILLA_ID) ?? plantillas()[0] ?? null;
  const paleta = paletaPorId(elegida.idPaleta) ?? paletas()[0] ?? null;
  const catalogo = catalogoDeCarasPorId(elegida.idCara) ?? catalogosDeCaras()[0] ?? null;
  if (!plantilla || !paleta || !catalogo) return null;
  const personaje: PersonajeDatos = {
    id: 'taller',
    nombre: 'Tu personaje',
    plantilla: plantilla.id,
    paleta: paleta.id,
    cara: catalogo.id,
    rasgos: rasgosDeSeleccion(elegida, catalogo),
  };
  return armar(plantilla, paleta, personaje, { contorno: elegida.contorno });
}

/** Un botón de opción grande, marcado si está elegido. */
function botonOpcion(etiqueta: string, elegido: boolean, alElegir: () => void): HTMLButtonElement {
  const boton = crearBoton({
    etiqueta,
    nombreAccesible: etiqueta,
    clasesExtra: 'opcion',
    alElegir,
  });
  boton.setAttribute('aria-pressed', elegido ? 'true' : 'false');
  return boton;
}

/** Un grupo de opciones con su título, como los pide el CSS de la pantalla. */
function seccion(titulo: string, botones: HTMLButtonElement[]): HTMLElement {
  const grupo = crearElemento('section', { clases: 'grupo' });
  grupo.appendChild(crearElemento('h2', { texto: titulo }));
  const fila = crearElemento('div', { clases: 'fila' });
  for (const boton of botones) fila.appendChild(boton);
  grupo.appendChild(fila);
  return grupo;
}

/** Vuelve a dibujar el panel de opciones con la elección actual marcada. */
function pintarPanel(): void {
  if (!elementos || !catalogoActual) return;
  elementos.opciones.textContent = '';

  const botonesPaleta = paletasDisponibles.map((paleta) =>
    botonOpcion(paleta.nombre, paleta.id === seleccion.idPaleta, () => {
      seleccion = conPaleta(seleccion, paleta.id);
      aplicar();
    }),
  );
  if (botonesPaleta.length > 0) elementos.opciones.appendChild(seccion('Color', botonesPaleta));

  for (const parte of PARTES) {
    const cantidad = opcionesDeParte(catalogoActual, parte).length;
    const botones: HTMLButtonElement[] = [];
    for (let i = 0; i < cantidad; i++) {
      botones.push(
        botonOpcion(textoBoton(parte, i), i === seleccion.indices[parte], () => {
          seleccion = conIndice(seleccion, parte, i, cantidad);
          aplicar();
        }),
      );
    }
    if (botones.length > 0) elementos.opciones.appendChild(seccion(etiquetaDeParte(parte), botones));
  }

  elementos.opciones.appendChild(
    seccion('Borde', [
      botonOpcion('Con borde', seleccion.contorno, () => {
        seleccion = conContorno(seleccion, true);
        aplicar();
      }),
      botonOpcion('Sin borde', !seleccion.contorno, () => {
        seleccion = conContorno(seleccion, false);
        aplicar();
      }),
    ]),
  );
}

/** Aplica la elección: rearma el rig, reencuadra y repinta panel y personaje. */
function aplicar(): void {
  const armado = armarRigDeSeleccion(seleccion);
  if (armado) {
    rig = armado;
    caja = medirRig(rig);
  }
  pintarPanel();
  dibujar();
}

/** Combina la pose de la animación con la de la boca, sin perder ninguna. */
function combinarPose(base: Pose | null, encima: Pose): Pose {
  const escalas: Record<string, Desplazamiento> = { ...(base?.escalas ?? {}) };
  if (encima.escalas) {
    for (const id of Object.keys(encima.escalas)) {
      const valor = encima.escalas[id];
      if (valor !== undefined) escalas[id] = valor;
    }
  }
  return {
    grados: { ...(base?.grados ?? {}) },
    visible: { ...(base?.visible ?? {}) },
    desplazamientos: { ...(base?.desplazamientos ?? {}) },
    escalas,
  };
}

/** Manda al render los dibujos del personaje, ya centrados y enteros. */
function dibujar(): void {
  if (!render || !rig || !caja) return;
  render.sincronizar(
    dibujarConEncuadre(rig, encuadrar(ancho, alto, caja), {
      pose: poseActual ?? undefined,
      texturas: texturasActuales ?? undefined,
    }),
  );
  render.pintar();
}

/** Segundos desde que arrancó el navegador (para animar sin relojes propios). */
function ahoraSegundos(): number {
  return performance.now() / 1000;
}

/** Cambia de animación arrancando de cero. */
function cambiarAnimacion(id: string): void {
  const animacion = animacionPorId(id);
  if (!animacion) return;
  animacionActual = id;
  if (animador) animador.cambiarA(animacion);
  else animador = new Animador(animacion);
}

/** Un paso del bucle: avanza animación y boca, y repinta. */
function paso(): void {
  const ahora = ahoraSegundos();
  const delta = ultimoTiempo === 0 ? 0 : ahora - ultimoTiempo;
  ultimoTiempo = ahora;

  if (animador) {
    poseActual = animador.actualizar(delta);
    // "Saludar" corre una sola vez: al terminar, vuelve al reposo.
    if (animador.yaTermino() && animacionActual === 'saludar') cambiarAnimacion('quieto');
  }

  if (boca) {
    const deBoca = boca.opcionesDibujo(ahora);
    texturasActuales = deBoca.texturas;
    poseActual = combinarPose(poseActual, deBoca.pose);
  }

  dibujar();
  window.requestAnimationFrame(paso);
}

/** Ajusta el render al tamaño actual del escenario (celular chico o tablet). */
async function ajustarRender(): Promise<void> {
  if (!elementos) return;
  const nuevoAncho = Math.max(1, Math.round(elementos.escenario.clientWidth));
  const nuevoAlto = Math.max(1, Math.round(elementos.escenario.clientHeight));
  if (render && nuevoAncho === ancho && nuevoAlto === alto) return;
  ancho = nuevoAncho;
  alto = nuevoAlto;
  if (render) {
    render.destruir();
    render = null;
  }
  render = await crearRenderPixi(elementos.escenario, { ancho, alto, fondo: 0x11161d });
  dibujar();
}

/** Cablea los botones fijos de la pantalla. */
function cablearAcciones(): void {
  if (!elementos) return;
  elementos.volver.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
  });
  elementos.hablar.addEventListener('click', () => {
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)] ?? 'hola';
    if (boca) boca.decir(frase, ahoraSegundos());
    aviso(`Dice: ${frase}`);
  });
  elementos.caminar.addEventListener('click', () => {
    cambiarAnimacion(animacionActual === 'caminar' ? 'quieto' : 'caminar');
  });
  elementos.saludar.addEventListener('click', () => {
    cambiarAnimacion('saludar');
  });
  elementos.guardar.addEventListener('click', () => {
    guardarSeleccion(almacen, seleccion);
    aviso('¡Guardado!');
  });
}

/** Deja la selección dentro de lo que hoy existe en el catálogo. */
function normalizarSeleccion(elegida: Seleccion, catalogo: CatalogoCaras): Seleccion {
  const idPaleta = paletaPorId(elegida.idPaleta) ? elegida.idPaleta : paletas()[0]?.id ?? elegida.idPaleta;
  const idCara = catalogoDeCarasPorId(elegida.idCara) ? elegida.idCara : catalogosDeCaras()[0]?.id ?? elegida.idCara;
  return acotarSeleccion({ ...elegida, idPaleta, idCara }, catalogo);
}

async function principal(): Promise<void> {
  elementos = buscarElementos();
  if (!elementos) return;

  const problemas = problemasDeDatos();
  if (problemas.length > 0) {
    aviso(`Los datos de personajes tienen problemas: ${problemas[0] ?? ''}`);
    return;
  }

  catalogoActual = catalogosDeCaras()[0] ?? null;
  paletasDisponibles = paletas();
  if (!catalogoActual || paletasDisponibles.length === 0) {
    aviso('Todavía no hay caras para armar.');
    return;
  }

  const guardada = leerSeleccion(almacen);
  seleccion = normalizarSeleccion(
    guardada ?? seleccionInicial(paletasDisponibles[0]?.id ?? '', catalogoActual.id),
    catalogoActual,
  );

  const tabla = tablaVisemas();
  if (tabla) boca = new Boca(tabla);

  cablearAcciones();
  cambiarAnimacion('quieto');

  await ajustarRender();
  aplicar();

  window.addEventListener('resize', () => {
    void ajustarRender();
  });

  window.requestAnimationFrame(paso);
}

void principal();
