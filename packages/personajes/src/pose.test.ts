import { describe, it, expect } from 'vitest';
import { poseVacia, mezclarPoses, tramoEn, poseEnTiempo, Animador } from './pose.ts';
import type { Animacion } from './tipo.ts';

const animacion: Animacion = {
  id: 'prueba',
  nombre: 'Prueba',
  duracion: 1,
  bucle: false,
  fotogramas: [
    { en: 0, pose: { grados: { torso: 0, cabeza: 0 }, visible: { gema: true } } },
    { en: 0.5, pose: { grados: { torso: 20 }, visible: { gema: false }, escalas: { boca: { x: 1, y: 1 } } } },
    { en: 1, pose: { grados: { torso: 40, cabeza: 10 }, escalas: { boca: { x: 1, y: 3 } } } },
  ],
};

const enBucle: Animacion = { ...animacion, id: 'bucle', bucle: true };

describe('mezclarPoses', () => {
  it('f=0 devuelve la primera y f=1 la segunda', () => {
    const a = { grados: { torso: 0 } };
    const b = { grados: { torso: 10 } };
    expect(mezclarPoses(a, b, 0).grados?.['torso']).toBe(0);
    expect(mezclarPoses(a, b, 1).grados?.['torso']).toBe(10);
    expect(mezclarPoses(a, b, 0.5).grados?.['torso']).toBe(5);
  });

  it('respeta el valor donde la otra pose no dice nada', () => {
    const mezcla = mezclarPoses({ grados: { cabeza: 7 } }, { grados: { torso: 3 } }, 0.5);
    expect(mezcla.grados?.['cabeza']).toBe(7);
    expect(mezcla.grados?.['torso']).toBe(3);
  });

  it('una pieza no se puede ver "un poco": el booleano cambia en la mitad', () => {
    const a = { visible: { gema: true } };
    const b = { visible: { gema: false } };
    expect(mezclarPoses(a, b, 0.49).visible?.['gema']).toBe(true);
    expect(mezclarPoses(a, b, 0.51).visible?.['gema']).toBe(false);
  });

  it('mezcla desplazamientos y escalas', () => {
    const a = { desplazamientos: { torso: { x: 0, y: 0 } }, escalas: { boca: { x: 1, y: 1 } } };
    const b = { desplazamientos: { torso: { x: 10, y: 20 } }, escalas: { boca: { x: 1, y: 3 } } };
    const m = mezclarPoses(a, b, 0.5);
    expect(m.desplazamientos?.['torso']).toEqual({ x: 5, y: 10 });
    expect(m.escalas?.['boca']).toEqual({ x: 1, y: 2 });
  });

  it('acota f entre 0 y 1', () => {
    const a = { grados: { torso: 0 } };
    const b = { grados: { torso: 10 } };
    expect(mezclarPoses(a, b, -5).grados?.['torso']).toBe(0);
    expect(mezclarPoses(a, b, 5).grados?.['torso']).toBe(10);
  });
});

describe('tramoEn', () => {
  it('encuentra el tramo y la fracción', () => {
    expect(tramoEn(animacion, 0.25)).toEqual({ desde: 0, hasta: 1, f: 0.5 });
    expect(tramoEn(animacion, 0.75)).toEqual({ desde: 1, hasta: 2, f: 0.5 });
  });

  it('antes del primer fotograma queda clavado en el primero', () => {
    expect(tramoEn(animacion, -3)).toEqual({ desde: 0, hasta: 0, f: 0 });
  });

  it('sin bucle se clava al final; con bucle da la vuelta', () => {
    const clavado = tramoEn(animacion, 99);
    expect(clavado.desde).toBe(1);
    expect(clavado.f).toBe(1);
    expect(poseEnTiempo(animacion, 99).grados?.['torso']).toBeCloseTo(40, 6);
    const vuelta = tramoEn(enBucle, 1.25);
    expect(vuelta.desde).toBe(0);
    expect(vuelta.f).toBeCloseTo(0.5, 6);
  });

  it('el tiempo negativo con bucle también da la vuelta', () => {
    const vuelta = tramoEn(enBucle, -0.25);
    expect(vuelta.desde).toBe(1);
  });
});

describe('poseEnTiempo', () => {
  it('interpola entre fotogramas', () => {
    const pose = poseEnTiempo(animacion, 0.25);
    expect(pose.grados?.['torso']).toBeCloseTo(10, 6);
  });

  it('toma los valores del fotograma exacto', () => {
    expect(poseEnTiempo(animacion, 0.5).grados?.['torso']).toBeCloseTo(20, 6);
    expect(poseEnTiempo(animacion, 1).grados?.['cabeza']).toBeCloseTo(10, 6);
  });

  it('arranca en la pose de reposo', () => {
    const pose = poseEnTiempo(animacion, 0);
    expect(pose.grados?.['torso']).toBe(0);
    expect(pose.visible?.['gema']).toBe(true);
  });

  it('interpola las escalas (la boca que se abre)', () => {
    expect(poseEnTiempo(animacion, 0.75).escalas?.['boca']?.y).toBeCloseTo(2, 6);
  });
});

describe('Animador', () => {
  it('avanza con el tiempo y entrega la pose', () => {
    const animador = new Animador(animacion);
    animador.actualizar(0.25);
    expect(animador.pose().grados?.['torso']).toBeCloseTo(10, 6);
    expect(animador.tiempoActual()).toBeCloseTo(0.25, 6);
  });

  it('sin bucle se termina y se queda clava en el final', () => {
    const animador = new Animador(animacion);
    animador.actualizar(5);
    expect(animador.yaTermino()).toBe(true);
    expect(animador.tiempoActual()).toBe(1);
    expect(animador.pose().grados?.['torso']).toBeCloseTo(40, 6);
  });

  it('con bucle nunca termina y da la vuelta', () => {
    const animador = new Animador(enBucle);
    animador.actualizar(1.25);
    expect(animador.yaTermino()).toBe(false);
    expect(animador.pose().grados?.['torso']).toBeCloseTo(10, 6);
  });

  it('se puede volver a empezar y cambiar de animación', () => {
    const animador = new Animador(animacion);
    animador.actualizar(1);
    expect(animador.yaTermino()).toBe(true);
    animador.reproducirDeNuevo();
    expect(animador.yaTermino()).toBe(false);
    expect(animador.tiempoActual()).toBe(0);

    animador.cambiarA(enBucle);
    animador.actualizar(1.25);
    expect(animador.yaTermino()).toBe(false);
    expect(animador.pose().grados?.['torso']).toBeCloseTo(10, 6);
  });

  it('ignora los deltas negativos', () => {
    const animador = new Animador(animacion);
    animador.actualizar(0.5);
    animador.actualizar(-10);
    expect(animador.tiempoActual()).toBeCloseTo(0.5, 6);
  });
});

describe('poseVacia', () => {
  it('no cambia nada y se puede mezclar', () => {
    const vacia = poseVacia();
    expect(mezclarPoses(vacia, { grados: { torso: 5 } }, 1).grados?.['torso']).toBe(5);
  });
});
