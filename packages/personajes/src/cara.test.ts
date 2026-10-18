import { describe, it, expect } from 'vitest';
import { rasgosDeCara, elegirDeCatalogo, tieneTextura, PIEZAS_DE_CARA_POR_DEFECTO } from './cara.ts';
import { colorANumero, aRgb } from './color.ts';
import type { CatalogoCaras } from './tipo.ts';

const catalogo: CatalogoCaras = {
  id: 'familia',
  nombre: 'Familia',
  ojos: ['ojo-normal', 'ojo-grande'],
  cejas: ['ceja-normal'],
  narices: ['nariz-chica'],
  bocas: ['boca-sonrisa'],
  pelos: ['pelo-corto', 'pelo-largo'],
};

describe('elegirDeCatalogo', () => {
  it('acepta el id puesto a mano', () => {
    expect(elegirDeCatalogo(catalogo.ojos, 'ojo-grande')).toBe('ojo-grande');
  });

  it('acepta el número de la cara (como en los Miis)', () => {
    expect(elegirDeCatalogo(catalogo.ojos, '1')).toBe('ojo-grande');
  });

  it('si no se pide nada, usa el que corresponde por posición', () => {
    expect(elegirDeCatalogo(catalogo.ojos, undefined)).toBe('ojo-normal');
    expect(elegirDeCatalogo(catalogo.ojos, undefined, 1)).toBe('ojo-grande');
    expect(elegirDeCatalogo(catalogo.ojos, undefined, 5)).toBe('ojo-grande');
  });

  it('si el id no existe en el catálogo, cae al primero (nunca revienta)', () => {
    expect(elegirDeCatalogo(catalogo.ojos, 'ojo-verde')).toBe('ojo-normal');
  });

  it('devuelve null si el catálogo de esa parte está vacío', () => {
    expect(elegirDeCatalogo([], 'lo-que-sea')).toBeNull();
  });
});

describe('rasgosDeCara', () => {
  it('arma los rasgos de ojos, cejas, nariz y pelo', () => {
    const rasgos = rasgosDeCara(catalogo, {
      ojos: 'ojo-grande',
      cejas: 'ceja-normal',
      nariz: 'nariz-chica',
      pelo: 'pelo-largo',
    });
    expect(rasgos['ojo-izq']?.textura).toBe('ojo-grande');
    expect(rasgos['ojo-der']?.textura).toBe('ojo-grande');
    expect(rasgos['ceja-izq']?.textura).toBe('ceja-normal');
    expect(rasgos['nariz']?.textura).toBe('nariz-chica');
    expect(rasgos['pelo']?.textura).toBe('pelo-largo');
  });

  it('sin opciones usa el catálogo por defecto', () => {
    const rasgos = rasgosDeCara(catalogo);
    expect(rasgos['ojo-izq']?.textura).toBe('ojo-normal');
    expect(rasgos['pelo']?.textura).toBe('pelo-corto');
  });

  it('el pelo largo se resuelve estirando la pieza (no hace falta arte nuevo)', () => {
    const rasgos = rasgosDeCara(catalogo, { pelo: 'pelo-corto', peloLargo: true });
    expect(rasgos['pelo']?.escala?.y).toBeGreaterThan(1);
    expect(rasgos['pelo']?.desplazamiento?.y).toBeGreaterThan(0);
  });

  it('pinta la cara y la nariz con el color de piel pedido', () => {
    const rasgos = rasgosDeCara(catalogo, { colorPiel: '#f2c79c' });
    expect(colorANumero(rasgos['cara']?.color ?? '')).toBe(0xf2c79c);
    expect(colorANumero(rasgos['nariz']?.color ?? '')).toBe(0xf2c79c);
  });

  it('la sombra oscurece la cara', () => {
    const claro = rasgosDeCara(catalogo, { colorPiel: '#f2c79c' });
    const oscuro = rasgosDeCara(catalogo, { colorPiel: '#f2c79c', sombra: true });
    const c = aRgb(colorANumero(claro['cara']?.color ?? '') ?? 0);
    const o = aRgb(colorANumero(oscuro['cara']?.color ?? '') ?? 0);
    expect(o.r).toBeLessThan(c.r);
    expect(o.g).toBeLessThan(c.g);
    expect(o.b).toBeLessThan(c.b);
  });

  it('deja cambiar los ids de las piezas de la cara', () => {
    const rasgos = rasgosDeCara(catalogo, { ojos: 'ojo-normal', piezas: { ojoIzq: 'ojo-1', ojoDer: 'ojo-2' } });
    expect(rasgos['ojo-1']?.textura).toBe('ojo-normal');
    expect(rasgos['ojo-2']?.textura).toBe('ojo-normal');
    expect(rasgos[PIEZAS_DE_CARA_POR_DEFECTO.ojoIzq]).toBeUndefined();
  });
});

describe('tieneTextura', () => {
  it('dice si el catálogo tiene esa textura en esa parte', () => {
    expect(tieneTextura(catalogo, 'ojos', 'ojo-normal')).toBe(true);
    expect(tieneTextura(catalogo, 'ojos', 'ojo-verde')).toBe(false);
  });
});
