// @vitest-environment jsdom
/**
 * El HOOK DE QA: medir el efecto de una regla sin adivinar.
 *
 * Lo que prueba de verdad: se arma un nivel, se engancha el puente, se cuelga el
 * hook de la ventana y se MIDE el contador desde el hook después de una regla.
 * Es el pedido explícito: hoy no se puede saber qué hizo una regla, con esto sí.
 */
import { describe, expect, it } from 'vitest';
import { Puente } from '@juegosemi/logica';
import { Escena } from '@juegosemi/motor';
import type { NivelEnConstruccion } from './estado.ts';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  conCosa,
  crearNivelEnConstruccion,
  elegirCuando,
  ponerValorCuando,
} from './estado.ts';
import { nivelLogico } from './construir.ts';
import { contadorDeQa, leerQa, publicarQa } from './qa.ts';

/** Un nivel con una regla: soltar la maleta sobre el auto suma 1 a maletas. */
function nivelConRegla(): NivelEnConstruccion {
  let nivel = crearNivelEnConstruccion();
  nivel = conCosa(nivel, 'entidades', 'la maleta');
  nivel = conCosa(nivel, 'entidades', 'el auto');
  nivel = conCosa(nivel, 'contadores', 'maletas');
  nivel = agregarReglaEnBlanco(nivel);
  nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
  nivel = ponerValorCuando(nivel, 'regla', 'destino', 'el-auto');
  nivel = ponerValorCuando(nivel, 'regla', 'entidad', 'la-maleta');
  nivel = agregarAccion(nivel, 'regla', 'suma', { contador: 'maletas', cuanto: 1 });
  return nivel;
}

/** Un puente con su escena, listo para colgar del hook. */
function puenteArmado(): Puente {
  const escena = new Escena();
  escena.agregar({ id: 'la-maleta', x: 100, y: 300, ancho: 100, alto: 80 });
  escena.agregar({ id: 'el-auto', x: 500, y: 300, ancho: 160, alto: 100 });
  return new Puente(nivelLogico(nivelConRegla()), { escena });
}

describe('el hook de QA del modo Probar', () => {
  it('no hay hook colgado mientras no se prueba', () => {
    publicarQa(null);
    expect(leerQa()).toBeNull();
    expect(contadorDeQa('maletas')).toBeNull();
  });

  it('deja escena, lógica, puente y volver a mano en la ventana', () => {
    const puente = puenteArmado();
    let volvio = false;
    publicarQa({ escena: puente.escena, logica: puente.logica, puente, volver: () => (volvio = true) });

    const hook = leerQa();
    expect(hook).not.toBeNull();
    if (hook === null) return;
    expect(hook.escena).toBe(puente.escena);
    expect(hook.logica).toBe(puente.logica);
    expect(hook.puente).toBe(puente);
    hook.volver();
    expect(volvio).toBe(true);
  });

  it('mide el efecto de una regla sin adivinar (lee el contador de verdad)', () => {
    const puente = puenteArmado();
    publicarQa({ escena: puente.escena, logica: puente.logica, puente, volver: () => undefined });

    // Antes de la regla, el contador está en 0.
    expect(contadorDeQa('maletas')).toBe(0);

    // Se dispara la regla a mano por el hook (como lo haría un arrastre).
    const hook = leerQa();
    hook?.puente.soltar('la-maleta', 'el-auto', 500, 300);
    hook?.puente.paso(0);

    // Y se MIDE: la regla sumó uno.
    expect(contadorDeQa('maletas')).toBe(1);
  });

  it('el estado de las misiones también se puede mirar', () => {
    const puente = puenteArmado();
    publicarQa({ escena: puente.escena, logica: puente.logica, puente, volver: () => undefined });
    const hook = leerQa();
    expect(hook?.logica.estado().terminado).toBe(false);
  });

  it('al volver al editor el hook se saca', () => {
    const puente = puenteArmado();
    publicarQa({ escena: puente.escena, logica: puente.logica, puente, volver: () => undefined });
    expect(leerQa()).not.toBeNull();

    publicarQa(null);
    expect(leerQa()).toBeNull();
    expect((window as unknown as Record<string, unknown>)['juegosemi']).toBeUndefined();
  });
});
