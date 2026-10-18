/**
 * @juegosemi/personajes — poses y animaciones.
 *
 * Una pose es DATO: "el brazo izquierdo girado 20 grados, la cabeza 5". Una
 * animación es una lista de fotogramas con su momento (`en`), y el motor de
 * personajes los mezcla solo. Nada de animación horneada: si mañana queremos
 * que Emiliano camine distinto, se toca el JSON.
 *
 * Los giros van en GRADOS porque es lo que se escribe cómodo en los datos;
 * la mezcla también trabaja en grados y recién al final se pasa a radianes.
 */

import type { Animacion, Desplazamiento, Pose } from './tipo.ts';

/** La pose que no cambia nada: la de reposo del rig. */
export function poseVacia(): Pose {
  return { grados: {}, visible: {}, desplazamientos: {}, escalas: {} };
}

/** Junta las piezas nombradas por cualquiera de las dos poses (para no dejar ninguna afuera). */
function clavesDe(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): string[] {
  const claves = new Set<string>();
  if (a) for (const k of Object.keys(a)) claves.add(k);
  if (b) for (const k of Object.keys(b)) claves.add(k);
  return [...claves];
}

function mezclarNumeros(a: number | undefined, b: number | undefined, f: number): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a + (b - a) * f;
}

function mezclarDesplazamiento(a: Desplazamiento | undefined, b: Desplazamiento | undefined, f: number): Desplazamiento | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/**
 * Mezcla dos poses: f=0 devuelve `a`, f=1 devuelve `b`. Los booleanos (visible)
 * cambian de golpe al pasar la mitad: una pieza no se puede ver "un poco".
 */
export function mezclarPoses(a: Pose, b: Pose, f: number): Pose {
  const t = Math.max(0, Math.min(1, f));
  const salida: Pose = { grados: {}, visible: {}, desplazamientos: {}, escalas: {} };

  for (const id of clavesDe(a.grados, b.grados)) {
    const v = mezclarNumeros(a.grados ? a.grados[id] : undefined, b.grados ? b.grados[id] : undefined, t);
    if (v !== undefined && salida.grados) salida.grados[id] = v;
  }
  for (const id of clavesDe(a.visible, b.visible)) {
    const va = a.visible ? a.visible[id] : undefined;
    const vb = b.visible ? b.visible[id] : undefined;
    const elegido = t < 0.5 ? (va === undefined ? vb : va) : vb === undefined ? va : vb;
    if (elegido !== undefined && salida.visible) salida.visible[id] = elegido;
  }
  for (const id of clavesDe(a.desplazamientos, b.desplazamientos)) {
    const v = mezclarDesplazamiento(
      a.desplazamientos ? a.desplazamientos[id] : undefined,
      b.desplazamientos ? b.desplazamientos[id] : undefined,
      t,
    );
    if (v !== undefined && salida.desplazamientos) salida.desplazamientos[id] = v;
  }
  for (const id of clavesDe(a.escalas, b.escalas)) {
    const v = mezclarDesplazamiento(a.escalas ? a.escalas[id] : undefined, b.escalas ? b.escalas[id] : undefined, t);
    if (v !== undefined && salida.escalas) salida.escalas[id] = v;
  }
  return salida;
}

/**
 * En qué fotograma cae `t` y con qué fracción hacia el siguiente.
 * Con `bucle`, el tiempo da la vuelta sobre la duración.
 */
export function tramoEn(animacion: Animacion, t: number): { desde: number; hasta: number; f: number } {
  const duracion = animacion.duracion;
  let tiempo = t;
  if (animacion.bucle && duracion > 0) {
    tiempo = ((t % duracion) + duracion) % duracion;
  } else {
    tiempo = Math.max(0, Math.min(t, duracion));
  }

  const fotogramas = animacion.fotogramas;
  const primero = fotogramas[0]!;
  if (tiempo <= primero.en) return { desde: 0, hasta: 0, f: 0 };

  for (let i = 0; i < fotogramas.length - 1; i++) {
    const actual = fotogramas[i]!;
    const siguiente = fotogramas[i + 1]!;
    if (tiempo >= actual.en && tiempo <= siguiente.en) {
      const tramo = siguiente.en - actual.en;
      const f = tramo <= 0 ? 0 : (tiempo - actual.en) / tramo;
      return { desde: i, hasta: i + 1, f };
    }
  }

  const ultimo = fotogramas.length - 1;
  return { desde: ultimo, hasta: ultimo, f: 0 };
}

/** La pose de una animación en el momento `t` (segundos). */
export function poseEnTiempo(animacion: Animacion, t: number): Pose {
  const tramo = tramoEn(animacion, t);
  if (tramo.desde === tramo.hasta) {
    return mezclarPoses(animacion.fotogramas[tramo.desde]!.pose, animacion.fotogramas[tramo.desde]!.pose, 0);
  }
  return mezclarPoses(
    animacion.fotogramas[tramo.desde]!.pose,
    animacion.fotogramas[tramo.hasta]!.pose,
    tramo.f,
  );
}

/**
 * Reproduce una animación paso a paso. Es la parte que el juego llama una vez
 * por paso del ticker (`actualizar(dt)`), igual que el resto del motor.
 */
export class Animador {
  private animacion: Animacion;
  private tiempo = 0;
  private terminada = false;

  constructor(animacion: Animacion) {
    this.animacion = animacion;
  }

  /** Avanza el reloj. Devuelve la pose de este momento. */
  actualizar(deltaSegundos: number): Pose {
    const delta = Math.max(0, deltaSegundos);
    if (!this.terminada) {
      this.tiempo += delta;
      if (!this.animacion.bucle && this.tiempo >= this.animacion.duracion) {
        this.tiempo = this.animacion.duracion;
        this.terminada = true;
      }
    }
    return poseEnTiempo(this.animacion, this.tiempo);
  }

  pose(): Pose {
    return poseEnTiempo(this.animacion, this.tiempo);
  }

  tiempoActual(): number {
    return this.tiempo;
  }

  /** ¿Ya se terminó? (sólo en las animaciones sin bucle). */
  yaTermino(): boolean {
    return this.terminada;
  }

  /** Vuelve al principio (para repetir "saludar", por ejemplo). */
  reproducirDeNuevo(): void {
    this.tiempo = 0;
    this.terminada = false;
  }

  /** Cambia de animación arrancando de cero, sin perder el objeto. */
  cambiarA(animacion: Animacion): void {
    this.animacion = animacion;
    this.reproducirDeNuevo();
  }
}
