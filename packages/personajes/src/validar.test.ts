import { describe, it, expect } from 'vitest';
import {
  validarPlantilla,
  validarPersonaje,
  validarCoherenciaPersonaje,
  validarPaleta,
  validarAnimacion,
  validarTablaVisemas,
  validarCatalogoCaras,
} from './validar.ts';
import type { PlantillaRig, PersonajeDatos } from './tipo.ts';

const plantillaChica = {
  id: 'p1',
  nombre: 'Prueba',
  altoReferencia: 100,
  raiz: 'torso',
  piezas: [
    { id: 'torso', desplazamiento: { x: 0, y: 0 }, tamano: { ancho: 20, alto: 40 } },
    { id: 'brazo', padre: 'torso', desplazamiento: { x: 0, y: 4 }, tamano: { ancho: 8, alto: 20 } },
  ],
};

describe('validarPlantilla', () => {
  it('acepta una plantilla bien formada', () => {
    const r = validarPlantilla(plantillaChica);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.valor?.piezas.length).toBe(2);
  });

  it('rechaza un id repetido', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [plantillaChica.piezas[0]!, { ...plantillaChica.piezas[1]!, id: 'torso' }],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('id repetido');
  });

  it('rechaza un padre que no existe (y lo nombra)', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [plantillaChica.piezas[0]!, { ...plantillaChica.piezas[1]!, padre: 'fantasma' }],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('fantasma');
  });

  it('rechaza una raíz que no existe', () => {
    const r = validarPlantilla({ ...plantillaChica, raiz: 'no-esta' });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('no-esta');
  });

  it('rechaza un pivote que se sale del rectángulo', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [{ ...plantillaChica.piezas[0]!, pivote: { x: 999, y: 0 } }, plantillaChica.piezas[1]!],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('se sale del rectángulo');
  });

  it('rechaza una pieza suelta (a la que no se llega desde la raíz)', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [...plantillaChica.piezas, { id: 'suelta', desplazamiento: { x: 0, y: 0 }, tamano: { ancho: 4, alto: 4 } }],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('no se llega desde la raíz');
  });

  it('rechaza un tamaño de 0 o negativo', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [{ ...plantillaChica.piezas[0]!, tamano: { ancho: 0, alto: 20 } }, plantillaChica.piezas[1]!],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('mayor que 0');
  });

  it('rechaza un color que no es hex', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [{ ...plantillaChica.piezas[0]!, color: 'azulito' }, plantillaChica.piezas[1]!],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('hex válido');
  });

  it('rechaza una pieza que es su propio padre', () => {
    const r = validarPlantilla({
      ...plantillaChica,
      piezas: [{ ...plantillaChica.piezas[0]!, padre: 'torso' }, plantillaChica.piezas[1]!],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('su propio padre');
  });

  it('rechaza algo que no es un objeto', () => {
    expect(validarPlantilla('hola').ok).toBe(false);
    expect(validarPlantilla(null).ok).toBe(false);
    expect(validarPlantilla([]).ok).toBe(false);
  });
});

describe('validarPersonaje', () => {
  const personaje = {
    id: 'pepe',
    nombre: 'Pepe',
    plantilla: 'p1',
    paleta: 'familia',
    rasgos: { torso: { color: '#ff0000', grados: 10 } },
    animaciones: ['quieto'],
  };

  it('acepta un personaje bien formado', () => {
    const r = validarPersonaje(personaje);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.valor?.rasgos?.['torso']?.grados).toBe(10);
  });

  it('exige plantilla y paleta', () => {
    const r = validarPersonaje({ id: 'x', nombre: 'x' });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('plantilla');
    expect(r.errores.join(' | ')).toContain('paleta');
  });

  it('rechaza un rasgo con color inválido', () => {
    const r = validarPersonaje({ ...personaje, rasgos: { torso: { color: 'rojo' } } });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('hex válido');
  });
});

describe('validarCoherenciaPersonaje', () => {
  const plantilla = validarPlantilla(plantillaChica).valor as PlantillaRig;
  const personaje: PersonajeDatos = {
    id: 'pepe',
    nombre: 'Pepe',
    plantilla: 'p1',
    paleta: 'familia',
    rasgos: { oreja: { color: '#ff0000' } },
    animaciones: ['volar'],
  };

  it('caza un rasgo que apunta a una pieza que no existe', () => {
    const errores = validarCoherenciaPersonaje(plantilla, personaje);
    expect(errores.join(' | ')).toContain('oreja');
  });

  it('caza una animación que no existe', () => {
    const errores = validarCoherenciaPersonaje(plantilla, personaje, [
      { id: 'quieto', nombre: 'quieto', duracion: 1, bucle: true, fotogramas: [{ en: 0, pose: {} }, { en: 1, pose: {} }] },
    ]);
    expect(errores.join(' | ')).toContain('volar');
  });

  it('no se queja cuando todo calza', () => {
    const sano: PersonajeDatos = { id: 'pepe', nombre: 'Pepe', plantilla: 'p1', paleta: 'familia', rasgos: { torso: { grados: 1 } } };
    expect(validarCoherenciaPersonaje(plantilla, sano)).toEqual([]);
  });
});

describe('validarPaleta', () => {
  it('acepta una paleta con colores hex', () => {
    const r = validarPaleta({ id: 'p', nombre: 'P', colores: { piel: '#f2c79c', camisa: '#abc' } });
    expect(r.ok).toBe(true);
    expect(r.valor?.colores['camisa']).toBe('#abc');
  });

  it('rechaza un color inválido diciendo cuál', () => {
    const r = validarPaleta({ id: 'p', nombre: 'P', colores: { piel: 'cafe' } });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('piel');
  });

  it('exige al menos un color', () => {
    expect(validarPaleta({ id: 'p', nombre: 'P', colores: {} }).ok).toBe(false);
  });
});

describe('validarAnimacion', () => {
  const animacion = {
    id: 'saltar',
    nombre: 'Saltar',
    duracion: 1,
    bucle: false,
    fotogramas: [
      { en: 0, pose: { grados: { torso: 0 } } },
      { en: 0.5, pose: { grados: { torso: 10 }, visible: { pelo: false } } },
      { en: 1, pose: { grados: { torso: 0 } } },
    ],
  };

  it('acepta una animación bien formada', () => {
    const r = validarAnimacion(animacion);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.valor?.fotogramas.length).toBe(3);
    expect(r.valor?.fotogramas[1]?.pose.visible?.['pelo']).toBe(false);
  });

  it('rechaza fotogramas desordenados', () => {
    const r = validarAnimacion({
      ...animacion,
      fotogramas: [{ en: 0.9, pose: {} }, { en: 0.2, pose: {} }],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('ordenados');
  });

  it('rechaza un fotograma que se pasa de la duración', () => {
    const r = validarAnimacion({
      ...animacion,
      fotogramas: [{ en: 0, pose: {} }, { en: 5, pose: {} }],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('se pasa de la duración');
  });

  it('exige duración positiva, bucle y al menos 2 fotogramas', () => {
    const r = validarAnimacion({ id: 'x', duracion: 0, fotogramas: [{ en: 0, pose: {} }] });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('mayor que 0');
    expect(r.errores.join(' | ')).toContain('bucle');
    expect(r.errores.join(' | ')).toContain('al menos 2 fotogramas');
  });

  it('rechaza una escala mal escrita en la pose', () => {
    const r = validarAnimacion({
      ...animacion,
      fotogramas: [{ en: 0, pose: { escalas: { boca: 'grande' } } }, { en: 1, pose: {} }],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('escalas');
  });
});

describe('validarTablaVisemas', () => {
  const tabla = {
    id: 'v',
    cerrada: 'cerrada',
    visemas: [
      { id: 'cerrada', boca: 'boca-cerrada', apertura: 0 },
      { id: 'a', boca: 'boca-a', apertura: 1 },
    ],
    letras: { a: 'a', m: 'cerrada' },
  };

  it('acepta una tabla bien formada', () => {
    const r = validarTablaVisemas(tabla);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('rechaza una letra que apunta a un visema que no existe', () => {
    const r = validarTablaVisemas({ ...tabla, letras: { a: 'a', z: 'no-existe' } });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('no-existe');
  });

  it('rechaza una apertura fuera de 0..1', () => {
    const r = validarTablaVisemas({ ...tabla, visemas: [tabla.visemas[0]!, { ...tabla.visemas[1]!, apertura: 3 }] });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('entre 0 y 1');
  });

  it('rechaza una boca cerrada que no está entre los visemas', () => {
    const r = validarTablaVisemas({ ...tabla, cerrada: 'nada' });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('nada');
  });
});

describe('validarCatalogoCaras', () => {
  it('acepta un catálogo completo', () => {
    const r = validarCatalogoCaras({
      id: 'c',
      nombre: 'C',
      ojos: ['ojo-normal'],
      cejas: ['ceja-normal'],
      narices: ['nariz-chica'],
      bocas: ['boca-sonrisa'],
      pelos: ['pelo-corto'],
    });
    expect(r.ok).toBe(true);
  });

  it('rechaza una parte vacía', () => {
    const r = validarCatalogoCaras({
      id: 'c',
      ojos: [],
      cejas: ['ceja-normal'],
      narices: ['nariz-chica'],
      bocas: ['boca-sonrisa'],
      pelos: ['pelo-corto'],
    });
    expect(r.ok).toBe(false);
    expect(r.errores.join(' | ')).toContain('caras.ojos');
  });
});
