/**
 * El test que importa: los DATOS reales de la casa.
 *
 * No inventamos personajes de prueba: se carga `data/` tal cual, se valida, se
 * arma a Emiliano y se mira que el rig se comporte como un cuerpo (que los dos
 * lados sean espejo, que el hombro mueva el brazo entero, que la boca hable).
 * Si alguien edita un JSON y lo rompe, acá salta.
 */

import { describe, it, expect } from 'vitest';
import {
  problemasDeDatos,
  datosSanos,
  plantillaPorId,
  paletaPorId,
  animacionPorId,
  animacionesDePersonaje,
  catalogoDeCarasPorId,
  personajePorId,
  personajes,
  armarPersonaje,
  armarPlantilla,
  tablaVisemas,
} from './catalogo.ts';
import { Boca, bloquesDeTexto } from './boca.ts';
import { rasgosDeCara } from './cara.ts';
import { armar } from './rig.ts';
import { poseEnTiempo } from './pose.ts';

describe('los datos del paquete están sanos', () => {
  it('no hay un solo problema en los JSON', () => {
    expect(problemasDeDatos()).toEqual([]);
    expect(datosSanos()).toBe(true);
  });

  it('cada personaje apunta a una plantilla, una paleta y animaciones que existen', () => {
    for (const personaje of personajes()) {
      expect(plantillaPorId(personaje.plantilla)).not.toBeNull();
      expect(paletaPorId(personaje.paleta)).not.toBeNull();
      expect(animacionesDePersonaje(personaje).length).toBe(personaje.animaciones?.length ?? 0);
    }
  });
});

describe('la plantilla del humano cabezón', () => {
  const plantilla = plantillaPorId('humano-cabezon');

  it('existe y tiene el cuerpo completo', () => {
    expect(plantilla).not.toBeNull();
    expect(plantilla?.altoReferencia).toBe(240);
    expect(plantilla?.raiz).toBe('torso');
    expect(plantilla?.piezas.length).toBe(22);
  });

  it('los dos lados del cuerpo son espejo exacto uno del otro', () => {
    if (!plantilla) throw new Error('falta la plantilla');
    const rig = armar(plantilla, paletaPorId('familia')!);
    const pares = ['brazo-sup', 'brazo-inf', 'mano', 'pierna-sup', 'pierna-inf', 'pie'];
    for (const par of pares) {
      const izq = rig.obtener(`${par}-izq`);
      const der = rig.obtener(`${par}-der`);
      if (!izq || !der) throw new Error(`falta el par ${par}`);
      expect(der.x).toBeCloseTo(-izq.x, 6);
      expect(der.y).toBeCloseTo(izq.y, 6);
      expect(izq.escalaY).toBeGreaterThan(0);
      expect(der.escalaY).toBeLessThan(0);
    }
  });

  it('la cabeza queda centrada y arriba de todo', () => {
    const rig = armar(plantilla!, paletaPorId('familia')!);
    const cabeza = rig.obtener('cabeza');
    expect(cabeza?.x).toBeCloseTo(0, 6);
    // el rectángulo va de 0 a 80, así que el centro está en 40
    expect(cabeza?.y).toBeCloseTo(40, 6);
  });

  it('las piernas van por detrás del torso y la cara por delante de la cabeza', () => {
    const rig = armar(plantilla!, paletaPorId('familia')!);
    const orden = (id: string) => rig.obtener(id)?.orden ?? -1;
    expect(orden('pie-izq')).toBeLessThan(orden('torso'));
    expect(orden('pierna-sup-izq')).toBeLessThan(orden('torso'));
    expect(orden('brazo-sup-izq')).toBeGreaterThan(orden('torso'));
    expect(orden('cara')).toBeGreaterThan(orden('cabeza'));
    expect(orden('boca')).toBeGreaterThan(orden('cara'));
  });

  it('los pies llegan al piso de la grilla canónica', () => {
    const rig = armar(plantilla!, paletaPorId('familia')!);
    const pie = rig.obtener('pie-izq');
    // centro del pie + medio alto = el fondo del personaje
    expect((pie?.y ?? 0) + (pie?.alto ?? 0) / 2).toBeCloseTo(240, 6);
  });
});

describe('armar a los personajes de la casa', () => {
  it('todos se arman con el cuerpo completo', () => {
    for (const personaje of personajes()) {
      const rig = armarPersonaje(personaje.id);
      expect(rig, `no se pudo armar a ${personaje.id}`).not.toBeNull();
      expect(rig?.conPose().length).toBe(22);
      expect(rig?.ids()).toContain('boca');
    }
  });

  it('los rasgos del personaje pisan la plantilla (Emiliano va de rojo)', () => {
    const rig = armarPersonaje('emiliano');
    expect(rig?.obtener('torso')?.color).toBe(0xd9483b);
    expect(rig?.obtener('pelo')?.color).toBe(0x3a2a1a);
    // el que no tiene rasgo usa el rol de la paleta
    expect(rig?.obtener('pierna-sup-izq')?.color).toBe(0x3b4a5a);
  });

  it('cambiar de paleta repinta al personaje entero', () => {
    const deDia = armarPlantilla('humano-cabezon', 'familia');
    const deNoche = armarPlantilla('humano-cabezon', 'noche');
    expect(deDia?.obtener('torso')?.color).not.toBe(deNoche?.obtener('torso')?.color);
    expect(deNoche?.obtener('cara')?.color).not.toBe(deDia?.obtener('cara')?.color);
  });

  it('el Caco usa la paleta de noche', () => {
    const caco = armarPersonaje('el-caco');
    expect(caco?.obtener('cara')?.color).toBe(0xc9a17d);
  });

  it('un personaje que no existe devuelve null (no inventa nada)', () => {
    expect(personajePorId('nadie')).toBeNull();
    expect(armarPersonaje('nadie')).toBeNull();
  });

  it('la cara del catálogo se puede aplicar encima de un personaje', () => {
    const caras = catalogoDeCarasPorId('familia');
    if (!caras) throw new Error('falta el catálogo de caras');
    const emiliano = personajePorId('emiliano');
    if (!emiliano) throw new Error('falta Emiliano');
    const conCara = { ...emiliano, rasgos: { ...emiliano.rasgos, ...rasgosDeCara(caras, { ojos: 'ojo-contento' }) } };
    const rig = armar(plantillaPorId('humano-cabezon')!, paletaPorId('familia')!, conCara);
    expect(rig.obtener('ojo-izq')?.textura).toBe('ojo-contento');
    expect(rig.obtener('ojo-der')?.textura).toBe('ojo-contento');
  });
});

describe('las animaciones mueven el cuerpo de verdad', () => {
  it('caminar es un ciclo', () => {
    const caminar = animacionPorId('caminar');
    expect(caminar?.bucle).toBe(true);
    expect(caminar?.duracion).toBe(0.8);
  });

  it('en caminar las piernas van para lados opuestos', () => {
    const caminar = animacionPorId('caminar')!;
    const inicio = poseEnTiempo(caminar, 0);
    const mitad = poseEnTiempo(caminar, 0.4);
    expect(inicio.grados?.['pierna-sup-izq']).toBe(22);
    expect(mitad.grados?.['pierna-sup-izq']).toBeCloseTo(-22, 6);
    // la rodilla sigue al muslo: sin girar el muslo, la pantorrilla va sola
    expect(inicio.grados?.['pierna-inf-izq']).toBe(-10);
  });

  it('aplicar la pose de caminar mueve el pie en el mundo', () => {
    const rig = armarPersonaje('emiliano')!;
    const parado = rig.obtener('pie-izq')!;
    const caminar = animacionPorId('caminar')!;
    const enPaso = rig.obtener('pie-izq', poseEnTiempo(caminar, 0))!;
    expect(Math.abs(enPaso.x - parado.x)).toBeGreaterThan(1);
    expect(Math.abs(enPaso.y - parado.y)).toBeGreaterThan(1);
  });

  it('el brazo entero sigue al hombro (saludar levanta la mano)', () => {
    const rig = armarPersonaje('emiliano')!;
    const saludar = animacionPorId('saludar')!;
    const parado = rig.obtener('mano-der')!;
    const saludando = rig.obtener('mano-der', poseEnTiempo(saludar, 0.25))!;
    // la mano arranca abajo (y≈171) y sube por encima del hombro
    expect(saludando.y).toBeLessThan(parado.y - 30);
    expect(saludando.y).toBeLessThan(rig.obtener('torso')!.y);
  });

  it('saltar levanta al personaje entero del piso', () => {
    const rig = armarPersonaje('emiliano')!;
    const saltar = animacionPorId('saltar')!;
    const parado = rig.obtener('torso')!;
    const enElAire = rig.obtener('torso', poseEnTiempo(saltar, 0.32))!;
    expect(enElAire.y).toBeLessThan(parado.y - 20);
    expect(saltar.bucle).toBe(false);
  });
});

describe('la boca de ventrílocuo con la tabla real', () => {
  it('la tabla carga y tiene formas para las vocales', () => {
    const tabla = tablaVisemas();
    expect(tabla).not.toBeNull();
    expect(tabla?.cerrada).toBe('cerrada');
    expect(tabla?.letras['a']).toBe('a');
    expect(tabla?.letras['m']).toBe('m');
    expect(tabla?.letras['h']).toBe('l');
  });

  it('parte un texto real en bloques de boca', () => {
    const tabla = tablaVisemas()!;
    const bloques = bloquesDeTexto(tabla, 'hola Emiliano');
    expect(bloques.length).toBeGreaterThan(10);
    expect(bloques[0]?.visema.id).toBe('l');
    // hay por lo menos una pausa (el espacio)
    expect(bloques.some((b) => b.visema.id === 'cerrada')).toBe(true);
  });

  it('la boca habla: abre en la A y cierra al terminar', () => {
    const tabla = tablaVisemas()!;
    const boca = new Boca(tabla);
    boca.decir('mama', 0);
    expect(boca.hablando(0)).toBe(true);
    // la primera M cierra los labios, la segunda letra (A) los abre
    expect(boca.apertura(0)).toBeLessThan(0.1);
    expect(boca.apertura(0.1)).toBe(1);
    expect(boca.hablando(5)).toBe(false);
    expect(boca.apertura(5)).toBe(0);
  });

  it('la boca abierta estira la pieza de la boca en el rig armado', () => {
    const rig = armarPersonaje('emiliano')!;
    const tabla = tablaVisemas()!;
    const boca = new Boca(tabla);
    boca.decir('a', 0);
    const abierta = rig.dibujos(boca.opcionesDibujo(0)).find((d) => d.id === 'emiliano:boca')!;
    const cerrada = rig.dibujos(boca.opcionesDibujo(5)).find((d) => d.id === 'emiliano:boca')!;
    expect(abierta.textura).toBe('boca-a');
    // con la boca abierta la pieza se estira; con la boca de silencio queda chica
    expect(abierta.escalaY).toBeGreaterThan(cerrada.escalaY);
    expect(abierta.escalaY / cerrada.escalaY).toBeCloseTo(1 / 0.35, 4);
  });
});

describe('los dibujos que come el adaptador de render', () => {
  it('sale una entidad por pieza, con el id del personaje adelante y en orden', () => {
    const rig = armarPersonaje('emiliano')!;
    const dibujos = rig.dibujos();
    expect(dibujos.length).toBe(22);
    expect(dibujos.every((d) => d.id.startsWith('emiliano:'))).toBe(true);
    const ordenes = dibujos.map((d) => d.orden);
    expect([...ordenes].sort((a, b) => a - b)).toEqual(ordenes);
    expect(dibujos.every((d) => d.color !== null)).toBe(true);
  });

  it('con contorno salen más entidades (una oscura detrás de cada pieza)', () => {
    const simple = armarPersonaje('emiliano')!.dibujos().length;
    const conContorno = armarPersonaje('emiliano', { contorno: true })!.dibujos().length;
    expect(conContorno).toBeGreaterThan(simple);
    expect(conContorno).toBe(44);
  });

  it('a escala 2 y corrido, el personaje se dibuja del tamaño pedido', () => {
    const rig = armarPersonaje('emiliano')!;
    const pie = rig.dibujos({ escala: 2, x: 500, y: 300 }).find((d) => d.id === 'emiliano:pie-izq')!;
    const canonico = rig.obtener('pie-izq')!;
    expect(pie.x).toBeCloseTo(500 + canonico.x * 2, 6);
    expect(pie.escalaX).toBeCloseTo(2, 6);
    expect(pie.ancho).toBe(canonico.ancho);
  });
});
