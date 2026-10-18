import { describe, it, expect } from 'vitest';
import {
  Boca,
  bloquesDeTexto,
  visemaPorId,
  visemaDeLetra,
  visemaCerrado,
  letraNormalizada,
  poseDeVisema,
  texturasDeVisema,
} from './boca.ts';
import type { TablaVisemas } from './tipo.ts';

const tabla: TablaVisemas = {
  id: 'v',
  cerrada: 'cerrada',
  visemas: [
    { id: 'cerrada', boca: 'boca-cerrada', apertura: 0 },
    { id: 'a', boca: 'boca-a', apertura: 1 },
    { id: 'm', boca: 'boca-m', apertura: 0.05 },
    { id: 'l', boca: 'boca-l', apertura: 0.45 },
  ],
  letras: { a: 'a', m: 'm', b: 'm', l: 'l', n: 'l', y: 'l' },
};

describe('letras y visemas', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(letraNormalizada('Á')).toBe('a');
    expect(letraNormalizada('Ñ')).toBe('n');
    expect(letraNormalizada('M')).toBe('m');
  });

  it('la letra ñ se normaliza a n (y por eso la tabla no necesita la ñ)', () => {
    expect(letraNormalizada('ñ')).toBe('n');
    expect(visemaDeLetra(tabla, 'ñ')?.id).toBe('l');
    expect(visemaDeLetra(tabla, 'ñ')?.id).toBe(visemaDeLetra(tabla, 'n')?.id);
  });

  it('cada letra tiene su forma de boca', () => {
    expect(visemaDeLetra(tabla, 'a')?.id).toBe('a');
    expect(visemaDeLetra(tabla, 'A')?.id).toBe('a');
    expect(visemaDeLetra(tabla, 'á')?.id).toBe('a');
    expect(visemaDeLetra(tabla, 'm')?.id).toBe('m');
    expect(visemaDeLetra(tabla, 'b')?.id).toBe('m');
    expect(visemaDeLetra(tabla, 'y')?.id).toBe('l');
  });

  it('una letra que no está en la tabla no rompe nada', () => {
    expect(visemaDeLetra(tabla, 'z')).toBeNull();
    expect(visemaDeLetra(tabla, ' ')).toBeNull();
  });

  it('busca por id y devuelve la boca de silencio', () => {
    expect(visemaPorId(tabla, 'm')?.boca).toBe('boca-m');
    expect(visemaPorId(tabla, 'nada')).toBeNull();
    expect(visemaCerrado(tabla)?.id).toBe('cerrada');
  });
});

describe('bloquesDeTexto', () => {
  it('arma un bloque por letra, en orden', () => {
    const bloques = bloquesDeTexto(tabla, 'ma');
    expect(bloques.length).toBe(2);
    expect(bloques[0]?.visema.id).toBe('m');
    expect(bloques[1]?.visema.id).toBe('a');
    expect(bloques[0]?.hasta).toBeCloseTo(0.085, 6);
  });

  it('cierra la boca entre palabras', () => {
    const bloques = bloquesDeTexto(tabla, 'ma ma');
    expect(bloques.length).toBe(5);
    expect(bloques[2]?.visema.id).toBe('cerrada');
    expect(bloques[2]?.hasta).toBeCloseTo(0.29, 6);
  });

  it('cierra la boca más tiempo en la puntuación', () => {
    const bloques = bloquesDeTexto(tabla, 'a.');
    expect(bloques.length).toBe(2);
    expect(bloques[1]?.visema.id).toBe('cerrada');
    expect(bloques[1]?.hasta).toBeCloseTo(0.345, 6);
  });

  it('salta los caracteres que no son letras ni pausas', () => {
    expect(bloquesDeTexto(tabla, 'a😀').length).toBe(1);
  });

  it('los bloques van en orden y no se pisan', () => {
    const bloques = bloquesDeTexto(tabla, 'mamá la ñ');
    let anterior = -Infinity;
    for (const bloque of bloques) {
      expect(bloque.hasta).toBeGreaterThan(bloque.desde);
      expect(bloque.desde).toBeGreaterThanOrEqual(anterior);
      anterior = bloque.desde;
    }
  });

  it('respeta las duraciones configuradas', () => {
    const bloques = bloquesDeTexto(tabla, 'a', { duracionPorVisema: 0.5 });
    expect(bloques[0]?.hasta).toBeCloseTo(0.5, 6);
  });
});

describe('poseDeVisema y texturasDeVisema', () => {
  it('abre la boca según la apertura del visema', () => {
    expect(poseDeVisema({ id: 'a', boca: 'boca-a', apertura: 1 }).escalas?.['boca']?.y).toBeCloseTo(1, 6);
    expect(poseDeVisema({ id: 'cerrada', boca: 'boca-cerrada', apertura: 0 }).escalas?.['boca']?.y).toBeCloseTo(0.35, 6);
  });

  it('cambia la textura por la de la forma de boca', () => {
    expect(texturasDeVisema({ id: 'a', boca: 'boca-a', apertura: 1 })).toEqual({ boca: 'boca-a' });
    expect(texturasDeVisema(null)).toEqual({ boca: null });
  });

  it('puede apuntar a otra pieza de la boca', () => {
    expect(poseDeVisema({ id: 'a', boca: 'boca-a', apertura: 1 }, 'boca2').escalas?.['boca2']).toBeDefined();
  });
});

describe('Boca', () => {
  it('habla el texto que se le dice, momento a momento', () => {
    const boca = new Boca(tabla);
    boca.decir('mama', 10);
    expect(boca.hablando(10)).toBe(true);
    expect(boca.visemaEn(10)?.id).toBe('m');
    expect(boca.visemaEn(10.09)?.id).toBe('a');
    expect(boca.apertura(10.09)).toBe(1);
    expect(boca.texto()).toBe('mama');
    expect(boca.duracion()).toBeCloseTo(0.34, 6);
  });

  it('cuando termina el texto, la boca queda cerrada', () => {
    const boca = new Boca(tabla);
    boca.decir('mama', 10);
    expect(boca.hablando(100)).toBe(false);
    expect(boca.visemaEn(100)?.id).toBe('cerrada');
    expect(boca.apertura(100)).toBe(0);
  });

  it('antes de arrancar todavía no habla', () => {
    const boca = new Boca(tabla);
    boca.decir('mama', 10);
    expect(boca.hablando(5)).toBe(false);
    expect(boca.visemaEn(5)?.id).toBe('cerrada');
  });

  it('actualizar guarda el visema del momento', () => {
    const boca = new Boca(tabla);
    boca.decir('mama', 0);
    expect(boca.visemaActual()?.id).toBe('cerrada');
    boca.actualizar(0.09);
    expect(boca.visemaActual()?.id).toBe('a');
  });

  it('callar cierra la boca y olvida el texto', () => {
    const boca = new Boca(tabla);
    boca.decir('mama', 0);
    boca.callar();
    expect(boca.texto()).toBe('');
    expect(boca.bloquesArmados().length).toBe(0);
    expect(boca.hablando(0)).toBe(false);
    expect(boca.visemaActual()?.id).toBe('cerrada');
  });

  it('entrega pose y textura listas para el adaptador de render', () => {
    const boca = new Boca(tabla);
    boca.decir('ma', 0);
    const abierta = boca.opcionesDibujo(0.09);
    expect(abierta.texturas).toEqual({ boca: 'boca-a' });
    expect(abierta.pose.escalas?.['boca']?.y).toBeCloseTo(1, 6);

    const cerrada = boca.opcionesDibujo(10);
    expect(cerrada.texturas).toEqual({ boca: 'boca-cerrada' });
    expect(cerrada.pose.escalas?.['boca']?.y).toBeCloseTo(0.35, 6);
  });

  it('se le puede cambiar la pieza de la boca', () => {
    const boca = new Boca(tabla, { pieza: 'boca2' });
    boca.decir('a', 0);
    expect(boca.opcionesDibujo(0).texturas).toEqual({ boca2: 'boca-a' });
    expect(boca.opcionesDibujo(0).pose.escalas?.['boca2']?.y).toBeCloseTo(1, 6);
  });

  it('un texto sin letras conocidas no rompe nada', () => {
    const boca = new Boca(tabla);
    boca.decir('123', 0);
    expect(boca.bloquesArmados().length).toBe(0);
    expect(boca.hablando(0)).toBe(false);
    expect(boca.visemaEn(0)?.id).toBe('cerrada');
  });
});
