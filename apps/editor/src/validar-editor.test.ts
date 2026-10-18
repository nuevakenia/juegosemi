/**
 * La revisión en castellano claro: el editor le pregunta al validador de la lógica
 * y traduce. Lo que tiene que ser cierto: nunca le llega al grande un `reglas[1].si`,
 * sino "a la regla 2 le falta elegir el cuándo".
 */
import { describe, expect, it } from 'vitest';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  conCosa,
  crearNivelEnConstruccion,
  elegirCuando,
  ponerValorCuando,
  type NivelEnConstruccion,
} from './estado.ts';
import { AVISO_INCOMPLETO, mensajeAmable, revisar } from './validar-editor.ts';

/** Un nivel con una regla en blanco. */
function enBlanco(): NivelEnConstruccion {
  return agregarReglaEnBlanco(conCosa(crearNivelEnConstruccion(), 'entidades', 'maleta'));
}

describe('la revisión del editor', () => {
  it('un nivel en blanco no cierra y dice qué falta, sin jerga', () => {
    const revision = revisar(enBlanco());
    expect(revision.ok).toBe(false);
    expect(revision.mensajes.length).toBeGreaterThan(0);
    for (const mensaje of revision.mensajes) {
      expect(mensaje).not.toContain('[');
      expect(mensaje).not.toContain('reglas');
      expect(mensaje.length).toBeGreaterThan(0);
    }
  });

  it('un error que no conozco igual sale con un texto corto y claro', () => {
    const mensaje = mensajeAmable('algo rarísimo que el validador nunca dijo');
    expect(mensaje).toContain('Algo no cierra');
  });

  it('traduce los avisos técnicos del validador', () => {
    expect(mensajeAmable('reglas[0]: no hace nada (falta "hacer")')).toBe('La regla 1 todavía no dice qué hace.');
    expect(mensajeAmable('reglas[3]: no hace nada (falta "hacer")')).toBe('La regla 4 todavía no dice qué hace.');
    expect(mensajeAmable('reglas[1].si: no sé qué condición es (campos: ninguno)')).toBe('La regla 2 todavía no tiene un cuándo.');
    expect(mensajeAmable('reglas[1].hacer[0]: acción desconocida "volar"')).toBe('La regla 2 pide algo que no sé hacer.');
    expect(mensajeAmable('id: el nivel necesita un id (texto, no vacío)')).toBe('El juego necesita un nombre.');
  });

  it('un nivel armado a botones cierra', () => {
    let nivel = conCosa(conCosa(crearNivelEnConstruccion(), 'entidades', 'maleta'), 'entidades', 'auto');
    nivel = agregarReglaEnBlanco(nivel);
    nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'auto');
    nivel = agregarAccion(nivel, 'regla', 'desaparece', { objetivo: '$entidad' });
    const revision = revisar(nivel);
    expect(revision.ok).toBe(true);
    expect(revision.mensajes).toEqual([]);
  });

  it('el aviso de incompleto no culpa a nadie', () => {
    expect(AVISO_INCOMPLETO).toBe('Todavía falta algo para poder probarlo.');
  });
});
