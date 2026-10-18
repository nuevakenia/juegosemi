// @vitest-environment jsdom
/**
 * Ver un video, probado sin navegador de verdad.
 *
 * Lo que hay que demostrar es la parte que puede dejar a Emiliano pegado:
 *   - si el adaptador dice que NO (el H.265 en la tablet) → aviso, no espera;
 *   - si dice que SÍ → se mira el <video> de verdad hasta que termina;
 *   - pase lo que pase (video que se cuelga, promesa que revienta, botón de
 *     volver) → SIEMPRE se sale por algún lado. Nunca una pantalla muda.
 *
 * (Vive en `@juegosemi/recompensas` junto al reproductor que prueba: es el MISMO
 * que usa el lector de videos y el premio del episodio.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodecVideo, OpcionesVideo, PuertoVideo, ResultadoVideo } from '@juegosemi/puertos';
import { verVideo } from './reproductor.ts';

/** Un puerto de vídeo de mentira, que anota lo que le piden y si lo detuvieron. */
interface FalsoPuerto {
  puerto: PuertoVideo;
  /** Las rutas que le pidieron reproducir. */
  pedidos: string[];
  /** Cuántas veces le pidieron detener. */
  detenciones: () => number;
}

function puertoDeMentira(resultado: ResultadoVideo | Error): FalsoPuerto {
  const pedidos: string[] = [];
  let detenciones = 0;
  const puerto: PuertoVideo = {
    soporta: async (_codec: CodecVideo) => true,
    reproducir: async (url: string, _opciones?: OpcionesVideo): Promise<ResultadoVideo> => {
      pedidos.push(url);
      if (resultado instanceof Error) throw resultado;
      return resultado;
    },
    detener: () => {
      detenciones += 1;
    },
  };
  return { puerto, pedidos, detenciones: () => detenciones };
}

/** Un `<video>` de mentira: sólo lo que el vigilante mira. */
function videoDeMentira(datos: Record<string, unknown>): HTMLVideoElement {
  const base: Record<string, unknown> = {
    ended: false,
    error: null,
    duration: Number.NaN,
    currentTime: 0,
    paused: true,
    readyState: 1,
    videoWidth: 640,
    videoHeight: 360,
  };
  const mezcla: Record<string, unknown> = Object.assign({}, base, datos);
  return mezcla as unknown as HTMLVideoElement;
}

/** Deja correr los microtasks del `reproducir` prometido. */
async function asentar(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cuando el video NO se puede ver en esta pantalla', () => {
  it('avisa al tiro, sin dejar la pantalla en negro esperando', async () => {
    const alNoPoder = vi.fn();
    const alTerminar = vi.fn();
    const falso = puertoDeMentira({
      ok: false,
      motivo: 'arrancó pero no decodificó frames (codec no soportado por este WebView)',
    });

    verVideo({
      puerto: falso.puerto,
      url: 'assets/videos/video-no-soportado.mp4',
      alTerminar,
      alNoPoder,
    });
    await asentar();

    expect(alNoPoder).toHaveBeenCalledTimes(1);
    expect(alNoPoder.mock.calls[0]?.[0]?.motivo).toContain('no decodificó frames');
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('si el reproductor revienta, igual se avisa (nunca se queda pegado)', async () => {
    const alNoPoder = vi.fn();
    const falso = puertoDeMentira(new Error('el navegador no dejó reproducir'));

    verVideo({ puerto: falso.puerto, url: 'x.mp4', alTerminar: vi.fn(), alNoPoder });
    await asentar();

    expect(alNoPoder).toHaveBeenCalledTimes(1);
    expect(alNoPoder.mock.calls[0]?.[0]?.motivo).toContain('no dejó reproducir');
  });

  it('cuando no se puede ver, el video se suelta (nada de rectángulo negro encima)', async () => {
    const falso = puertoDeMentira({ ok: false, motivo: 'no decodifica' });

    verVideo({ puerto: falso.puerto, url: 'x.mp4', alTerminar: vi.fn(), alNoPoder: vi.fn() });
    await asentar();

    expect(falso.detenciones()).toBeGreaterThan(0);
  });
});

describe('cuando el video SÍ se puede ver', () => {
  it('espera a que termine mirando el <video> de verdad, y recién ahí avisa', async () => {
    const alTerminar = vi.fn();
    const alNoPoder = vi.fn();
    const falso = puertoDeMentira({ ok: true });
    // A mitad de camino: todavía no termina.
    let video = videoDeMentira({ duration: 12, currentTime: 3, paused: false, readyState: 4 });
    const buscar = (): HTMLVideoElement => video;

    verVideo({
      puerto: falso.puerto,
      url: 'assets/videos/casa-de-la-tia.mp4',
      alTerminar,
      alNoPoder,
      buscarVideo: buscar,
    });
    await asentar();
    vi.advanceTimersByTime(500);

    expect(alTerminar).not.toHaveBeenCalled();

    // Llegó al final.
    video = videoDeMentira({ duration: 12, currentTime: 12, paused: true, readyState: 4 });
    vi.advanceTimersByTime(500);

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alNoPoder).not.toHaveBeenCalled();
    expect(falso.pedidos).toEqual(['assets/videos/casa-de-la-tia.mp4']);
  });

  it('si lo cierran por ahí (ya no hay <video>), vuelve sin quedarse pegado', async () => {
    const alTerminar = vi.fn();
    const falso = puertoDeMentira({ ok: true });

    verVideo({
      puerto: falso.puerto,
      url: 'x.mp4',
      alTerminar,
      alNoPoder: vi.fn(),
      buscarVideo: () => null,
    });
    await asentar();
    vi.advanceTimersByTime(500);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('el tope manda: un video que se cuelga igual termina', async () => {
    const alTerminar = vi.fn();
    const falso = puertoDeMentira({ ok: true });

    verVideo({
      puerto: falso.puerto,
      url: 'x.mp4',
      alTerminar,
      alNoPoder: vi.fn(),
      topeMs: 3000,
      intervaloMs: 500,
      buscarVideo: () => videoDeMentira({ readyState: 1 }),
    });
    await asentar();
    vi.advanceTimersByTime(3000 + 500);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('el navegador que no larga el video (autoplay bloqueado) tampoco hace esperar', async () => {
    const alTerminar = vi.fn();
    const falso = puertoDeMentira({ ok: true });

    verVideo({
      puerto: falso.puerto,
      url: 'x.mp4',
      alTerminar,
      alNoPoder: vi.fn(),
      quietoMs: 1500,
      intervaloMs: 500,
      buscarVideo: () => videoDeMentira({ paused: true, currentTime: 0, readyState: 4 }),
    });
    await asentar();
    vi.advanceTimersByTime(2000);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('un video con error termina el paseo: se vuelve tranquilos', async () => {
    const alTerminar = vi.fn();
    const falso = puertoDeMentira({ ok: true });

    verVideo({
      puerto: falso.puerto,
      url: 'x.mp4',
      alTerminar,
      alNoPoder: vi.fn(),
      buscarVideo: () => videoDeMentira({ error: { message: 'se cortó' } }),
    });
    await asentar();
    vi.advanceTimersByTime(500);

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });
});

describe('el botón de volver', () => {
  it('cancelar() corta todo y no dispara ningún aviso', async () => {
    const alTerminar = vi.fn();
    const alNoPoder = vi.fn();
    const falso = puertoDeMentira({ ok: true });

    const enCurso = verVideo({
      puerto: falso.puerto,
      url: 'x.mp4',
      alTerminar,
      alNoPoder,
      buscarVideo: () =>
        videoDeMentira({ duration: 12, currentTime: 2, paused: false, readyState: 4 }),
    });
    await asentar();
    enCurso.cancelar();
    vi.advanceTimersByTime(60000);

    expect(alTerminar).not.toHaveBeenCalled();
    expect(alNoPoder).not.toHaveBeenCalled();
    expect(falso.detenciones()).toBeGreaterThan(0);
  });

  it('si se cancela mientras el reproductor todavía piensa, no pasa nada después', async () => {
    const alNoPoder = vi.fn();
    const alTerminar = vi.fn();
    let responder: ((resultado: ResultadoVideo) => void) | null = null;
    const puerto: PuertoVideo = {
      soporta: async () => true,
      reproducir: () =>
        new Promise<ResultadoVideo>((resolver) => {
          responder = resolver;
        }),
      detener: () => undefined,
    };

    const enCurso = verVideo({ puerto, url: 'x.mp4', alTerminar, alNoPoder });
    enCurso.cancelar();
    if (responder !== null) (responder as (resultado: ResultadoVideo) => void)({ ok: false, motivo: 'tarde' });
    await asentar();

    expect(alNoPoder).not.toHaveBeenCalled();
    expect(alTerminar).not.toHaveBeenCalled();
  });
});
