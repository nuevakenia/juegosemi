/**
 * El escenario, probado sin navegador.
 *
 * Lo que importa que sea cierto (y que es lo que rompe un juego para un niño que
 * arrastra con el dedo): que las piezas sean GRANDES, que ninguna quede fuera de
 * la pantalla ni encima de otra, que la casa sea una ZONA de verdad, y que la
 * manivela nazca escondida (la muestra la lógica cuando ya están las maletas).
 */
import { describe, expect, it } from 'vitest';
import {
  ID_ABUELO,
  ID_AUTO,
  ID_CASA,
  ID_MANIVELA,
  IDS_MALETAS,
  ZONA_CASA,
  armarEscenario,
  centroEnZona,
  disenarEscenario,
  seSuperponen,
} from './escenario.ts';

/** Los tamaños que se prueban: celular, tablet, PC y tablet acostada. */
const TAMANOS: Array<[number, number]> = [
  [360, 640],
  [800, 600],
  [1280, 800],
  [640, 360],
];

describe('el escenario del episodio: las piezas están y son las que van', () => {
  it('trae las tres maletas, el auto, la casa (zona), la manivela y el abuelo', () => {
    const escenario = armarEscenario(800, 600);
    expect(escenario.piezas.maletas).toEqual(['maleta-1', 'maleta-2', 'maleta-3']);
    expect(escenario.escena.obtener(ID_AUTO)).not.toBeNull();
    expect(escenario.escena.obtener(ID_CASA)).not.toBeNull();
    expect(escenario.escena.obtener(ID_MANIVELA)).not.toBeNull();
    expect(escenario.escena.obtener(ID_ABUELO)).not.toBeNull();
    expect(escenario.escena.cantidad()).toBe(3 + 4);
  });

  it('la manivela nace ESCONDIDA: la muestra la lógica cuando el viaje arranca', () => {
    const escenario = armarEscenario(800, 600);
    expect(escenario.escena.obtener(ID_MANIVELA)?.visible).toBe(false);
    expect(escenario.escena.obtener(ID_AUTO)?.visible).toBe(true);
  });

  it('la casa es una zona con nombre y contiene su propio centro', () => {
    const escenario = armarEscenario(800, 600);
    const casa = escenario.escena.obtener(ID_CASA);
    expect(casa).not.toBeNull();
    expect(escenario.zonaCasa.nombre).toBe(ZONA_CASA);
    if (casa !== null) {
      expect(centroEnZona(escenario.zonaCasa, { x: casa.x, y: casa.y })).toBe(true);
      expect(centroEnZona(escenario.zonaCasa, { x: casa.x + casa.ancho, y: casa.y + casa.alto })).toBe(false);
    }
  });

  it('el reparto es una función pura: mismo tamaño, mismo diseño', () => {
    const a = disenarEscenario(800, 600);
    const b = disenarEscenario(800, 600);
    expect(a.colocaciones).toEqual(b.colocaciones);
    expect(a.zonaCasa).toEqual(b.zonaCasa);
  });
});

describe('el escenario entra en cualquier pantalla (celular, tablet y PC)', () => {
  for (const [ancho, alto] of TAMANOS) {
    it(`en ${ancho}×${alto} nada se sale y nada se pisa`, () => {
      const escenario = armarEscenario(ancho, alto);

      // 1. Todo adentro de la pantalla.
      for (const entidad of escenario.escena.todas()) {
        const izquierda = entidad.x - entidad.ancho / 2;
        const derecha = entidad.x + entidad.ancho / 2;
        const arriba = entidad.y - entidad.alto / 2;
        const abajo = entidad.y + entidad.alto / 2;
        expect(izquierda).toBeGreaterThanOrEqual(-0.001);
        expect(derecha).toBeLessThanOrEqual(ancho + 0.001);
        expect(arriba).toBeGreaterThanOrEqual(-0.001);
        expect(abajo).toBeLessThanOrEqual(alto + 0.001);
      }

      // 2. Las piezas son grandes (un dedo chico tiene que poder con ellas).
      for (const id of IDS_MALETAS) {
        const maleta = escenario.escena.obtener(id);
        expect(maleta).not.toBeNull();
        if (maleta !== null) expect(Math.min(maleta.ancho, maleta.alto)).toBeGreaterThan(44);
      }

      // 3. Ninguna maleta arranca encima del auto: hay que arrastrarla de verdad.
      const auto = escenario.escena.obtener(ID_AUTO);
      expect(auto).not.toBeNull();
      if (auto !== null) {
        for (const id of IDS_MALETAS) {
          const maleta = escenario.escena.obtener(id);
          if (maleta !== null) expect(seSuperponen(maleta, auto)).toBe(false);
        }
      }

      // 4. Ninguna maleta arranca encima de la casa (esa es la meta, no el depósito).
      const casa = escenario.escena.obtener(ID_CASA);
      if (casa !== null) {
        for (const id of IDS_MALETAS) {
          const maleta = escenario.escena.obtener(id);
          if (maleta !== null) expect(seSuperponen(maleta, casa)).toBe(false);
        }
      }
    });
  }
});

