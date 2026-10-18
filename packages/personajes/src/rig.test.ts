import { describe, it, expect } from 'vitest';
import { armar, Rig } from './rig.ts';
import { aGrados } from './matriz.ts';
import type { Paleta, PlantillaRig } from './tipo.ts';

// Plantilla de prueba, chica y con números redondos, para poder verificar a mano.
const plantilla: PlantillaRig = {
  id: 'p1',
  nombre: 'Prueba',
  altoReferencia: 40,
  raiz: 'torso',
  piezas: [
    { id: 'torso', padre: null, desplazamiento: { x: 0, y: 0 }, tamano: { ancho: 20, alto: 40 }, pivote: { x: 10, y: 0 }, orden: 1, rol: 'camisa' },
    { id: 'brazo', padre: 'torso', desplazamiento: { x: 0, y: 2 }, tamano: { ancho: 8, alto: 20 }, pivote: { x: 4, y: 2 }, orden: 2, rol: 'piel' },
    { id: 'gema', padre: 'brazo', desplazamiento: { x: 0, y: 18 }, tamano: { ancho: 6, alto: 6 }, pivote: { x: 3, y: 3 }, orden: 3, color: '#ff0000' },
  ],
};

const paleta: Paleta = { id: 'familia', nombre: 'Familia', colores: { camisa: '#2f6fb3', piel: '#f2c79c' } };

function centrar(rig: Rig, id: string, pose?: Parameters<Rig['conPose']>[0]) {
  const pieza = rig.obtener(id, pose);
  if (!pieza) throw new Error(`no existe la pieza ${id}`);
  return pieza;
}

describe('Rig: armado de las piezas', () => {
  const rig = armar(plantilla, paleta);

  it('resuelve todas las piezas en orden de dibujo (atrás primero)', () => {
    const piezas = rig.conPose();
    expect(piezas.map((p) => p.id)).toEqual(['torso', 'brazo', 'gema']);
    expect(piezas.map((p) => p.padre)).toEqual([null, 'torso', 'brazo']);
  });

  it('deja cada pieza en el lugar que dicen los datos', () => {
    // torso: rect 0..20 x 0..40 → centro (10, 20)
    expect(centrar(rig, 'torso').x).toBeCloseTo(10, 8);
    expect(centrar(rig, 'torso').y).toBeCloseTo(20, 8);
    // brazo: origen local (0,2) → centro (4, 12)
    expect(centrar(rig, 'brazo').x).toBeCloseTo(4, 8);
    expect(centrar(rig, 'brazo').y).toBeCloseTo(12, 8);
    // gema: cuelga del brazo, centro (3, 23)
    expect(centrar(rig, 'gema').x).toBeCloseTo(3, 8);
    expect(centrar(rig, 'gema').y).toBeCloseTo(23, 8);
  });

  it('saca el color por ROL desde la paleta', () => {
    expect(centrar(rig, 'torso').color).toBe(0x2f6fb3);
    expect(centrar(rig, 'brazo').color).toBe(0xf2c79c);
  });

  it('usa el color literal cuando la pieza no tiene rol', () => {
    expect(centrar(rig, 'gema').color).toBe(0xff0000);
  });

  it('los rasgos del personaje ganan sobre la plantilla', () => {
    const conRasgos = armar(plantilla, paleta, {
      id: 'pepe',
      nombre: 'Pepe',
      plantilla: 'p1',
      paleta: 'familia',
      rasgos: { torso: { color: '#00ff00' }, brazo: { rol: 'camisa' } },
    });
    expect(centrar(conRasgos, 'torso').color).toBe(0x00ff00);
    expect(centrar(conRasgos, 'brazo').color).toBe(0x2f6fb3);
  });

  it('devuelve null para una pieza que no existe', () => {
    expect(rig.obtener('nada')).toBeNull();
    expect(rig.tiene('brazo')).toBe(true);
    expect(rig.tiene('nada')).toBe(false);
  });

  it('expone el alto total y los ids en orden jerárquico', () => {
    expect(rig.alto()).toBe(40);
    expect(rig.ids()).toEqual(['torso', 'brazo', 'gema']);
  });
});

describe('Rig: articulación', () => {
  const rig = armar(plantilla, paleta);

  it('cuando gira el hombro se mueve TODO el brazo (la gema también)', () => {
    const pose = { grados: { brazo: 90 } };
    const brazo = centrar(rig, 'brazo', pose);
    const gema = centrar(rig, 'gema', pose);
    // el hombro es (4,4) en el sistema del torso: gira 90° sobre su pivote
    expect(brazo.x).toBeCloseTo(-4, 6);
    expect(brazo.y).toBeCloseTo(4, 6);
    expect(aGrados(brazo.rot)).toBeCloseTo(90, 6);
    // y la gema, que está colgada 18 abajo, viaja con él
    expect(gema.x).toBeCloseTo(-15, 6);
    expect(gema.y).toBeCloseTo(3, 6);
    // sin girar estaba en (3, 23): se movió de verdad
    expect(gema.y).not.toBeCloseTo(23, 2);
  });

  it('el giro de la pose se SUMA al giro de reposo de la plantilla', () => {
    const conGiroDeReposo = armar(
      { ...plantilla, piezas: plantilla.piezas.map((p) => (p.id === 'brazo' ? { ...p, grados: 10 } : p)) },
      paleta,
    );
    const brazo = centrar(conGiroDeReposo, 'brazo', { grados: { brazo: 5 } });
    expect(aGrados(brazo.rot)).toBeCloseTo(15, 6);
  });

  it('una pieza espejada se reporta al revés (escalaY negativa)', () => {
    const conEspejo = armar(
      {
        ...plantilla,
        piezas: plantilla.piezas.map((p) => (p.id === 'brazo' ? { ...p, escala: { x: -1, y: 1 } } : p)),
      },
      paleta,
    );
    const brazo = centrar(conEspejo, 'brazo');
    expect(brazo.escalaY).toBeLessThan(0);
    expect(Math.abs(brazo.escalaX)).toBeCloseTo(1, 8);
  });

  it('la escala de la pose estira la pieza (así se abre la boca)', () => {
    const abierta = centrar(rig, 'gema', { escalas: { gema: { x: 1, y: 3 } } });
    expect(abierta.escalaY).toBeCloseTo(3, 8);
    expect(abierta.escalaX).toBeCloseTo(1, 8);
    expect(abierta.alto).toBe(6);
  });

  it('la pose puede esconder una pieza', () => {
    const gema = centrar(rig, 'gema', { visible: { gema: false } });
    expect(gema.visible).toBe(false);
    expect(rig.dibujos({ pose: { visible: { gema: false } } }).some((d) => d.id.endsWith(':gema'))).toBe(false);
  });

  it('acepta piezas nuevas de una plantilla sin romperse', () => {
    const grande: PlantillaRig = {
      ...plantilla,
      piezas: [...plantilla.piezas, { id: 'sombra', padre: 'torso', desplazamiento: { x: 2, y: 2 }, tamano: { ancho: 4, alto: 4 }, pivote: { x: 2, y: 2 }, orden: 0 }],
    };
    const r = armar(grande, paleta);
    expect(r.ids()).toContain('sombra');
    // la sombra tiene orden 0, así que se dibuja ANTES que el torso
    expect(r.conPose()[0]?.id).toBe('sombra');
  });
});

describe('Rig: dibujos para el adaptador de render', () => {
  const rig = armar(plantilla, paleta);

  it('sale una entidad por pieza visible, con id prefijado y orden creciente', () => {
    const dibujos = rig.dibujos();
    expect(dibujos.length).toBe(3);
    expect(dibujos.map((d) => d.id)).toEqual(['p1:torso', 'p1:brazo', 'p1:gema']);
    const ordenes = dibujos.map((d) => d.orden);
    expect([...ordenes].sort((a, b) => a - b)).toEqual(ordenes);
  });

  it('el zoom mueve y escala la entidad, pero el tamaño canónico queda igual', () => {
    const dibujos = rig.dibujos({ escala: 2, x: 100, y: 50 });
    const torso = dibujos.find((d) => d.id === 'p1:torso');
    if (!torso) throw new Error('falta el torso');
    expect(torso.x).toBeCloseTo(100 + 10 * 2, 8);
    expect(torso.y).toBeCloseTo(50 + 20 * 2, 8);
    expect(torso.escalaX).toBeCloseTo(2, 8);
    expect(torso.ancho).toBe(20);
    expect(torso.alto).toBe(40);
  });

  it('una textura forzada gana (por acá entra el visema de la boca)', () => {
    const dibujos = rig.dibujos({ texturas: { gema: 'boca-a' } });
    const gema = dibujos.find((d) => d.id === 'p1:gema');
    expect(gema?.textura).toBe('boca-a');
    expect(gema?.color).toBe(0xff0000);
  });

  it('el contorno agrega una pieza oscura detrás de cada pieza de color', () => {
    const conContorno = armar(plantilla, paleta, undefined, { contorno: true });
    const dibujos = conContorno.dibujos();
    const contornos = dibujos.filter((d) => d.id.endsWith(':contorno'));
    expect(contornos.length).toBe(3);
    const gemaContorno = contornos.find((d) => d.id === 'p1:gema:contorno');
    expect(gemaContorno).toBeDefined();
    expect(gemaContorno!.color).not.toBe(0xff0000);
    // el contorno va DETRÁS de su pieza
    const gema = dibujos.find((d) => d.id === 'p1:gema');
    expect(gemaContorno!.orden).toBeLessThan(gema!.orden);
  });

  it('respeta la opacidad pedida', () => {
    expect(rig.dibujos({ alfa: 0.5 })[0]?.alfa).toBe(0.5);
  });
});
