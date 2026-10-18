/**
 * La vista de misiones, desde el estado puro: prerrequisitos EN ORDEN, cómo se
 * cumple cada una, su premio, y el aviso en castellano si el orden se muerde la
 * cola. Todo sin navegador: son datos entrando y saliendo.
 */
import { describe, expect, it } from 'vitest';
import type { NivelEnConstruccion } from './estado.ts';
import {
  alternarRequiere,
  conCosa,
  conRequiere,
  crearNivelEnConstruccion,
  elegirCumple,
  misionPorId,
  moverRequiere,
  ponerRecompensa,
  ponerValorCumple,
  sinCosa,
} from './estado.ts';
import { misionesDe, misionesCompletas, nivelLogico } from './construir.ts';
import { avisoDeCiclo, candidatasARequisito } from './misiones.ts';

/** Un nivel con tres misiones y un contador. */
function nivelConMisiones(): NivelEnConstruccion {
  let nivel = conCosa(crearNivelEnConstruccion(), 'contadores', 'maletas');
  nivel = conCosa(nivel, 'misiones', 'subir las maletas');
  nivel = conCosa(nivel, 'misiones', 'manejar');
  nivel = conCosa(nivel, 'misiones', 'llegar');
  return nivel;
}

/** Le pone a una misión una condición de contador (para que se pueda cumplir). */
function conCumpleDeContador(
  nivel: NivelEnConstruccion,
  misionId: string,
  alMenos: number,
): NivelEnConstruccion {
  let siguiente = elegirCumple(nivel, misionId, 'contador', { al_menos: alMenos });
  siguiente = ponerValorCumple(siguiente, misionId, 'contador', 'maletas');
  return siguiente;
}

describe('las misiones del editor', () => {
  it('conCosa crea misiones con la forma de misión (sin condición, sin deps, sin premio)', () => {
    const nivel = conCosa(crearNivelEnConstruccion(), 'misiones', 'subir las maletas');
    expect(nivel.misiones.map((m) => m.id)).toEqual(['subir-las-maletas']);
    expect(nivel.misiones[0]?.cumpleId).toBeNull();
    expect(nivel.misiones[0]?.requiere).toEqual([]);
    expect(nivel.misiones[0]?.recompensa).toBeNull();
  });

  it('los prerrequisitos quedan EN EL ORDEN en que se ponen', () => {
    let nivel = nivelConMisiones();
    nivel = conRequiere(nivel, 'llegar', ['manejar', 'subir-las-maletas']);
    expect(misionPorId(nivel, 'llegar')?.requiere).toEqual(['manejar', 'subir-las-maletas']);

    // Cambiar el orden de la lista es cambiar el orden en que se piden.
    nivel = conRequiere(nivel, 'llegar', ['subir-las-maletas', 'manejar']);
    expect(misionPorId(nivel, 'llegar')?.requiere).toEqual(['subir-las-maletas', 'manejar']);
  });

  it('conRequiere saca los repetidos y la propia misión', () => {
    let nivel = nivelConMisiones();
    nivel = conRequiere(nivel, 'llegar', ['manejar', 'manejar', 'llegar', 'subir-las-maletas']);
    expect(misionPorId(nivel, 'llegar')?.requiere).toEqual(['manejar', 'subir-las-maletas']);
  });

  it('alternarRequiere prende al final y apaga al toque', () => {
    let nivel = nivelConMisiones();
    nivel = alternarRequiere(nivel, 'llegar', 'manejar');
    nivel = alternarRequiere(nivel, 'llegar', 'subir-las-maletas');
    expect(misionPorId(nivel, 'llegar')?.requiere).toEqual(['manejar', 'subir-las-maletas']);

    nivel = alternarRequiere(nivel, 'llegar', 'manejar');
    expect(misionPorId(nivel, 'llegar')?.requiere).toEqual(['subir-las-maletas']);
  });

  it('moverRequiere sube y baja sin salirse de la lista', () => {
    let nivel = nivelConMisiones();
    nivel = conRequiere(nivel, 'llegar', ['manejar', 'subir-las-maletas']);

    expect(moverRequiere(nivel, 'llegar', 'manejar', -1).misiones[2]?.requiere).toEqual(['manejar', 'subir-las-maletas']);
    expect(moverRequiere(nivel, 'llegar', 'subir-las-maletas', -1).misiones[2]?.requiere).toEqual(['subir-las-maletas', 'manejar']);
    expect(moverRequiere(nivel, 'llegar', 'manejar', 1).misiones[2]?.requiere).toEqual(['subir-las-maletas', 'manejar']);
  });

  it('una misión NO se puede requerir a sí misma', () => {
    const nivel = nivelConMisiones();
    const con = alternarRequiere(nivel, 'llegar', 'llegar');
    expect(misionPorId(con, 'llegar')?.requiere).toEqual([]);
  });

  it('guarda el cómo se cumple y el premio', () => {
    let nivel = conCumpleDeContador(nivelConMisiones(), 'subir-las-maletas', 3);
    nivel = ponerRecompensa(nivel, 'subir-las-maletas', 'casa-de-la-tia');
    const mision = misionPorId(nivel, 'subir-las-maletas');
    expect(mision?.cumpleId).toBe('contador');
    expect(mision?.cumpleValores).toEqual({ al_menos: 3, contador: 'maletas' });
    expect(mision?.recompensa).toBe('casa-de-la-tia');
  });

  it('sólo escribe en el nivel las misiones que ya dicen cómo se cumplen', () => {
    let nivel = nivelConMisiones();
    expect(misionesDe(nivel)).toEqual([]);
    expect(misionesCompletas(nivel)).toBe(0);

    nivel = conCumpleDeContador(nivel, 'subir-las-maletas', 3);
    expect(misionesCompletas(nivel)).toBe(1);
    const escritas = nivelLogico(nivel).misiones ?? [];
    expect(escritas.map((m) => m.id)).toEqual(['subir-las-maletas']);
    expect(escritas[0]?.cumple).toEqual({ contador: 'maletas', al_menos: 3 });
  });

  it('la recompensa de una misión se escribe como el video-premio y el festejo', () => {
    let nivel = conCumpleDeContador(nivelConMisiones(), 'llegar', 1);
    nivel = ponerRecompensa(nivel, 'llegar', 'video-de-la-prima');
    const mision = (nivelLogico(nivel).misiones ?? [])[0];
    expect(mision?.recompensa).toEqual([
      { tipo: 'reproducir_video', video: 'video-de-la-prima' },
      { tipo: 'celebrar' },
    ]);
  });

  it('deja el orden de los prerrequisitos tal cual en el nivel de la lógica', () => {
    let nivel = conCumpleDeContador(nivelConMisiones(), 'manejar', 1);
    nivel = conCumpleDeContador(nivel, 'llegar', 2);
    nivel = conRequiere(nivel, 'llegar', ['manejar']);
    nivel = conRequiere(nivel, 'manejar', []);

    const misiones = nivelLogico(nivel).misiones ?? [];
    const llegar = misiones.find((m) => m.id === 'llegar');
    expect(llegar?.requiere).toEqual(['manejar']);
  });

  it('avisa en castellano cuando las misiones se piden en rueda', () => {
    let nivel = nivelConMisiones();
    nivel = conCumpleDeContador(nivel, 'manejar', 1);
    nivel = conCumpleDeContador(nivel, 'llegar', 1);
    nivel = conRequiere(nivel, 'manejar', ['llegar']);
    nivel = conRequiere(nivel, 'llegar', ['manejar']);

    const aviso = avisoDeCiclo(nivel);
    expect(aviso).not.toBeNull();
    expect(aviso ?? '').toContain('rueda');
    // El aviso nombra una misión de verdad, no un id ni un campo.
    expect(aviso ?? '').toMatch(/manejar|llegar/i);
  });

  it('no avisa nada cuando el orden cierra', () => {
    let nivel = nivelConMisiones();
    nivel = conCumpleDeContador(nivel, 'manejar', 1);
    nivel = conCumpleDeContador(nivel, 'llegar', 1);
    nivel = conRequiere(nivel, 'llegar', ['manejar']);
    expect(avisoDeCiclo(nivel)).toBeNull();
  });

  it('las candidatas a «antes» son todas menos la propia', () => {
    const nivel = nivelConMisiones();
    expect(candidatasARequisito(nivel, 'llegar').map((m) => m.id)).toEqual([
      'subir-las-maletas',
      'manejar',
    ]);
  });

  it('borrar una misión la saca de la lista', () => {
    const nivel = sinCosa(nivelConMisiones(), 'misiones', 'manejar');
    expect(nivel.misiones.map((m) => m.id)).toEqual(['subir-las-maletas', 'llegar']);
  });
});
