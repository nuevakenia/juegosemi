// Prueba del nivel del juego de gestos, SIN navegador: se manda un
// `gesto_completado` por cada unidad y se mira que la lógica avance en orden.
import { describe, expect, it } from 'vitest';
import { Logica, validarNivel } from '@juegosemi/logica';
import { PASOS_GESTOS, crearNivelGestos, pasoPorGesto } from './nivel.ts';

describe('juego-gestos: el nivel', () => {
  it('está bien escrito (lo dice el validador)', () => {
    const revision = validarNivel(crearNivelGestos());
    expect(revision.errores).toEqual([]);
    expect(revision.ok).toBe(true);
  });

  it('pide los cuatro gestos, en orden, y termina al completarlos', () => {
    const nivel = crearNivelGestos();
    let termino = false;
    const logica = new Logica(nivel, {
      aplicar: () => undefined,
      termino: () => {
        termino = true;
      },
    });

    logica.paso([]);
    const pedidos: string[] = [];
    for (const paso of PASOS_GESTOS) {
      // ¿Qué gesto está pedido ahora?
      pedidos.push(logica.eventos.gestosPendientes()[0]?.gesto ?? '(ninguno)');
      // El reconocedor mandaría una unidad por cada vez.
      for (let i = 0; i < paso.veces; i++) {
        logica.paso([{ tipo: 'gesto_completado', gesto: paso.gesto }]);
      }
    }

    expect(pedidos).toEqual(PASOS_GESTOS.map((p) => p.gesto));
    expect(termino).toBe(true);
    expect(logica.terminadoNivel()).toBe(true);
  });

  it('un gesto a medias no avanza el paso', () => {
    const logica = new Logica(crearNivelGestos(), { aplicar: () => undefined });
    logica.paso([]);
    // dos toques de los cinco que pide el primer gesto
    logica.paso([{ tipo: 'gesto_completado', gesto: 'toque_repetido' }]);
    logica.paso([{ tipo: 'gesto_completado', gesto: 'toque_repetido' }]);

    expect(logica.eventos.gestosPendientes()[0]?.gesto).toBe('toque_repetido');
    expect(logica.eventos.gestosPendientes()[0]?.hechas).toBe(2);
  });

  it('pasoPorGesto encuentra los cuatro', () => {
    for (const paso of PASOS_GESTOS) {
      expect(pasoPorGesto(paso.gesto)?.objetivo).toBe(paso.objetivo);
    }
  });
});
