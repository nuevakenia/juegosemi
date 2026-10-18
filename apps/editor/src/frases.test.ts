/**
 * La frase de cada regla: es lo que el grande lee para saber qué armó.
 * Se prueba el ejemplo canónico del viaje a la casa de la tía.
 */
import { describe, expect, it } from 'vitest';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  conCosa,
  crearNivelEnConstruccion,
  elegirCuando,
  ponerValorAccion,
  ponerValorCuando,
  type NivelEnConstruccion,
} from './estado.ts';
import { fraseDeAccion, fraseDeRegla, unirEnumeracion } from './frases.ts';

/** Un nivel con la primera regla en blanco y las cosas del viaje. */
function base(): NivelEnConstruccion {
  let nivel = crearNivelEnConstruccion();
  nivel = conCosa(nivel, 'entidades', 'la maleta');
  nivel = conCosa(nivel, 'entidades', 'el auto');
  nivel = conCosa(nivel, 'entidades', 'la manivela');
  nivel = conCosa(nivel, 'contadores', 'maletas');
  nivel = conCosa(nivel, 'zonas', 'la casa');
  nivel = conCosa(nivel, 'misiones', 'llegar');
  return agregarReglaEnBlanco(nivel);
}

describe('la frase de una regla', () => {
  it('el ejemplo canónico se lee tal cual', () => {
    let nivel = base();
    nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'el-auto');
    nivel = ponerValorCuando(nivel, 'regla', 'entidad', 'la-maleta');
    nivel = agregarAccion(nivel, 'regla', 'desaparece', { objetivo: 'la-maleta' });
    nivel = agregarAccion(nivel, 'regla', 'suma', { contador: 'maletas', cuanto: 1 });
    const regla = nivel.reglas[0];
    expect(regla).toBeDefined();
    if (regla === undefined) return;
    expect(fraseDeRegla(nivel, regla)).toBe(
      'Cuando Emiliano suelta la maleta sobre el auto: desaparece la maleta y suma 1 a maletas',
    );
  });

  it('sin decir qué suelta, se lee "algo"', () => {
    let nivel = base();
    nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'el-auto');
    const regla = nivel.reglas[0];
    if (regla === undefined) return;
    expect(fraseDeRegla(nivel, regla)).toContain('Cuando Emiliano suelta algo sobre el auto');
  });

  it('el contador, la zona, la misión, el toque repetido y el gesto', () => {
    const casos: Array<{ cuando: string; valores: Record<string, string | number>; esperado: string }> = [
      { cuando: 'contador', valores: { contador: 'maletas', al_menos: 3 }, esperado: 'Cuando el contador maletas llega a 3' },
      { cuando: 'contador', valores: { contador: 'maletas' }, esperado: 'Cuando el contador maletas llega a …' },
      { cuando: 'zona', valores: { zona: 'la-casa' }, esperado: 'Cuando Emiliano llega a la casa' },
      { cuando: 'mision', valores: { mision: 'llegar' }, esperado: 'Cuando se cumple la misión llegar' },
      { cuando: 'toca', valores: { toco: 'la-maleta', veces: 5 }, esperado: 'Cuando Emiliano toca la maleta 5 veces' },
      {
        cuando: 'gesto',
        valores: { gesto: 'circulo', objetivo: 'la-manivela', veces: 3 },
        esperado: 'Cuando Emiliano da una vuelta sobre la manivela 3 veces',
      },
    ];
    for (const caso of casos) {
      let nivel = base();
      nivel = elegirCuando(nivel, 'regla', caso.cuando, caso.valores);
      for (const clave of Object.keys(caso.valores)) {
        const valor = caso.valores[clave];
        if (valor !== undefined) nivel = ponerValorCuando(nivel, 'regla', clave, valor);
      }
      const regla = nivel.reglas[0];
      if (regla === undefined) return;
      expect(fraseDeRegla(nivel, regla).startsWith(caso.esperado)).toBe(true);
    }
  });

  it('una regla a medio armar se lee igual, sin romperse', () => {
    const nivel = base();
    const regla = nivel.reglas[0];
    if (regla === undefined) return;
    expect(fraseDeRegla(nivel, regla)).toBe('Cuando …: (todavía no dice qué hace)');
  });

  it('el video se muestra con su título del catálogo', () => {
    let nivel = base();
    nivel = elegirCuando(nivel, 'regla', 'zona', {});
    nivel = ponerValorCuando(nivel, 'regla', 'zona', 'la-casa');
    nivel = agregarAccion(nivel, 'regla', 'video', { video: 'casa-de-la-tia' });
    const regla = nivel.reglas[0];
    if (regla === undefined) return;
    const accion = regla.acciones[0];
    if (accion === undefined) return;
    expect(fraseDeAccion(nivel, accion.entoncesId, accion.valores)).toBe('se ve el video «La casa de la tía»');
  });

  it('la acción de decir, sonar, abrir, terminar y el comodín', () => {
    const nivel = base();
    expect(fraseDeAccion(nivel, 'dice', { entidad: 'la-manivela', frase: '¡vamos!' })).toBe('la manivela dice «¡vamos!»');
    expect(fraseDeAccion(nivel, 'suena', { sonido: 'bien' })).toBe('suena bien');
    expect(fraseDeAccion(nivel, 'abre', { objeto: 'la-manivela' })).toBe('abre la manivela');
    expect(fraseDeAccion(nivel, 'termina', {})).toBe('termina el nivel');
    expect(fraseDeAccion(nivel, 'desaparece', { objetivo: '$entidad' })).toBe('desaparece lo que se suelta');
  });

  it('suma varias acciones con comas y un "y" al final', () => {
    expect(unirEnumeracion([])).toBe('');
    expect(unirEnumeracion(['a'])).toBe('a');
    expect(unirEnumeracion(['a', 'b'])).toBe('a y b');
    expect(unirEnumeracion(['a', 'b', 'c'])).toBe('a, b y c');
  });

  it('una acción que dejó de existir se marca con puntos suspensivos', () => {
    expect(fraseDeAccion(base(), 'no-existe', {})).toBe('…');
  });

  it('los cambios posteriores de una acción se ven en la frase', () => {
    let nivel = base();
    nivel = elegirCuando(nivel, 'regla', 'contador', { al_menos: 3 });
    nivel = ponerValorCuando(nivel, 'regla', 'contador', 'maletas');
    nivel = agregarAccion(nivel, 'regla', 'suma', { contador: 'maletas', cuanto: 1 });
    nivel = ponerValorAccion(nivel, 'regla', 0, 'cuanto', 7);
    const regla = nivel.reglas[0];
    if (regla === undefined) return;
    expect(fraseDeRegla(nivel, regla)).toBe('Cuando el contador maletas llega a 3: suma 7 a maletas');
  });
});
