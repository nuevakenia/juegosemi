import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validarFamilia, type Familia } from '@juegosemi/contenido';
import { disenarTablero, casillaDeOrigen } from './layout.ts';

const familia: Familia = JSON.parse(
  readFileSync(new URL('../../../packages/contenido/data/familia.json', import.meta.url), 'utf8'),
) as Familia;

const PANTALLAS = [
  { nombre: 'celular chico', ancho: 360, alto: 640 },
  { nombre: 'celular grande', ancho: 412, alto: 915 },
  { nombre: 'tablet 10" vertical', ancho: 800, alto: 1280 },
  { nombre: 'tablet 10" horizontal', ancho: 1280, alto: 800 },
  { nombre: 'PC', ancho: 1600, alto: 900 },
];

describe('el tablero entra en la pantalla y no se superpone', () => {
  for (const pantalla of PANTALLAS) {
    it(`en ${pantalla.nombre} (${pantalla.ancho}x${pantalla.alto})`, () => {
      const tablero = disenarTablero(familia, pantalla.ancho, pantalla.alto);
      expect(tablero.casillas.length).toBe(familia.personas.length + familia.autos.length);

      for (const c of tablero.casillas) {
        // todo dentro de la pantalla
        expect(c.x - c.ancho / 2).toBeGreaterThanOrEqual(0);
        expect(c.x + c.ancho / 2).toBeLessThanOrEqual(pantalla.ancho);
        expect(c.y - c.alto / 2).toBeGreaterThanOrEqual(tablero.franjaAviso - 1);
        expect(c.y + c.alto / 2).toBeLessThanOrEqual(pantalla.alto);
        // la pieza es tocable con el dedo (mínimo cómodo para un niño)
        expect(Math.min(c.ancho, c.alto)).toBeGreaterThanOrEqual(40);
      }

      // ninguna casilla se superpone con otra del MISMO grupo
      const personas = tablero.casillas.filter((c) => c.clase === 'persona');
      const autos = tablero.casillas.filter((c) => c.clase === 'auto');
      for (const grupo of [personas, autos]) {
        for (let i = 0; i < grupo.length; i++) {
          for (let j = i + 1; j < grupo.length; j++) {
            const a = grupo[i]!;
            const b = grupo[j]!;
            const solapanX = Math.abs(a.x - b.x) < (a.ancho + b.ancho) / 2 - 1;
            const solapanY = Math.abs(a.y - b.y) < (a.alto + b.alto) / 2 - 1;
            expect(solapanX && solapanY).toBe(false);
          }
        }
      }

      // las personas quedan arriba de los autos
      const maxYPersonas = Math.max(...personas.map((c) => c.y + c.alto / 2));
      const minYAutos = Math.min(...autos.map((c) => c.y - c.alto / 2));
      expect(maxYPersonas).toBeLessThanOrEqual(minYAutos + 1);
    });
  }
});

describe('casilla de origen', () => {
  it('devuelve la casilla de la persona', () => {
    const tablero = disenarTablero(familia, 800, 600);
    expect(casillaDeOrigen(tablero, 'caco')?.id).toBe('persona:caco');
  });
  it('devuelve null si esa persona no está', () => {
    const tablero = disenarTablero(familia, 800, 600);
    expect(casillaDeOrigen(tablero, 'nadie')).toBeNull();
  });
});
