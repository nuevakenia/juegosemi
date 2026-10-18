// @vitest-environment jsdom
/**
 * Reproducir el premio CON RESPALDO, probado sin navegador de verdad.
 *
 * Esta es la parte robusta, y es lo que hay que demostrar:
 *   - si el premio del día no decodifica (el H.265 en la tablet), se cae al
 *     respaldo del catálogo y el niño igual ve algo;
 *   - si NINGUNO se puede ver, se deja un aviso amable y se sigue (nunca una
 *     pantalla muda);
 *   - una frase se muestra sin archivo, y un sonido se sigue sin romper nada;
 *   - cancelar corta todo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodecVideo, OpcionesVideo, PuertoVideo, ResultadoVideo } from '@juegosemi/puertos';
import type { Recompensa } from './catalogo.ts';
import { reproducirRecompensa, textoDeRecompensaQueNoSeVe } from './reproducir-recompensa.ts';

function premio(parcial: Partial<Recompensa> & { id: string; titulo: string; tipo: Recompensa['tipo'] }): Recompensa {
  return { episodio: 'viaje-casa-tia', archivo: null, texto: null, ...parcial };
}

/** Un puerto de video de mentira que decide por URL si se puede ver o no. */
function puertoQue(decide: (url: string) => ResultadoVideo): { puerto: PuertoVideo; pedidos: string[] } {
  const pedidos: string[] = [];
  const puerto: PuertoVideo = {
    soporta: async (_codec: CodecVideo) => true,
    reproducir: async (url: string, _opciones?: OpcionesVideo): Promise<ResultadoVideo> => {
      pedidos.push(url);
      return decide(url);
    },
    detener: () => undefined,
  };
  return { puerto, pedidos };
}

/** Deja correr los microtasks y el primer latido del vigilante. */
async function avanzar(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  vi.advanceTimersByTime(500);
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('un premio de video que sí se puede ver', () => {
  it('reproduce el archivo del premio y avisa cuando termina', async () => {
    const alTerminar = vi.fn();
    const alAvisar = vi.fn();
    const falso = puertoQue(() => ({ ok: true }));
    const elegido = premio({ id: 'casa-de-la-tia', titulo: 'La casa de la tía', tipo: 'video', archivo: 'casa-de-la-tia.mp4' });

    reproducirRecompensa({
      puerto: falso.puerto,
      recompensa: elegido,
      alTerminar,
      alAvisar,
      buscarVideo: () => null,
    });
    await avanzar();

    expect(falso.pedidos).toEqual(['assets/videos/casa-de-la-tia.mp4']);
    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alAvisar).not.toHaveBeenCalled();
  });
});

describe('un premio que NO se puede ver: cae al respaldo', () => {
  it('si el premio del día no decodifica, prueba el respaldo y ese sí sale', async () => {
    const alTerminar = vi.fn();
    const alAvisar = vi.fn();
    const elegido = premio({ id: 'video-del-final', titulo: 'El video del final', tipo: 'video', archivo: 'video-del-final.mp4' });
    const respaldo = premio({ id: 'casa-de-la-tia', titulo: 'La casa de la tía', tipo: 'video', archivo: 'casa-de-la-tia.mp4' });
    // El H.265 no decodifica; el otro sí.
    const falso = puertoQue((url) =>
      url.includes('video-del-final') ? { ok: false, motivo: 'no decodificó frames' } : { ok: true },
    );

    reproducirRecompensa({
      puerto: falso.puerto,
      recompensa: elegido,
      respaldos: [respaldo],
      alTerminar,
      alAvisar,
      buscarVideo: () => null,
    });
    await avanzar();

    expect(falso.pedidos).toEqual([
      'assets/videos/video-del-final.mp4',
      'assets/videos/casa-de-la-tia.mp4',
    ]);
    expect(alTerminar).toHaveBeenCalledTimes(1);
    // Se vio algo: no hace falta el aviso amable.
    expect(alAvisar).not.toHaveBeenCalled();
  });

  it('si NINGÚN video se puede ver, deja un aviso amable y sigue igual', async () => {
    const alTerminar = vi.fn();
    const avisos: string[] = [];
    const elegido = premio({ id: 'video-del-final', titulo: 'El video del final', tipo: 'video', archivo: 'video-del-final.mp4' });
    const respaldo = premio({ id: 'casa-de-la-tia', titulo: 'La casa de la tía', tipo: 'video', archivo: 'casa-de-la-tia.mp4' });
    const falso = puertoQue(() => ({ ok: false, motivo: 'no decodificó frames' }));

    reproducirRecompensa({
      puerto: falso.puerto,
      recompensa: elegido,
      respaldos: [respaldo],
      alTerminar,
      alAvisar: (frase) => avisos.push(frase),
      buscarVideo: () => null,
    });
    await avanzar();

    expect(falso.pedidos.length).toBe(2); // el elegido y el respaldo
    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(avisos.length).toBe(1);
    expect(avisos[0]).toBe(textoDeRecompensaQueNoSeVe('El video del final'));
    expect(avisos[0]).toContain('no se puede ver acá');
    expect(avisos[0]).toContain('No pasa nada');
  });

  it('la frase del aviso no tiene signos de alarma (regla de oro)', () => {
    const frase = textoDeRecompensaQueNoSeVe('El video del final');
    expect(frase).not.toMatch(/error|fall|roto|rota|!/i);
  });
});

describe('otros tipos de premio', () => {
  it('una frase se muestra sin archivo y sigue', async () => {
    const alTerminar = vi.fn();
    const avisos: string[] = [];
    const falso = puertoQue(() => ({ ok: true }));
    const frase = premio({ id: 'felicitacion', titulo: 'Una felicitación', tipo: 'frase', texto: '¡Lo lograste!' });

    reproducirRecompensa({
      puerto: falso.puerto,
      recompensa: frase,
      alTerminar,
      alAvisar: (t) => avisos.push(t),
    });
    await avanzar();

    expect(falso.pedidos).toEqual([]);
    expect(avisos).toEqual(['¡Lo lograste!']);
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('un sonido sin puerto de audio igual termina bien', async () => {
    const alTerminar = vi.fn();
    const falso = puertoQue(() => ({ ok: true }));
    const sonido = premio({ id: 'aplauso', titulo: 'Un aplauso', tipo: 'sonido', archivo: 'aplauso.mp3' });

    reproducirRecompensa({ puerto: falso.puerto, recompensa: sonido, alTerminar });
    await avanzar();

    expect(falso.pedidos).toEqual([]);
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('un sonido con puerto de audio se carga y se reproduce', async () => {
    const alTerminar = vi.fn();
    const falso = puertoQue(() => ({ ok: true }));
    const cargados: string[] = [];
    const reproducidos: string[] = [];
    const audio = {
      cargar: async (id: string, _url: string) => {
        cargados.push(id);
      },
      reproducir: async (id: string) => {
        reproducidos.push(id);
      },
      detener: () => undefined,
      detenerTodo: () => undefined,
      estaDesbloqueado: () => true,
      desbloquear: async () => undefined,
    };
    const sonido = premio({ id: 'aplauso', titulo: 'Un aplauso', tipo: 'sonido', archivo: 'aplauso.mp3' });

    reproducirRecompensa({ puerto: falso.puerto, recompensa: sonido, audio, alTerminar });
    await avanzar();

    expect(cargados).toEqual(['aplauso']);
    expect(reproducidos).toEqual(['aplauso']);
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });
});

describe('cancelar', () => {
  it('cortar la reproducción no dispara ningún aviso', async () => {
    const alTerminar = vi.fn();
    const alAvisar = vi.fn();
    const falso = puertoQue(() => ({ ok: true }));
    const elegido = premio({ id: 'casa-de-la-tia', titulo: 'La casa de la tía', tipo: 'video', archivo: 'casa-de-la-tia.mp4' });

    const enCurso = reproducirRecompensa({
      puerto: falso.puerto,
      recompensa: elegido,
      alTerminar,
      alAvisar,
      // Nunca termina: el vigilante sigue mirando.
      buscarVideo: () => ({ ended: false, error: null, duration: 12, currentTime: 2, paused: false, readyState: 4, videoWidth: 640, videoHeight: 360 }) as unknown as HTMLVideoElement,
    });
    await avanzar();
    enCurso.cancelar();
    vi.advanceTimersByTime(60000);

    expect(alTerminar).not.toHaveBeenCalled();
    expect(alAvisar).not.toHaveBeenCalled();
  });
});
