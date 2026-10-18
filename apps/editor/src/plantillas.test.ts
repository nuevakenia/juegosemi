/**
 * Las plantillas: que ofrezcan SÓLO lo que tiene sentido y que todo lo que ofrecen
 * exista de verdad en la lógica.
 *
 * Es la prueba que cuida la regla más importante del editor: no se inventan
 * acciones ni condiciones. Cada opción que se le muestra al grande calza con algo
 * que `@juegosemi/logica` sabe evaluar.
 */
import { describe, expect, it } from 'vitest';
import { GESTOS_CONOCIDOS, validarNivel } from '@juegosemi/logica';
import type { Accion } from '@juegosemi/logica';
import {
  ENTIDAD_ACTUAL,
  GESTOS,
  PLANTILLAS_CUANDO,
  PLANTILLAS_ENTONCES,
  accionesQueTienenSentido,
  entoncesDisponibles,
  plantillaCuando,
  plantillaEntonces,
  tieneSentido,
  type PlantillaEntonces,
} from './plantillas.ts';
import { accionDe } from './construir.ts';
import type { Respuestas } from './estado.ts';

/** Una respuesta de mentira que sirve para cada tipo de pregunta. */
function respuestaDeTipo(tipo: string): string | number {
  if (tipo === 'numero') return 1;
  if (tipo === 'gesto') return 'circulo';
  if (tipo === 'frase') return 'hola';
  if (tipo === 'sonido') return 'bien';
  if (tipo === 'video') return 'casa-de-la-tia';
  return 'una-cosa';
}

/** Respuestas completas para una plantilla de ENTONCES. */
function respuestasDe(plantilla: PlantillaEntonces): Respuestas {
  const valores: Respuestas = {};
  for (const pregunta of plantilla.preguntas) valores[pregunta.clave] = respuestaDeTipo(pregunta.tipo);
  return valores;
}

describe('las plantillas del editor', () => {
  it('no repite ids ni entre los CUANDO ni entre los ENTONCES', () => {
    const cuandos = PLANTILLAS_CUANDO.map((p) => p.id);
    expect(new Set(cuandos).size).toBe(cuandos.length);
    const entoncess = PLANTILLAS_ENTONCES.map((p) => p.id);
    expect(new Set(entoncess).size).toBe(entoncess.length);
  });

  it('cada CUANDO ofrece sólo acciones que existen como plantilla', () => {
    const ids = new Set(PLANTILLAS_ENTONCES.map((p) => p.id));
    for (const cuando of PLANTILLAS_CUANDO) {
      expect(cuando.acciones.length).toBeGreaterThan(0);
      for (const accion of cuando.acciones) expect(ids.has(accion)).toBe(true);
    }
  });

  it('los gestos que ofrece son exactamente los que reconoce la lógica', () => {
    expect([...GESTOS]).toEqual([...GESTOS_CONOCIDOS]);
  });

  it('un toque suelto no paga un video ni termina el nivel, pero una meta sí', () => {
    for (const cuando of ['toca', 'suelta_sobre', 'gesto']) {
      expect(tieneSentido(cuando, 'video')).toBe(false);
      expect(tieneSentido(cuando, 'termina')).toBe(false);
      expect(tieneSentido(cuando, 'desaparece')).toBe(true);
      expect(tieneSentido(cuando, 'suma')).toBe(true);
    }
    for (const cuando of ['contador', 'zona', 'mision']) {
      expect(tieneSentido(cuando, 'video')).toBe(true);
      expect(tieneSentido(cuando, 'termina')).toBe(true);
    }
  });

  it('entoncesDisponibles filtra de verdad (no devuelve todo por todo)', () => {
    const deToque = entoncesDisponibles('toca').map((p) => p.id);
    const deMeta = entoncesDisponibles('zona').map((p) => p.id);
    expect(deToque).not.toContain('video');
    expect(deMeta).toContain('video');
    expect(deMeta.length).toBeGreaterThan(deToque.length);
  });

  it('sin cuándo elegido no se ofrece ninguna acción', () => {
    expect(accionesQueTienenSentido(null)).toEqual([]);
    expect(entoncesDisponibles(null)).toEqual([]);
  });

  it('un id que no existe no es una plantilla', () => {
    expect(plantillaCuando('no-existe')).toBeNull();
    expect(plantillaEntonces('no-existe')).toBeNull();
  });

  it('cada acción que ofrece el editor existe para el validador de la lógica', () => {
    for (const plantilla of PLANTILLAS_ENTONCES) {
      const accion = accionDe(plantilla.id, respuestasDe(plantilla));
      expect(accion).not.toBeNull();
      const nivel = {
        id: 'prueba',
        reglas: [{ id: 'r', hacer: [accion as Accion] }],
      };
      const revision = validarNivel(nivel);
      expect(revision.errores.filter((e) => e.includes('acción desconocida'))).toEqual([]);
    }
  });

  it('el comodín "lo que se suelta" sólo aparece donde tiene sentido', () => {
    expect(ENTIDAD_ACTUAL).toBe('$entidad');
    const desaparece = plantillaEntonces('desaparece');
    expect(desaparece?.preguntas[0]?.admiteEntidadActual).toBe(true);
    const dice = plantillaEntonces('dice');
    expect(dice?.preguntas[0]?.admiteEntidadActual).not.toBe(true);
  });
});
