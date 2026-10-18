import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validarFamilia, type Familia } from '@juegosemi/contenido';
import {
  crearPartida,
  intentar,
  personasPendientes,
  autosLibres,
  estaCompletada,
  autoCorrecto,
  reiniciar,
} from './reglas.ts';

const familia: Familia = {
  id: 'f',
  titulo: 'Prueba',
  autos: [
    { id: 'a-papa', nombre: 'auto del papá' },
    { id: 'a-mama', nombre: 'auto de la mamá' },
  ],
  personas: [
    { id: 'papa', nombre: 'Papá', auto: 'a-papa', frase: '¡Ese es el auto del papá!' },
    { id: 'mama', nombre: 'Mamá', auto: 'a-mama' },
  ],
};

describe('el juego de los autos: reglas', () => {
  it('arranca con todas las personas pendientes y todos los autos libres', () => {
    const partida = crearPartida(familia);
    expect(personasPendientes(partida).map((p) => p.id)).toEqual(['papa', 'mama']);
    expect(autosLibres(partida).map((a) => a.id)).toEqual(['a-papa', 'a-mama']);
    expect(estaCompletada(partida)).toBe(false);
  });

  it('acertar: festejo, frase y la persona deja de estar pendiente', () => {
    const partida = crearPartida(familia);
    const r = intentar(partida, 'papa', 'a-papa');
    expect(r.correcto).toBe(true);
    expect(r.animo).toBe('festejo');
    expect(r.frase).toBe('¡Ese es el auto del papá!');
    expect(r.quedan).toBe(1);
    expect(personasPendientes(partida).map((p) => p.id)).toEqual(['mama']);
    expect(partida.aciertos).toBe(1);
  });

  it('equivocarse: NO hay feedback negativo ni castigo', () => {
    const partida = crearPartida(familia);
    const r = intentar(partida, 'papa', 'a-mama');
    expect(r.correcto).toBe(false);
    expect(r.animo).toBe('neutro');
    expect(r.frase).toBeNull();
    // nada negativo en el resultado
    const texto = JSON.stringify(r).toLowerCase();
    for (const prohibida of ['mal', 'error', 'equivoc', 'incorrecto', 'perdiste', 'no es']) {
      expect(texto).not.toContain(prohibida);
    }
    // y no se pierde nada: la persona sigue pendiente y los aciertos no cambiaron
    expect(personasPendientes(partida).map((p) => p.id)).toContain('papa');
    expect(partida.aciertos).toBe(0);
    // el fallo SÍ queda contado, para el reporte del adulto
    expect(partida.fallos).toBe(1);
    expect(partida.intentos).toBe(1);
  });

  it('soltar en el vacío no cuenta como intento', () => {
    const partida = crearPartida(familia);
    const r = intentar(partida, 'papa', null);
    expect(r.correcto).toBe(false);
    expect(partida.intentos).toBe(0);
    expect(partida.fallos).toBe(0);
  });

  it('se completa cuando todas las personas tienen su auto', () => {
    const partida = crearPartida(familia);
    intentar(partida, 'papa', 'a-papa');
    const r = intentar(partida, 'mama', 'a-mama');
    expect(r.completada).toBe(true);
    expect(r.quedan).toBe(0);
    expect(estaCompletada(partida)).toBe(true);
  });

  it('una persona ya resuelta no vuelve a contar', () => {
    const partida = crearPartida(familia);
    intentar(partida, 'papa', 'a-papa');
    const r = intentar(partida, 'papa', 'a-papa');
    expect(r.correcto).toBe(true);
    expect(partida.aciertos).toBe(1);
    expect(partida.intentos).toBe(1);
  });

  it('un auto ya tomado no se ofrece como libre', () => {
    const partida = crearPartida(familia);
    intentar(partida, 'papa', 'a-papa');
    expect(autosLibres(partida).map((a) => a.id)).toEqual(['a-mama']);
  });

  it('reiniciar deja todo pendiente otra vez', () => {
    const partida = crearPartida(familia);
    intentar(partida, 'papa', 'a-papa');
    reiniciar(partida);
    expect(personasPendientes(partida).length).toBe(2);
    expect(partida.aciertos).toBe(0);
  });

  it('sabe cuál es el auto correcto de cada persona', () => {
    const partida = crearPartida(familia);
    expect(autoCorrecto(partida, 'mama')?.id).toBe('a-mama');
    expect(autoCorrecto(partida, 'fantasma')).toBeNull();
  });

  it('funciona con el contenido real de la familia (los 6 pares)', () => {
    const bruto: unknown = JSON.parse(readFileSync(new URL('../../../packages/contenido/data/familia.json', import.meta.url), 'utf8'));
    const validada = validarFamilia(bruto);
    expect(validada.ok).toBe(true);
    const partida = crearPartida(validada.valor!);
    // se resuelven todos, en el orden del contenido
    let resultado = intentar(partida, 'nada', null);
    for (const persona of [...partida.familia.personas]) {
      const auto = autoCorrecto(partida, persona.id)!;
      resultado = intentar(partida, persona.id, auto.id);
      expect(resultado.correcto).toBe(true);
    }
    expect(resultado.completada).toBe(true);
    expect(partida.aciertos).toBe(6);
  });
});
