import { describe, it, expect } from 'vitest';
import {
  animaciones,
  armarPersonaje,
  datosSanos,
  personajePorId,
  personajes,
  plantillas,
  problemasDeDatos,
} from './index.ts';

/**
 * Estas pruebas no son "de adorno": cuando se escribieron, `catalogo.ts` tenía
 * una referencia a una variable que no existía (`carasBrutas`) y los 96 tests
 * anteriores pasaban igual, porque nadie ejecutaba el catálogo. Moraleja
 * registrada: un paquete con datos tiene que TENER un test que los recorra.
 */
describe('personajes: los datos reales cargan y se pueden usar', () => {
  it('no hay problemas en los datos (si falla, el detalle dice cuál)', () => {
    expect(problemasDeDatos()).toEqual([]);
    expect(datosSanos()).toBe(true);
  });

  it('hay plantillas, animaciones y personajes cargados', () => {
    expect(plantillas().length).toBeGreaterThan(0);
    expect(animaciones().length).toBeGreaterThan(0);
    expect(personajes().length).toBeGreaterThan(0);
  });

  it('cada personaje apunta a una plantilla que existe', () => {
    const ids = new Set(plantillas().map((p) => p.id));
    for (const personaje of personajes()) {
      expect(ids.has(personaje.plantilla), `${personaje.id} → ${personaje.plantilla}`).toBe(true);
    }
  });

  it('arma un personaje y lo dibuja de punta a punta (sin arte, con contorno)', () => {
    const primero = personajes()[0];
    expect(primero).toBeDefined();
    const rig = armarPersonaje(primero!.id, { contorno: true });
    expect(rig).not.toBeNull();
    const dibujos = rig!.dibujos({ x: 100, y: 200, escala: 2 });
    expect(dibujos.length).toBeGreaterThan(1);
    for (const dibujo of dibujos) {
      expect(Number.isFinite(dibujo.x), dibujo.id).toBe(true);
      expect(Number.isFinite(dibujo.escalaX), dibujo.id).toBe(true);
      expect(Number.isFinite(dibujo.escalaY), dibujo.id).toBe(true);
    }
  });

  it('un personaje que no existe devuelve null, no explota', () => {
    expect(armarPersonaje('no-existe')).toBeNull();
    expect(personajePorId('no-existe')).toBeNull();
  });
});
