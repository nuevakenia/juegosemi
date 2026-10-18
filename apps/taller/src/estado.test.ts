// Pruebas del estado del taller: es puro, así que se prueba sin navegador.
import { describe, expect, it } from 'vitest';
import type { CatalogoCaras } from '@juegosemi/personajes';
import { catalogosDeCaras } from '@juegosemi/personajes';
import {
  PARTES,
  acotarSeleccion,
  conContorno,
  conIndice,
  conPaleta,
  esSeleccionValida,
  opcionesDeParte,
  rasgosDeSeleccion,
  seleccionInicial,
  textoBoton,
  type Seleccion,
} from './estado.ts';

/** Un catálogo de mentira, chico, para no depender de los datos reales. */
const CATALOGO: CatalogoCaras = {
  id: 'prueba',
  nombre: 'Prueba',
  ojos: ['a', 'b', 'c'],
  cejas: ['ceja-a', 'ceja-b'],
  narices: ['nariz-a'],
  bocas: ['boca-a'],
  pelos: ['pelo-a', 'pelo-b'],
};

function base(): Seleccion {
  return seleccionInicial('familia', 'prueba');
}

describe('estado del taller', () => {
  it('arranca con índices en cero y contorno encendido', () => {
    const s = base();

    expect(s.indices).toEqual({ ojos: 0, cejas: 0, nariz: 0, pelo: 0 });
    expect(s.contorno).toBe(true);
  });

  it('cambia la paleta sin mutar la selección original', () => {
    const s = base();
    const otra = conPaleta(s, 'noche');

    expect(otra.idPaleta).toBe('noche');
    expect(s.idPaleta).toBe('familia');
  });

  it('cambia el contorno sin mutar la original', () => {
    const s = base();
    const apagado = conContorno(s, false);

    expect(apagado.contorno).toBe(false);
    expect(s.contorno).toBe(true);
  });

  it('da la vuelta al índice cuando se pasa del final', () => {
    const s = conIndice(base(), 'ojos', 3, 3);

    expect(s.indices.ojos).toBe(0);
  });

  it('da la vuelta hacia atrás desde el cero', () => {
    const s = conIndice(base(), 'ojos', -1, 3);

    expect(s.indices.ojos).toBe(2);
  });

  it('no se rompe si la parte no tiene opciones', () => {
    const s = conIndice(base(), 'nariz', 5, 0);

    expect(s.indices.nariz).toBe(0);
  });

  it('traduce el nombre de la parte a la lista del catálogo', () => {
    expect(opcionesDeParte(CATALOGO, 'nariz')).toEqual(['nariz-a']);
    expect(opcionesDeParte(CATALOGO, 'pelo')).toEqual(['pelo-a', 'pelo-b']);
  });

  it('arma el texto del botón estilo Mii', () => {
    expect(textoBoton('ojos', 1)).toBe('Ojos 2');
    expect(textoBoton('pelo', 0)).toBe('Pelo 1');
  });

  it('traduce los índices a texturas de cara, con las piezas correctas', () => {
    const s: Seleccion = { ...base(), indices: { ojos: 1, cejas: 0, nariz: 0, pelo: 1 } };
    const rasgos = rasgosDeSeleccion(s, CATALOGO);

    expect(rasgos['ojo-izq']?.textura).toBe('b');
    expect(rasgos['ojo-der']?.textura).toBe('b');
    expect(rasgos['ceja-izq']?.textura).toBe('ceja-a');
    expect(rasgos.nariz?.textura).toBe('nariz-a');
    expect(rasgos.pelo?.textura).toBe('pelo-b');
  });

  it('usa el catálogo real sin romperse', () => {
    const catalogo = catalogosDeCaras()[0];
    expect(catalogo).not.toBeUndefined();
    if (!catalogo) return;
    const rasgos = rasgosDeSeleccion(seleccionInicial('familia', catalogo.id), catalogo);

    expect(rasgos['ojo-izq']?.textura).toBe(catalogo.ojos[0]);
    expect(rasgos.pelo?.textura).toBe(catalogo.pelos[0]);
  });

  it('acota un índice que quedó fuera de rango', () => {
    const s = acotarSeleccion(
      { ...base(), indices: { ojos: 99, cejas: 0, nariz: 0, pelo: -3 } },
      CATALOGO,
    );

    expect(s.indices.ojos).toBe(2);
    expect(s.indices.pelo).toBe(0);
  });

  it('reconoce una selección bien formada', () => {
    expect(esSeleccionValida(base())).toBe(true);
  });

  it('rechaza datos incompletos o corruptos', () => {
    expect(esSeleccionValida(null)).toBe(false);
    expect(esSeleccionValida({})).toBe(false);
    expect(esSeleccionValida({ idPaleta: 'x' })).toBe(false);
    expect(
      esSeleccionValida({ idPaleta: 'x', idCara: 'y', contorno: true, indices: { ojos: 0 } }),
    ).toBe(false);
    expect(
      esSeleccionValida({
        idPaleta: 'x',
        idCara: 'y',
        contorno: true,
        indices: { ojos: 0, cejas: 0, nariz: 0, pelo: -1 },
      }),
    ).toBe(false);
  });

  it('expone las cuatro partes en orden', () => {
    expect([...PARTES]).toEqual(['ojos', 'cejas', 'nariz', 'pelo']);
  });
});
