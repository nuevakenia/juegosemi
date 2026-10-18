/**
 * La frase legible de cada regla: la lista que ve el grande.
 *
 * Una regla guardada como datos no se entiende de un vistazo. Acá se traduce a
 * castellano, una frase por regla, con el orden del ejemplo canónico:
 *
 *   "Cuando Emiliano suelta la maleta sobre el auto: desaparece la maleta y suma 1 a maletas"
 *
 * Es puro (sólo mira el nivel en construcción) y por eso se prueba sin navegador.
 * Todo lo que falte se muestra con puntos suspensivos en vez de romperse: una regla
 * a medio armar se lee igual, y el grande ve qué le queda por elegir.
 */
import { recompensaPorId } from '@juegosemi/recompensas';
import type { NivelEnConstruccion, ReglaEditor } from './estado.ts';
import { nombreDe, numeroDe, textoDe } from './estado.ts';
import { ENTIDAD_ACTUAL, SUJETO, nombreDeGesto, plantillaCuando, plantillaEntonces } from './plantillas.ts';

/** Lo que se muestra cuando todavía no se eligió algo. */
export const FALTA = '…';

/** El nombre legible de una cosa de la regla (o el comodín de "lo que se suelta"). */
export function nombreDeCosa(nivel: NivelEnConstruccion, id: string): string {
  if (id === '') return FALTA;
  if (id === ENTIDAD_ACTUAL) return 'lo que se suelta';
  return nombreDe(nivel, id);
}

/** Junta textos con comas y un "y" al final: "a, b y c". */
export function unirEnumeracion(partes: readonly string[]): string {
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0] ?? '';
  const primera = partes[0] ?? '';
  const ultima = partes[partes.length - 1] ?? '';
  const medio = partes.slice(1, -1);
  if (medio.length === 0) return `${primera} y ${ultima}`;
  return `${primera}, ${medio.join(', ')} y ${ultima}`;
}

/** El paso CUANDO, en castellano. */
export function fraseDeCuando(nivel: NivelEnConstruccion, regla: ReglaEditor): string {
  const plantilla = plantillaCuando(regla.cuandoId);
  if (plantilla === null) return `Cuando ${FALTA}`;
  const v = (clave: string): string => textoDe(regla.cuandoValores, clave);
  const n = (clave: string): number | null => numeroDe(regla.cuandoValores, clave);
  const veces = n('veces');

  if (plantilla.id === 'toca') {
    const base = `Cuando ${SUJETO} toca ${nombreDeCosa(nivel, v('toco'))}`;
    return veces !== null && veces > 1 ? `${base} ${veces} veces` : base;
  }
  if (plantilla.id === 'suelta_sobre') {
    const entidad = v('entidad');
    const que = entidad === '' ? 'algo' : nombreDeCosa(nivel, entidad);
    return `Cuando ${SUJETO} suelta ${que} sobre ${nombreDeCosa(nivel, v('destino'))}`;
  }
  if (plantilla.id === 'gesto') {
    const gesto = v('gesto');
    const base = `Cuando ${SUJETO} ${gesto === '' ? FALTA : nombreDeGesto(gesto)}`;
    const objetivo = v('objetivo');
    const conObjetivo = objetivo === '' ? base : `${base} sobre ${nombreDeCosa(nivel, objetivo)}`;
    return veces !== null && veces > 1 ? `${conObjetivo} ${veces} veces` : conObjetivo;
  }
  if (plantilla.id === 'contador') {
    const contador = v('contador');
    const alMenos = n('al_menos');
    return `Cuando ${contador === '' ? 'el contador ' + FALTA : 'el contador ' + nombreDeCosa(nivel, contador)} llega a ${
      alMenos === null ? FALTA : alMenos
    }`;
  }
  if (plantilla.id === 'zona') {
    return `Cuando ${SUJETO} llega a ${nombreDeCosa(nivel, v('zona'))}`;
  }
  if (plantilla.id === 'mision') {
    return `Cuando se cumple la misión ${nombreDeCosa(nivel, v('mision'))}`;
  }
  return `Cuando ${FALTA}`;
}

/** El nombre de un video del catálogo de premios (o el id si ya no está). */
function tituloDeVideo(id: string): string {
  const recompensa = recompensaPorId(id);
  return recompensa === null ? id : recompensa.titulo;
}

/** Un paso ENTONCES, en castellano. */
export function fraseDeAccion(nivel: NivelEnConstruccion, entoncesId: string, valores: Record<string, string | number>): string {
  const plantilla = plantillaEntonces(entoncesId);
  if (plantilla === null) return FALTA;
  const v = (clave: string): string => textoDe(valores, clave);

  switch (plantilla.accion) {
    case 'mostrar':
      return `aparece ${nombreDeCosa(nivel, v('objetivo'))}`;
    case 'ocultar':
      return `desaparece ${nombreDeCosa(nivel, v('objetivo'))}`;
    case 'decir': {
      const quien = v('entidad');
      const frase = v('frase');
      return `${quien === '' ? FALTA : nombreDeCosa(nivel, quien)} dice «${frase === '' ? FALTA : frase}»`;
    }
    case 'sonar':
      return `suena ${v('sonido') === '' ? FALTA : v('sonido')}`;
    case 'reproducir_video': {
      const video = v('video');
      return `se ve el video «${video === '' ? FALTA : tituloDeVideo(video)}»`;
    }
    case 'sumar': {
      const contador = v('contador');
      const cuanto = numeroDe(valores, 'cuanto');
      return `suma ${cuanto === null ? '?' : cuanto} a ${contador === '' ? FALTA : nombreDeCosa(nivel, contador)}`;
    }
    case 'activar':
      return `abre ${nombreDeCosa(nivel, v('objeto'))}`;
    case 'terminar_nivel':
      return 'termina el nivel';
    default:
      return plantilla.accion;
  }
}

/** Toda la regla en una frase: "Cuando ... : ... y ...". */
export function fraseDeRegla(nivel: NivelEnConstruccion, regla: ReglaEditor): string {
  const cuando = fraseDeCuando(nivel, regla);
  const acciones = regla.acciones.map((accion) => fraseDeAccion(nivel, accion.entoncesId, accion.valores));
  if (acciones.length === 0) return `${cuando}: (todavía no dice qué hace)`;
  return `${cuando}: ${unirEnumeracion(acciones)}`;
}
