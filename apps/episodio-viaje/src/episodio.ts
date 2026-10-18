/**
 * El episodio armado: el escenario (datos) + el PUENTE motor↔lógica.
 *
 * Es la pieza que junta todo lo que NO necesita pantalla:
 *
 *   - el escenario en datos (`escenario.ts`), con las maletas, el auto, la casa
 *     como zona y la manivela;
 *   - el `Puente`, que traduce lo que pasa en la escena a eventos de la lógica y
 *     lo que la lógica pide de vuelta a la escena, los puertos y los avisos;
 *   - el ARRASTRE con la regla de oro cableada: sólo las maletas se arrastran,
 *     sólo el auto recibe, y soltar donde no va NO pasa nada (vuelve en silencio,
 *     sin mensaje, sin sonido de error, sin perder nada).
 *
 * Todo esto se prueba sin navegador: la escena es del motor (pura) y los puertos
 * de audio y video se reemplazan por dobles.
 */
import type { Entidad, Escena } from '@juegosemi/motor';
import { Arrastre } from '@juegosemi/motor';
import type { AvisosDelJuego, Nivel, ResultadoPaso } from '@juegosemi/logica';
import { Puente } from '@juegosemi/logica';
import type { PuertoAudio, PuertoVideo } from '@juegosemi/puertos';
import { armarEscenario, type Escenario, type Zona } from './escenario.ts';

export interface OpcionesEpisodio {
  nivel: Nivel;
  ancho: number;
  alto: number;
  /** Sin puerto de audio, `sonar` sale por `avisos.alEfecto` (así se pone el juice). */
  audio?: PuertoAudio;
  /** El puerto de video ya traduce id lógico → ruta (ver `premio.ts`). */
  video?: PuertoVideo;
  avisos?: AvisosDelJuego;
  /** Se soltó una maleta sobre el auto: acá va el refuerzo (frase, sonido, pop). */
  alSubirMaleta?: (entidad: Entidad) => void;
  /** Se soltó una maleta donde no iba: la app la devuelve a su lugar EN SILENCIO. */
  alVolverMaleta?: (entidad: Entidad) => void;
}

export interface Episodio {
  escenario: Escenario;
  escena: Escena;
  puente: Puente;
  /** El arrastre ya enganchado a la lógica (se le da al `Juego`). */
  arrastre: Arrastre;
  /** La zona de la casa: cuando el auto entra, se dispara la llegada. */
  zonaCasa: Zona;
  /** Avanza la lógica un paso (lo llama el ticker, con el tiempo simulado). */
  paso(tiempoSimulado?: number): ResultadoPaso;
  /** Maletas que ya subieron al auto (lo que cuenta la lógica). */
  maletasEnElAuto(): number;
  /** Maletas marcadas como cargadas (lo que ve la app, para no volver a tomarlas). */
  maletasCargadas(): number;
  /** Avísale al puente que el auto llegó a la zona de la casa. */
  llegarALaCasa(): void;
}

/** ¿Esta entidad es una de las maletas? */
export function esMaleta(escenario: Escenario, entidad: Entidad): boolean {
  return escenario.piezas.maletas.indexOf(entidad.id) !== -1;
}

export function crearEpisodio(opciones: OpcionesEpisodio): Episodio {
  const escenario = armarEscenario(opciones.ancho, opciones.alto);

  const puente = new Puente(opciones.nivel, {
    escena: escenario.escena,
    audio: opciones.audio,
    video: opciones.video,
    avisos: opciones.avisos,
  });

  const { auto } = escenario.piezas;

  const arrastre = puente.arrastre({
    escalaAlAgarrar: 1.2,
    // Sólo las maletas (y sólo si todavía no subieron) se pueden tomar.
    sePuedeArrastrar: (entidad) =>
      esMaleta(escenario, entidad) && entidad.datos['cargada'] !== true,
    // Y el único destino válido es el auto: soltar sobre la casa o el abuelo no cuenta.
    sePuedeSoltar: (entidad) => entidad.id === auto,
    alSoltar: (entidad, destino) => {
      if (destino !== null && destino.id === auto) {
        entidad.datos['cargada'] = true;
        opciones.alSubirMaleta?.(entidad);
        return;
      }
      // REGLA DE ORO: no hay castigo. Nada de mensaje, nada de sonido de error,
      // nada que se pierda: la pieza vuelve sola a su lugar.
      opciones.alVolverMaleta?.(entidad);
    },
  });

  return {
    escenario,
    escena: escenario.escena,
    puente,
    arrastre,
    zonaCasa: escenario.zonaCasa,
    paso(tiempoSimulado?: number): ResultadoPaso {
      return puente.paso(tiempoSimulado);
    },
    maletasEnElAuto(): number {
      return puente.logica.mundo.contador('maletas_en_auto');
    },
    maletasCargadas(): number {
      let cargadas = 0;
      for (const id of escenario.piezas.maletas) {
        const maleta = escenario.escena.obtener(id);
        if (maleta !== null && maleta.datos['cargada'] === true) cargadas += 1;
      }
      return cargadas;
    },
    llegarALaCasa(): void {
      puente.entrarZona(escenario.zonaCasa.nombre, auto);
    },
  };
}
