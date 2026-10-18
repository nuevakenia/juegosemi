/**
 * El estado puro del editor: las operaciones de alto nivel que dispara cada botón.
 * Se prueba sin navegador: son sólo datos entrando y saliendo.
 */
import { describe, expect, it } from 'vitest';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  conCosa,
  conTitulo,
  crearNivelEnConstruccion,
  elegirCuando,
  idDesdeNombre,
  idLibre,
  idsDe,
  moverRegla,
  nivelDeArranque,
  nombreDe,
  ponerValorAccion,
  ponerValorCuando,
  quitarAccion,
  quitarRegla,
  reglaPorId,
  sinCosa,
} from './estado.ts';

describe('el estado del editor', () => {
  it('arranca en blanco', () => {
    const nivel = crearNivelEnConstruccion();
    expect(nivel.reglas).toEqual([]);
    expect(nivel.entidades).toEqual([]);
    expect(nivel.id).toBe('mi-juego');
  });

  it('el nivel de arranque ya trae con qué jugar', () => {
    const nivel = nivelDeArranque();
    expect(idsDe(nivel, 'entidades')).toEqual(['la-maleta', 'el-auto']);
    expect(idsDe(nivel, 'contadores')).toEqual(['maletas']);
  });

  it('saca el id del nombre y le suma un número si ya está usado', () => {
    expect(idDesdeNombre('La casa de la tía')).toBe('la-casa-de-la-tia');
    expect(idDesdeNombre('¡¡¡')).toBe('cosa');
    expect(idLibre(['maleta'], 'maleta')).toBe('maleta-2');
    expect(idLibre(['maleta', 'maleta-2'], 'maleta')).toBe('maleta-3');
    expect(idLibre([], 'auto')).toBe('auto');
  });

  it('agrega y saca cosas de una categoría', () => {
    let nivel = conCosa(crearNivelEnConstruccion(), 'zonas', 'La casa');
    expect(idsDe(nivel, 'zonas')).toEqual(['la-casa']);
    nivel = conCosa(nivel, 'zonas', 'la casa');
    expect(idsDe(nivel, 'zonas')).toEqual(['la-casa', 'la-casa-2']);
    nivel = sinCosa(nivel, 'zonas', 'la-casa');
    expect(idsDe(nivel, 'zonas')).toEqual(['la-casa-2']);
  });

  it('un nombre vacío no agrega nada', () => {
    const nivel = conCosa(crearNivelEnConstruccion(), 'entidades', '   ');
    expect(nivel.entidades).toEqual([]);
  });

  it('cambia el título', () => {
    expect(conTitulo(crearNivelEnConstruccion(), 'El viaje').titulo).toBe('El viaje');
  });

  it('encuentra el nombre de una cosa por su id', () => {
    const nivel = conCosa(crearNivelEnConstruccion(), 'entidades', 'El auto');
    expect(nombreDe(nivel, 'el-auto')).toBe('El auto');
    expect(nombreDe(nivel, 'no-esta')).toBe('no-esta');
  });

  it('agrega una regla en blanco y la borra', () => {
    let nivel = agregarReglaEnBlanco(crearNivelEnConstruccion());
    expect(nivel.reglas.length).toBe(1);
    expect(nivel.reglas[0]?.cuandoId).toBeNull();
    expect(nivel.reglas[0]?.acciones).toEqual([]);
    nivel = agregarReglaEnBlanco(nivel);
    expect(nivel.reglas.map((r) => r.id)).toEqual(['regla', 'regla-2']);
    nivel = quitarRegla(nivel, 'regla');
    expect(nivel.reglas.map((r) => r.id)).toEqual(['regla-2']);
  });

  it('elegir el cuándo arranca las respuestas con sus valores por defecto', () => {
    let nivel = agregarReglaEnBlanco(crearNivelEnConstruccion());
    nivel = elegirCuando(nivel, 'regla', 'toca', { veces: 1 });
    expect(reglaPorId(nivel, 'regla')?.cuandoId).toBe('toca');
    expect(reglaPorId(nivel, 'regla')?.cuandoValores).toEqual({ veces: 1 });
  });

  it('saca las acciones que dejan de tener sentido al cambiar el cuándo', () => {
    let nivel = conCosa(conCosa(crearNivelEnConstruccion(), 'zonas', 'casa'), 'contadores', 'maletas');
    nivel = agregarReglaEnBlanco(nivel);
    const valores = {};
    nivel = elegirCuando(nivel, 'regla', 'zona', valores);
    nivel = agregarAccion(nivel, 'regla', 'video', { video: 'casa-de-la-tia' });
    nivel = agregarAccion(nivel, 'regla', 'suma', { contador: 'maletas', cuanto: 1 });
    expect(reglaPorId(nivel, 'regla')?.acciones.length).toBe(2);
    // Una zona paga video; un toque no.
    nivel = elegirCuando(nivel, 'regla', 'toca', { veces: 1 });
    expect(reglaPorId(nivel, 'regla')?.acciones.map((a) => a.entoncesId)).toEqual(['suma']);
  });

  it('responde el QUIEN y completa las acciones', () => {
    let nivel = conCosa(conCosa(crearNivelEnConstruccion(), 'entidades', 'maleta'), 'contadores', 'maletas');
    nivel = agregarReglaEnBlanco(nivel);
    nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'maleta');
    expect(reglaPorId(nivel, 'regla')?.cuandoValores['destino']).toBe('maleta');
    nivel = agregarAccion(nivel, 'regla', 'suma', { contador: 'maletas', cuanto: 1 });
    nivel = ponerValorAccion(nivel, 'regla', 0, 'cuanto', 5);
    expect(reglaPorId(nivel, 'regla')?.acciones[0]?.valores['cuanto']).toBe(5);
    nivel = quitarAccion(nivel, 'regla', 0);
    expect(reglaPorId(nivel, 'regla')?.acciones).toEqual([]);
  });

  it('mueve una regla de lugar sin salirse de la lista', () => {
    let nivel = agregarReglaEnBlanco(crearNivelEnConstruccion());
    nivel = agregarReglaEnBlanco(nivel);
    nivel = moverRegla(nivel, 'regla-2', -1);
    expect(nivel.reglas.map((r) => r.id)).toEqual(['regla-2', 'regla']);
    expect(moverRegla(nivel, 'regla-2', -1).reglas.map((r) => r.id)).toEqual(['regla-2', 'regla']);
  });
});
