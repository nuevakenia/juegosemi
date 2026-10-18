/**
 * Construir la lógica desde el editor, y que esa lógica CORRA.
 *
 * Las dos cosas que importan acá:
 *   1. cada plantilla del editor produce la condición y la acción de verdad
 *      (las mismas que usan los niveles escritos a mano);
 *   2. un nivel armado tocando botones se le puede dar al PUENTE y anda: se suelta
 *      una pieza sobre otra y pasa lo que dice la regla.
 */
import { describe, expect, it } from 'vitest';
import type { AccionResuelta } from '@juegosemi/logica';
import { Puente, validarNivel } from '@juegosemi/logica';
import { Escena } from '@juegosemi/motor';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  conCosa,
  crearNivelEnConstruccion,
  elegirCuando,
  ponerValorAccion,
  ponerValorCuando,
  reglaPorId,
  type NivelEnConstruccion,
  type ReglaEditor,
} from './estado.ts';
import { accionDe, nivelLogico, reglaEstaCompleta, reglasCompletas, valoresPorDefectoEntonces } from './construir.ts';

/** La regla de ese id (revienta si no está: es un error del test). */
function regla(nivel: NivelEnConstruccion, id: string): ReglaEditor {
  const encontrada = reglaPorId(nivel, id);
  if (encontrada === null) throw new Error(`no está la regla ${id}`);
  return encontrada;
}

/** Un nivel con las cosas que necesita cada caso. */
function nivelBase(): NivelEnConstruccion {
  let nivel = crearNivelEnConstruccion();
  nivel = conCosa(conCosa(conCosa(nivel, 'entidades', 'maleta'), 'entidades', 'auto'), 'contadores', 'maletas');
  nivel = conCosa(conCosa(nivel, 'zonas', 'casa'), 'interruptores', 'viaje');
  nivel = conCosa(conCosa(nivel, 'misiones', 'llegar'), 'entidades', 'manivela');
  return agregarReglaEnBlanco(nivel);
}

describe('construir la condición del cuándo', () => {
  it('toca', () => {
    let nivel = elegirCuando(nivelBase(), 'regla', 'toca', { veces: 1 });
    expect(nivelLogico(nivel).reglas[0]?.si).toBeUndefined();
    nivel = ponerValorCuando(nivel, 'regla', 'toco', 'maleta');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ toco: 'maleta' });
    nivel = ponerValorCuando(nivel, 'regla', 'veces', 3);
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ toco: 'maleta', veces: 3 });
  });

  it('suelta sobre', () => {
    let nivel = elegirCuando(nivelBase(), 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'auto');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ evento: 'entidad_soltada', destino: 'auto' });
    nivel = ponerValorCuando(nivel, 'regla', 'entidad', 'maleta');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ evento: 'entidad_soltada', destino: 'auto', entidad: 'maleta' });
  });

  it('gesto', () => {
    let nivel = elegirCuando(nivelBase(), 'regla', 'gesto', { veces: 3 });
    nivel = ponerValorCuando(nivel, 'regla', 'gesto', 'circulo');
    nivel = ponerValorCuando(nivel, 'regla', 'objetivo', 'manivela');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({
      evento: 'gesto_completado',
      gesto: 'circulo',
      destino: 'manivela',
      veces: 3,
    });
  });

  it('contador', () => {
    let nivel = elegirCuando(nivelBase(), 'regla', 'contador', { al_menos: 1 });
    nivel = ponerValorCuando(nivel, 'regla', 'contador', 'maletas');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ contador: 'maletas' });
    nivel = ponerValorCuando(nivel, 'regla', 'al_menos', 3);
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ contador: 'maletas', al_menos: 3 });
  });

  it('zona', () => {
    let nivel = elegirCuando(nivelBase(), 'regla', 'zona', {});
    nivel = ponerValorCuando(nivel, 'regla', 'zona', 'casa');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ evento: 'zona_entrada', zona: 'casa' });
  });

  it('misión', () => {
    let nivel = elegirCuando(nivelBase(), 'regla', 'mision', {});
    nivel = ponerValorCuando(nivel, 'regla', 'mision', 'llegar');
    expect(nivelLogico(nivel).reglas[0]?.si).toEqual({ mision: 'llegar', hecha: true });
  });

  it('sin el dato principal no se inventa un "siempre"', () => {
    const nivel = elegirCuando(nivelBase(), 'regla', 'toca', { veces: 1 });
    expect(nivelLogico(nivel).reglas[0]?.si).toBeUndefined();
  });
});

describe('construir las acciones del entonces', () => {
  it('una acción a medias no se escribe', () => {
    expect(accionDe('dice', { entidad: 'abuelo' })).toBeNull();
    expect(accionDe('dice', { entidad: 'abuelo', frase: '¡vamos!' })).toEqual({
      tipo: 'decir',
      entidad: 'abuelo',
      frase: '¡vamos!',
    });
    expect(accionDe('termina', {})).toEqual({ tipo: 'terminar_nivel' });
  });

  it('la regla queda incompleta mientras falte algo', () => {
    let nivel = nivelBase();
    nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'auto');
    nivel = agregarAccion(nivel, 'regla', 'dice', valoresPorDefectoEntonces(regla(nivel, 'regla'), 'dice'));
    expect(reglaEstaCompleta(regla(nivel, 'regla'))).toBe(false);
    nivel = ponerValorAccion(nivel, 'regla', 0, 'frase', '¡vamos!');
    expect(reglaEstaCompleta(regla(nivel, 'regla'))).toBe(true);
    expect(reglasCompletas(nivel)).toBe(1);
  });

  it('"desaparece" hereda el comodín de lo que se suelta', () => {
    const nivel = elegirCuando(nivelBase(), 'regla', 'suelta_sobre', {});
    expect(valoresPorDefectoEntonces(regla(nivel, 'regla'), 'desaparece')).toEqual({ objetivo: '$entidad' });
  });
});

describe('un nivel armado a botones corre de verdad', () => {
  it('al soltar la maleta sobre el auto: desaparece y suma', () => {
    // Lo mismo que se arma tocando: "Nueva regla → Suelta algo sobre algo → Auto →
    // ¿Qué suelta? Maleta → Entonces: desaparece (lo que se suelta) + suma 1 a maletas".
    let nivel = nivelBase();
    nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
    nivel = ponerValorCuando(nivel, 'regla', 'destino', 'auto');
    nivel = ponerValorCuando(nivel, 'regla', 'entidad', 'maleta');
    nivel = agregarAccion(nivel, 'regla', 'desaparece', valoresPorDefectoEntonces(regla(nivel, 'regla'), 'desaparece'));
    nivel = agregarAccion(nivel, 'regla', 'suma', valoresPorDefectoEntonces(regla(nivel, 'regla'), 'suma'));
    nivel = ponerValorAccion(nivel, 'regla', 1, 'contador', 'maletas');

    const logico = nivelLogico(nivel);
    expect(validarNivel(logico).ok).toBe(true);

    const escena = new Escena();
    escena.agregar({ id: 'maleta', x: 100, y: 300, ancho: 100, alto: 80 });
    escena.agregar({ id: 'auto', x: 500, y: 300, ancho: 160, alto: 100 });
    const efectos: AccionResuelta[] = [];
    const puente = new Puente(logico, { escena, avisos: { alEfecto: (accion) => efectos.push(accion) } });

    puente.soltar('maleta', 'auto', 500, 300);
    puente.paso(0);

    expect(puente.logica.mundo.contador('maletas')).toBe(1);
    expect(escena.obtener('maleta')?.visible).toBe(false);
    // El puente aplica `ocultar` sobre la escena directamente: no sale por `alEfecto`.
    expect(efectos).toEqual([]);
  });

  it('una regla de meta termina el nivel de verdad', () => {
    let nivel = nivelBase();
    nivel = elegirCuando(nivel, 'regla', 'zona', {});
    nivel = ponerValorCuando(nivel, 'regla', 'zona', 'casa');
    nivel = agregarAccion(nivel, 'regla', 'termina', {});
    const logico = nivelLogico(nivel);
    expect(validarNivel(logico).ok).toBe(true);

    const escena = new Escena();
    const puente = new Puente(logico, { escena });
    puente.entrarZona('casa', 'auto');
    const resultado = puente.paso(0);
    expect(resultado.nivelTerminado).toBe(true);
  });
});
