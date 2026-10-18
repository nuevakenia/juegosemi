/**
 * Pasar un nivel por archivo: exportar (lo que baja es EXACTAMENTE lo que carga
 * el juego, más el escenario) e importar (valida con el validador de la lógica y
 * vuelve a armar el nivel para seguir tocándolo).
 *
 * La prueba que manda es el viaje completo: exportar → importar → exportar da el
 * MISMO archivo, y el nivel que vuelve es igual al que se fue.
 */
import { describe, expect, it } from 'vitest';
import { validarNivel } from '@juegosemi/logica';
import type { NivelEnConstruccion } from './estado.ts';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  alternarRequiere,
  conCosa,
  conTitulo,
  crearNivelEnConstruccion,
  elegirCuando,
  elegirCumple,
  ponerRecompensa,
  ponerValorCumple,
  ponerValorCuando,
} from './estado.ts';
import { nivelLogico } from './construir.ts';
import { exportarNivel, nombreDeArchivo, textoExportado } from './exportar.ts';
import { interpretarTexto, NO_ES_UN_JUEGO } from './importar.ts';

/** Un nivel entero, armado como lo armaría un chico tocando botones. */
function nivelDePrueba(): NivelEnConstruccion {
  let nivel = conTitulo(crearNivelEnConstruccion(), 'El viaje a la casa de la tía');
  nivel = conCosa(nivel, 'entidades', 'la maleta');
  nivel = conCosa(nivel, 'entidades', 'el auto');
  nivel = conCosa(nivel, 'zonas', 'la casa de la tía');
  nivel = conCosa(nivel, 'contadores', 'maletas');
  nivel = conCosa(nivel, 'interruptores', 'viaje');

  // Regla: suelta la maleta sobre el auto → desaparece y suma 1 a maletas.
  nivel = agregarReglaEnBlanco(nivel);
  nivel = elegirCuando(nivel, 'regla', 'suelta_sobre', {});
  nivel = ponerValorCuando(nivel, 'regla', 'destino', 'el-auto');
  nivel = ponerValorCuando(nivel, 'regla', 'entidad', 'la-maleta');
  nivel = agregarAccion(nivel, 'regla', 'desaparece', { objetivo: '$entidad' });
  nivel = agregarAccion(nivel, 'regla', 'suma', { contador: 'maletas', cuanto: 1 });

  // Misión 1: subir las maletas (contador llega a 3).
  nivel = conCosa(nivel, 'misiones', 'subir las maletas');
  nivel = elegirCumple(nivel, 'subir-las-maletas', 'contador', { al_menos: 3 });
  nivel = ponerValorCumple(nivel, 'subir-las-maletas', 'contador', 'maletas');

  // Misión 2: llegar (zona), que va DESPUÉS de subir las maletas y paga un video.
  nivel = conCosa(nivel, 'misiones', 'llegar');
  nivel = elegirCumple(nivel, 'llegar', 'zona', {});
  nivel = ponerValorCumple(nivel, 'llegar', 'zona', 'la-casa-de-la-tia');
  nivel = alternarRequiere(nivel, 'llegar', 'subir-las-maletas');
  nivel = ponerRecompensa(nivel, 'llegar', 'casa-de-la-tia');

  return nivel;
}

describe('el escenario del editor', () => {
  it('se exporta en su sección, con piezas, zonas y una nota que la explica', () => {
    const exportado = exportarNivel(nivelDePrueba());
    expect(exportado.escenario.version).toBe(1);
    expect(exportado.escenario.nota).toContain('El juego todavía no lee esta sección');
    expect(exportado.escenario.piezas.map((p) => p.id)).toEqual(['la-maleta', 'el-auto']);
    expect(exportado.escenario.zonas.map((z) => z.id)).toEqual(['la-casa-de-la-tia']);
  });

  it('cada pieza trae su nombre, su posición y su tamaño', () => {
    const escenario = exportarNivel(nivelDePrueba()).escenario;
    const maleta = escenario.piezas[0];
    expect(maleta?.nombre).toBe('la maleta');
    expect(maleta?.x).toBeGreaterThan(0);
    expect(maleta?.y).toBeGreaterThan(0);
    expect(maleta?.ancho).toBeGreaterThan(0);
    expect(maleta?.alto).toBeGreaterThan(0);
    const casa = escenario.zonas[0];
    expect(casa?.nombre).toBe('la casa de la tía');
  });
});

describe('el archivo exportado es lo que carga el juego', () => {
  it('el nivel exportado pasa el MISMO validador que usa el juego', () => {
    expect(validarNivel(exportarNivel(nivelDePrueba())).ok).toBe(true);
  });

  it('lleva el mundo, las reglas y las misiones de la lógica', () => {
    const exportado = exportarNivel(nivelDePrueba());
    expect(exportado.id).toBe('mi-juego');
    expect(exportado.titulo).toBe('El viaje a la casa de la tía');
    expect(exportado.mundo?.contadores).toEqual({ maletas: 0 });
    expect(exportado.reglas.length).toBe(1);
    expect(exportado.misiones?.map((m) => m.id)).toEqual(['subir-las-maletas', 'llegar']);
  });

  it('el nombre del archivo sale del título', () => {
    expect(nombreDeArchivo(nivelDePrueba())).toBe('el-viaje-a-la-casa-de-la-tia.juego.json');
  });
});

describe('el viaje completo (exportar → importar → exportar)', () => {
  it('da el MISMO archivo', () => {
    const nivel = nivelDePrueba();
    const texto = textoExportado(nivel);

    const vuelta = interpretarTexto(texto);
    expect(vuelta.ok).toBe(true);
    if (!vuelta.ok) return;

    expect(textoExportado(vuelta.nivel)).toBe(texto);
  });

  it('el nivel que vuelve es igual al que se fue', () => {
    const nivel = nivelDePrueba();
    const vuelta = interpretarTexto(textoExportado(nivel));
    expect(vuelta.ok).toBe(true);
    if (!vuelta.ok) return;
    expect(vuelta.nivel).toEqual(nivel);
  });

  it('el orden de los prerrequisitos sobrevive al viaje', () => {
    let nivel = nivelDePrueba();
    nivel = conCosa(nivel, 'misiones', 'manejar');
    nivel = elegirCumple(nivel, 'manejar', 'contador', { al_menos: 1 });
    nivel = ponerValorCumple(nivel, 'manejar', 'contador', 'maletas');
    // El orden que importa: llegar pide subir-las-maletas y recién después manejar.
    nivel = alternarRequiere(nivel, 'llegar', 'manejar');

    const vuelta = interpretarTexto(textoExportado(nivel));
    expect(vuelta.ok).toBe(true);
    if (!vuelta.ok) return;
    const llegar = vuelta.nivel.misiones.find((m) => m.id === 'llegar');
    expect(llegar?.requiere).toEqual(['subir-las-maletas', 'manejar']);
  });

  it('un nivel sin misiones también viaja redondo', () => {
    let nivel = crearNivelEnConstruccion();
    nivel = conCosa(nivel, 'entidades', 'la pelota');
    nivel = agregarReglaEnBlanco(nivel);
    nivel = elegirCuando(nivel, 'regla', 'toca', { veces: 1 });
    nivel = ponerValorCuando(nivel, 'regla', 'toco', 'la-pelota');
    nivel = agregarAccion(nivel, 'regla', 'dice', { entidad: 'la-pelota', frase: '¡uy!' });

    const texto = textoExportado(nivel);
    const vuelta = interpretarTexto(texto);
    expect(vuelta.ok).toBe(true);
    if (!vuelta.ok) return;
    expect(textoExportado(vuelta.nivel)).toBe(texto);
    expect(validarNivel(nivelLogico(vuelta.nivel)).ok).toBe(true);
  });
});

describe('importar un archivo que no cierra', () => {
  it('dice en castellano que no es un juego y no rompe nada', () => {
    const resultado = interpretarTexto('esto no es JSON');
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.mensajes[0]).toBe(NO_ES_UN_JUEGO);
  });

  it('un JSON que no es un nivel tampoco pasa', () => {
    const resultado = interpretarTexto('{"hola": "mundo"}');
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.mensajes[0]).toBe(NO_ES_UN_JUEGO);
  });

  it('un nivel con una regla que no hace nada se avisa en castellano', () => {
    const malo = {
      id: 'roto',
      reglas: [{ id: 'vacia', hacer: [] }],
      mundo: {},
    };
    const resultado = interpretarTexto(JSON.stringify(malo));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.mensajes.join(' ')).toContain('todavía no dice qué hace');
  });

  it('un nivel escrito a mano con cosas que el editor no arma se avisa, no se carga a medias', () => {
    const aMano = {
      id: 'a-mano',
      mundo: {},
      reglas: [{ id: 'subir', si: { evento: 'entidad_soltada', destino: 'auto' }, hacer: ['ocultar($entidad)'] }],
    };
    const resultado = interpretarTexto(JSON.stringify(aMano));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.mensajes.join(' ')).toContain('subir');
  });
});
