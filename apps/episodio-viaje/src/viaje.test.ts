/**
 * La fase del viaje, probada sin navegador.
 *
 * La fase no se guarda en ningún lado: se DEDUCE del mundo del nivel. Eso es lo
 * que hace imposible que la pantalla y la lógica queden desincronizadas.
 */
import { describe, expect, it } from 'vitest';
import type { PuertoAudio, PuertoVideo } from '@juegosemi/puertos';
import { NIVEL } from './nivel.ts';
import { crearEpisodio, type Episodio } from './episodio.ts';
import { GESTO_MANIVELA, OBJETIVO_MANIVELA, faseDelViaje } from './viaje.ts';

const audioNulo: PuertoAudio = {
  cargar: async () => {},
  reproducir: async () => {},
  detener: () => {},
  detenerTodo: () => {},
  estaDesbloqueado: () => true,
  desbloquear: async () => {},
};

const videoNulo: PuertoVideo = {
  soporta: async () => true,
  reproducir: async () => ({ ok: true }),
  detener: () => {},
};

function montar(): Episodio {
  return crearEpisodio({ nivel: NIVEL, ancho: 800, alto: 600, audio: audioNulo, video: videoNulo });
}

/** Arrastra una maleta hasta el auto, como haría el dedo. */
function subirMaleta(episodio: Episodio, maletaId: string): void {
  const maleta = episodio.escena.obtener(maletaId);
  const auto = episodio.escena.obtener(episodio.escenario.piezas.auto);
  if (maleta === null || auto === null) throw new Error('falta la maleta o el auto');
  episodio.arrastre.procesar({ tipo: 'pulsar', x: maleta.x, y: maleta.y, puntero: 0 });
  episodio.arrastre.procesar({ tipo: 'mover', x: auto.x, y: auto.y, puntero: 0 });
  episodio.arrastre.procesar({ tipo: 'soltar', x: auto.x, y: auto.y, puntero: 0 });
  episodio.paso();
}

function girarManivela(episodio: Episodio, veces = 3): void {
  for (let i = 0; i < veces; i++) {
    episodio.puente.gestoCompletado(GESTO_MANIVELA, OBJETIVO_MANIVELA);
    episodio.paso();
  }
}

describe('la fase del viaje se deduce del mundo', () => {
  it('arranca en "cargando" y no se mueve con dos maletas', () => {
    const episodio = montar();
    expect(faseDelViaje(episodio.puente.logica)).toBe('cargando');
    subirMaleta(episodio, 'maleta-1');
    subirMaleta(episodio, 'maleta-2');
    expect(episodio.maletasEnElAuto()).toBe(2);
    expect(faseDelViaje(episodio.puente.logica)).toBe('cargando');
  });

  it('con la tercera maleta pide la manivela', () => {
    const episodio = montar();
    subirMaleta(episodio, 'maleta-1');
    subirMaleta(episodio, 'maleta-2');
    subirMaleta(episodio, 'maleta-3');
    expect(faseDelViaje(episodio.puente.logica)).toBe('manivela');
  });

  it('a la tercera vuelta ya se puede manejar, y al llegar queda "llegada"', () => {
    const episodio = montar();
    for (const id of ['maleta-1', 'maleta-2', 'maleta-3']) subirMaleta(episodio, id);
    girarManivela(episodio, 2);
    expect(faseDelViaje(episodio.puente.logica)).toBe('manivela');
    girarManivela(episodio, 1);
    expect(faseDelViaje(episodio.puente.logica)).toBe('manejando');
    episodio.llegarALaCasa();
    episodio.paso();
    expect(faseDelViaje(episodio.puente.logica)).toBe('llegada');
  });
});
