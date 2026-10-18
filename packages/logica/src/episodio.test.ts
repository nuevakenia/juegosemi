/**
 * El episodio entero, jugado paso a paso desde sus datos.
 *
 * Este es el test que importa: si esto pasa, un juego nuevo se puede escribir sin
 * tocar una línea de código. El nivel vive en data/viaje-casa-tia.json (el mismo
 * archivo que va a leer el juego y que el editor va a escribir).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AccionResuelta, Nivel } from './tipo.ts';
import { Logica } from './logica.ts';
import { validarNivel } from './validar.ts';

const nivel: Nivel = JSON.parse(
  readFileSync(new URL('../data/viaje-casa-tia.json', import.meta.url), 'utf8'),
) as Nivel;

function montar(): { logica: Logica; efectos: AccionResuelta[]; terminos: string[] } {
  const efectos: AccionResuelta[] = [];
  const terminos: string[] = [];
  const logica = new Logica(nivel, {
    aplicar: (accion) => efectos.push(accion),
    termino: (motivo) => terminos.push(motivo),
  });
  return { logica, efectos, terminos };
}

const nombres = (acciones: AccionResuelta[]): string[] => acciones.map((a) => a.nombre);

describe('el viaje a la casa de la tía: los datos son válidos', () => {
  it('el validador lo deja pasar', () => {
    const r = validarNivel(nivel);
    expect(r.errores).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe('el viaje a la casa de la tía: se juega de punta a punta', () => {
  it('sube las tres maletas subiendo el contador y ocultando cada pieza', () => {
    const { logica, efectos } = montar();
    for (const id of ['maleta-1', 'maleta-2', 'maleta-3']) {
      logica.paso([{ tipo: 'entidad_soltada', entidad: id, destino: 'auto' }]);
      expect(efectos).toContainEqual({ nombre: 'ocultar', args: { objetivo: id } });
    }
    expect(logica.mundo.contador('maletas_en_auto')).toBe(3);
    expect(logica.misiones.estadoDe('maletas')).toBe('hecha');
  });

  it('al estar las tres, el viaje arranca solo y pide la manivela (encadenado)', () => {
    const { logica, efectos } = montar();
    for (const id of ['maleta-1', 'maleta-2', 'maleta-3']) {
      logica.paso([{ tipo: 'entidad_soltada', entidad: id, destino: 'auto' }]);
    }
    expect(logica.mundo.activo('viaje-activo')).toBe(true);
    expect(efectos).toContainEqual({ nombre: 'decir', args: { entidad: 'abuelo', frase: '¡vamos!' } });
    expect(efectos).toContainEqual({ nombre: 'mostrar', args: { objetivo: 'manivela' } });
    // La manivela quedó pedida: 3 vueltas.
    expect(logica.eventos.gestoPedido('circulo', 'manivela')?.veces).toBe(3);
  });

  it('las vueltas de la manivela cuentan y a la tercera se arranca', () => {
    const { logica, efectos } = montar();
    for (const id of ['maleta-1', 'maleta-2', 'maleta-3']) {
      logica.paso([{ tipo: 'entidad_soltada', entidad: id, destino: 'auto' }]);
    }
    // Dos vueltas: todavía no pasa nada.
    logica.paso([{ tipo: 'gesto_completado', gesto: 'circulo' }]);
    logica.paso([{ tipo: 'gesto_completado', gesto: 'circulo' }]);
    expect(efectos).not.toContainEqual({ nombre: 'sonar', args: { sonido: 'partida' } });
    // La tercera: arrancamos.
    logica.paso([{ tipo: 'gesto_completado', gesto: 'circulo' }]);
    expect(efectos).toContainEqual({ nombre: 'sonar', args: { sonido: 'partida' } });
    expect(efectos).toContainEqual({ nombre: 'decir', args: { entidad: 'abuelo', frase: '¡arrancamos!' } });
  });

  it('NO se puede llegar y terminar: sin maletas, llegar no completa nada', () => {
    const { logica } = montar();
    logica.paso([{ tipo: 'zona_entrada', zona: 'casa-de-la-tia', entidad: 'auto' }]);
    expect(logica.mundo.activo('en-la-casa')).toBe(true); // la regla sí reacciona
    // `maletas` no tiene prerrequisitos: está disponible, pero sin cumplir (`en_curso`).
    // Las que dependen de ella siguen trabadas: ese es el punto del orden.
    expect(logica.misiones.estadoDe('maletas')).toBe('en_curso');
    expect(logica.misiones.estadoDe('manejar')).toBe('pendiente');
    expect(logica.misiones.estadoDe('llegar')).toBe('pendiente');
    expect(logica.terminadoNivel()).toBe(false);
  });

  it('el final completo: maletas → manivela → llegar → VIDEO de premio y nivel terminado', () => {
    const { logica, efectos, terminos } = montar();
    for (const id of ['maleta-1', 'maleta-2', 'maleta-3']) {
      logica.paso([{ tipo: 'entidad_soltada', entidad: id, destino: 'auto' }]);
    }
    for (let i = 0; i < 3; i++) logica.paso([{ tipo: 'gesto_completado', gesto: 'circulo' }]);
    // Antes de llegar, nada de premio.
    expect(efectos).not.toContainEqual({ nombre: 'reproducir_video', args: { video: 'casa-de-la-tia' } });
    // Llega a la casa.
    const final = logica.paso([{ tipo: 'zona_entrada', zona: 'casa-de-la-tia', entidad: 'auto' }]);

    expect(final.cumplidas).toEqual(['manejar', 'llegar']);
    expect(logica.mundo.activo('en-la-casa')).toBe(true);
    // El premio se toma de la variable del mundo ($premio-del-dia).
    expect(efectos).toContainEqual({ nombre: 'reproducir_video', args: { video: 'casa-de-la-tia' } });
    expect(efectos).toContainEqual({ nombre: 'celebrar', args: {} });
    expect(final.nivelTerminado).toBe(true);
    expect(terminos).toContain('misiones');
    expect(nombres(logica.paso([]).acciones)).toEqual([]); // ya terminado: no hace nada más
  });

  it('cambiando la recompensa cambia el video, sin tocar la lógica', () => {
    const otro: Nivel = JSON.parse(JSON.stringify(nivel)) as Nivel;
    otro.mundo = { ...otro.mundo, variables: { 'premio-del-dia': 'video-de-la-prima' } };
    const efectos: AccionResuelta[] = [];
    const logica = new Logica(otro, { aplicar: (a) => efectos.push(a) });
    for (const id of ['m1', 'm2', 'm3']) logica.paso([{ tipo: 'entidad_soltada', entidad: id, destino: 'auto' }]);
    for (let i = 0; i < 3; i++) logica.paso([{ tipo: 'gesto_completado', gesto: 'circulo' }]);
    logica.paso([{ tipo: 'zona_entrada', zona: 'casa-de-la-tia', entidad: 'auto' }]);
    expect(efectos).toContainEqual({ nombre: 'reproducir_video', args: { video: 'video-de-la-prima' } });
  });
});
