import { describe, it, expect } from 'vitest';
import { Timeline, aSegundos, parsearAccion, type Regla } from './timeline.ts';

function correr(reglas: Regla[], segundos: number, paso = 1 / 60, alMarcar?: (tl: Timeline) => void) {
  const acciones: string[] = [];
  const tl = new Timeline(reglas, (accion) => acciones.push(accion));
  const vueltas = Math.round(segundos / paso);
  for (let i = 0; i < vueltas; i++) {
    tl.actualizar(paso);
    if (alMarcar) alMarcar(tl);
  }
  return { tl, acciones };
}

describe('aSegundos', () => {
  it('entiende números, segundos y milisegundos', () => {
    expect(aSegundos(3)).toBe(3);
    expect(aSegundos('3s')).toBe(3);
    expect(aSegundos('1500ms')).toBe(1.5);
    expect(aSegundos('2.5')).toBe(2.5);
  });
  it('devuelve el por defecto si no entiende', () => {
    expect(aSegundos('mañana', 7)).toBe(7);
    expect(aSegundos(undefined, null)).toBe(null);
  });
});

describe('parsearAccion', () => {
  it('parte nombre y argumentos', () => {
    expect(parsearAccion('decir(caco, hola)')).toEqual({ nombre: 'decir', args: ['caco', 'hola'] });
    expect(parsearAccion('bailar')).toEqual({ nombre: 'bailar', args: [] });
  });
  it('respeta las comas dentro de las comillas', () => {
    expect(parsearAccion('decir(caco, "hola, chao")')).toEqual({ nombre: 'decir', args: ['caco', 'hola, chao'] });
  });
});

describe('timeline: `en` dispara una sola vez', () => {
  it('dispara cuando el tiempo llega y no repite', () => {
    const { acciones } = correr([{ en: 1, hacer: 'aparecer(caco)' }], 3);
    expect(acciones).toEqual(['aparecer(caco)']);
  });

  it('no dispara antes de tiempo', () => {
    const { acciones } = correr([{ en: 2, hacer: 'aparecer(caco)' }], 1.5);
    expect(acciones).toEqual([]);
  });
});

describe('timeline: ventana desde/hasta', () => {
  it('sin esperar, dispara al entrar a la ventana (una vez)', () => {
    const { acciones } = correr([{ desde: 1, hasta: 2, hacer: 'caminar(caco)' }], 4);
    expect(acciones).toEqual(['caminar(caco)']);
  });

  it('con esperar, repite mientras dura la ventana', () => {
    // ventana [0, 3.2] con esperar 1 s → dispara en 0, ~1, ~2 y ~3
    const { acciones } = correr([{ desde: 0, hasta: 3.2, esperar: 1, hacer: 'tick' }], 3.2);
    expect(acciones.length).toBe(4);
  });

  it('no dispara más al salir de la ventana', () => {
    // `esperar` se cuenta desde el ÚLTIMO disparo, así que en la ventana [0,1]
    // con esperar 0.5 s entran 2: el de entrada (~0.017) y el de ~0.517.
    const { acciones } = correr([{ desde: 0, hasta: 1, esperar: 0.5, hacer: 'tick' }], 3);
    expect(acciones.length).toBe(2);
  });

  it('terminar corre al cerrarse la ventana', () => {
    const { acciones } = correr([{ desde: 1, hasta: 2, hacer: 'bailar', terminar: 'parar' }], 3);
    expect(acciones).toEqual(['bailar', 'parar']);
  });
});

describe('timeline: `cuando` (condiciones, AND)', () => {
  it('no dispara si falta una condición', () => {
    const { acciones } = correr([{ cuando: ['tocado(caco)', 'activado(boton)'], hacer: 'abrir' }], 1, 1 / 60, (tl) => {
      tl.marcar('tocado(caco)');
    });
    expect(acciones).toEqual([]);
  });

  it('dispara una vez cuando están todas, aunque sigan puestas', () => {
    const { acciones } = correr([{ cuando: ['a', 'b'], hacer: 'abrir' }], 2, 1 / 60, (tl) => {
      tl.marcar('a');
      tl.marcar('b');
    });
    expect(acciones).toEqual(['abrir']);
  });
});

describe('timeline: `siempre_que` (flanco)', () => {
  it('dispara al pasar de no cumplirse a cumplirse, y otra vez si se suelta y se vuelve a pulsar', () => {
    const acciones: string[] = [];
    const tl = new Timeline([{ siempre_que: 'boton', hacer: 'saltar' }], (a) => acciones.push(a));
    tl.actualizar(1 / 60); // sin pulsar
    tl.marcar('boton');
    tl.actualizar(1 / 60); // flanco → dispara
    tl.actualizar(1 / 60); // sigue pulsado → NO dispara
    tl.marcar('boton', false);
    tl.actualizar(1 / 60);
    tl.marcar('boton');
    tl.actualizar(1 / 60); // nuevo flanco → dispara
    expect(acciones).toEqual(['saltar', 'saltar']);
  });

  it('con esperar, repite mientras se mantiene', () => {
    const acciones: string[] = [];
    const tl = new Timeline([{ siempre_que: 'pintando', esperar: 0.5, hacer: 'pincelada' }], (a) => acciones.push(a));
    tl.marcar('pintando');
    for (let i = 0; i < 60 + 30; i++) tl.actualizar(1 / 60); // 1.5 s
    expect(acciones.length).toBeGreaterThanOrEqual(3);
  });
});

describe('timeline: la pausa no re-dispara', () => {
  it('pausar y reanudar no vuelve a ejecutar lo ya ejecutado', () => {
    const { tl, acciones } = correr([{ en: 0.5, hacer: 'una-vez' }], 0.6);
    expect(acciones).toEqual(['una-vez']);
    tl.pausar();
    for (let i = 0; i < 120; i++) tl.actualizar(1 / 60);
    tl.reanudar();
    for (let i = 0; i < 120; i++) tl.actualizar(1 / 60);
    expect(acciones).toEqual(['una-vez']);
  });

  it('mientras está pausado el tiempo no avanza', () => {
    const tl = new Timeline([{ en: 10, hacer: 'nunca' }], () => {});
    tl.actualizar(0.5);
    const antes = tl.tiempo();
    tl.pausar();
    tl.actualizar(1);
    expect(tl.tiempo()).toBe(antes);
  });
});

describe('timeline: el historial queda registrado', () => {
  it('guarda cada acción con su momento y su regla', () => {
    const tl = new Timeline([{ en: 1, hacer: ['uno', 'dos'] }], () => {});
    for (let i = 0; i < 90; i++) tl.actualizar(1 / 60);
    const historial = tl.historial();
    expect(historial.map((h) => h.accion)).toEqual(['uno', 'dos']);
    expect(historial[0]!.contexto.tiempo).toBeGreaterThanOrEqual(1);
    expect(historial[0]!.contexto.regla).toBe(0);
  });
});
