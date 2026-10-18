import type { OpcionesAudio, PuertoAudio } from '@juegosemi/puertos';

/**
 * Adaptador de audio con WebAudio.
 *
 * Dos caminos:
 *  - `cargar(id, url)` + `reproducir(id)`: sonsidos grabados (voz, música).
 *  - `tono(frecuencia, duracion)`: un "ding" sintetizado, sin archivos. Es lo que
 *    usa el "juice" del juego para premiar un acierto (así el proyecto puede
 *    sonar bien antes de tener un solo asset de audio).
 *
 * Ojo Android/WebView: el AudioContext arranca bloqueado hasta que el usuario
 * toca la pantalla. `desbloquear()` se llama en el primer toque.
 */
export interface AudioWeb extends PuertoAudio {
  /** Un tono corto sintetizado (juice). Sin archivos. */
  tono(frecuencia: number, duracion?: number, volumen?: number): void;
}

export function crearAudioWeb(): AudioWeb {
  let contexto: AudioContext | null = null;
  const buffers = new Map<string, AudioBuffer>();
  const urls = new Map<string, string>();

  function ctx(): AudioContext | null {
    if (contexto) return contexto;
    const Fabrica = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Fabrica) return null;
    contexto = new Fabrica();
    return contexto;
  }

  return {
    async cargar(id: string, url: string): Promise<void> {
      urls.set(id, url);
      const c = ctx();
      if (!c) return;
      const respuesta = await fetch(url);
      const datos = await respuesta.arrayBuffer();
      buffers.set(id, await c.decodeAudioData(datos));
    },

    async reproducir(id: string, opciones: OpcionesAudio = {}): Promise<void> {
      const c = ctx();
      const buffer = buffers.get(id);
      if (!c || !buffer) return;
      const fuente = c.createBufferSource();
      fuente.buffer = buffer;
      fuente.loop = opciones.bucle ?? false;
      const ganancia = c.createGain();
      ganancia.gain.value = opciones.volumen ?? 1;
      fuente.connect(ganancia).connect(c.destination);
      fuente.start();
    },

    detener(_id: string): void {
      // Los sonidos cortos del juego se dejan terminar; para cortar uno largo se
      // guardaría la fuente en un mapa. Se implementa cuando haga falta.
    },

    detenerTodo(): void {
      contexto?.close();
      contexto = null;
    },

    estaDesbloqueado(): boolean {
      return contexto !== null && contexto.state === 'running';
    },

    async desbloquear(): Promise<void> {
      const c = ctx();
      if (!c) return;
      if (c.state === 'suspended') await c.resume();
    },

    tono(frecuencia: number, duracion = 0.18, volumen = 0.35): void {
      const c = ctx();
      if (!c || c.state !== 'running') return;
      const oscilador = c.createOscillator();
      const ganancia = c.createGain();
      oscilador.type = 'triangle';
      oscilador.frequency.value = frecuencia;
      ganancia.gain.setValueAtTime(volumen, c.currentTime);
      ganancia.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duracion);
      oscilador.connect(ganancia).connect(c.destination);
      oscilador.start();
      oscilador.stop(c.currentTime + duracion);
    },
  };
}
