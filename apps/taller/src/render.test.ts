// Pruebas del encuadre: mide la caja real del rig y verifica que quede entero y
// centrado. Todo con números, sin navegador.
import { describe, expect, it } from 'vitest';
import { armarPlantilla, paletas } from '@juegosemi/personajes';
import { dibujarPersonaje, encuadrar, medirDibujos, medirRig, type Caja } from './render.ts';

function rigDePrueba() {
  const idPaleta = paletas()[0]?.id ?? 'familia';
  const rig = armarPlantilla('humano-cabezon', idPaleta, false);
  if (!rig) throw new Error('no se pudo armar el rig de prueba');
  return rig;
}

describe('encuadre del personaje', () => {
  it('mide una caja con alto y ancho positivos', () => {
    const caja = medirRig(rigDePrueba());

    expect(caja.alto).toBeGreaterThan(0);
    expect(caja.ancho).toBeGreaterThan(0);
    expect(caja.maxX).toBeGreaterThan(caja.minX);
    expect(caja.maxY).toBeGreaterThan(caja.minY);
  });

  it('confirma que el cuerpo cuelga hacia abajo del origen (no es la cabeza al centro)', () => {
    // Medido en el navegador: el origen de dibujos() es la cabeza y el cuerpo va
    // hacia abajo, así que la caja llega bastante por debajo del cero.
    const caja = medirRig(rigDePrueba());

    expect(caja.maxY).toBeGreaterThan(0);
    expect(caja.maxY).toBeGreaterThan(Math.abs(caja.minY));
  });

  it('centra una caja conocida dentro del área', () => {
    const caja: Caja = { minX: -50, minY: 0, maxX: 50, maxY: 200, ancho: 100, alto: 200 };
    const encuadre = encuadrar(400, 500, caja, 1);

    // El eje que más aprieta: alto 200 en 500 → 2.5; ancho 100 en 400 → 4. Gana 2.5.
    expect(encuadre.escala).toBeCloseTo(2.5, 5);
    expect(encuadre.x).toBeCloseTo(200, 5);
    expect(encuadre.y).toBeCloseTo(250 - 100 * 2.5, 5);
  });

  it('deja el personaje centrado y entero en un celular y en una tablet', () => {
    const rig = rigDePrueba();
    const pantallas: Array<{ ancho: number; alto: number }> = [
      { ancho: 320, alto: 480 },
      { ancho: 1024, alto: 768 },
    ];

    for (const pantalla of pantallas) {
      const dibujos = dibujarPersonaje(rig, pantalla.ancho, pantalla.alto);
      const caja = medirDibujos(dibujos);
      const medioX = (caja.minX + caja.maxX) / 2;
      const medioY = (caja.minY + caja.maxY) / 2;

      // centrado
      expect(medioX).toBeCloseTo(pantalla.ancho / 2, 0);
      expect(medioY).toBeCloseTo(pantalla.alto / 2, 0);
      // entero adentro, con aire
      expect(caja.minX).toBeGreaterThanOrEqual(0);
      expect(caja.minY).toBeGreaterThanOrEqual(0);
      expect(caja.maxX).toBeLessThanOrEqual(pantalla.ancho);
      expect(caja.maxY).toBeLessThanOrEqual(pantalla.alto);
    }
  });

  it('mide la caja vacía sin reventar', () => {
    expect(medirDibujos([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, ancho: 0, alto: 0 });
  });
});
