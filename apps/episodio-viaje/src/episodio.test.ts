/**
 * El episodio entero, jugado paso a paso: SÓLO con los datos del nivel.
 *
 * Esta es la prueba que importa. Sin navegador (la escena es del motor y los
 * puertos son dobles) se recorre el viaje completo y se comprueba lo que el padre
 * pidió que fuera cierto:
 *
 *   - sin las tres maletas NO se puede llegar ni terminar;
 *   - la manivela pide 3 vueltas, y a la tercera arranca;
 *   - al llegar a la casa sale la RECOMPENSA correcta (el video del día + festejo);
 *   - y la regla de oro: soltar una maleta donde no va no pasa NADA (ni mensaje,
 *     ni sonido de error, ni perder nada).
 */
import { describe, expect, it } from 'vitest';
import type { AccionResuelta, AvisosDelJuego, Nivel } from '@juegosemi/logica';
import type { Entidad } from '@juegosemi/motor';
import type { PuertoVideo } from '@juegosemi/puertos';
import { NIVEL } from './nivel.ts';
import { crearEpisodio, type Episodio, type OpcionesEpisodio } from './episodio.ts';
import { crearPuertoVideo } from './premio.ts';
import { GESTO_MANIVELA, OBJETIVO_MANIVELA, faseDelViaje } from './viaje.ts';

interface Banco {
  episodio: Episodio;
  reproducidos: string[];
  efectos: AccionResuelta[];
  subidas: Entidad[];
  devueltas: Entidad[];
  festejos: number;
  dichos: string[];
}

function videoDeMentira(): { puerto: PuertoVideo; reproducidos: string[] } {
  const reproducidos: string[] = [];
  return {
    reproducidos,
    puerto: {
      soporta: async () => true,
      reproducir: async (url: string) => {
        reproducidos.push(url);
        return { ok: true };
      },
      detener: () => {},
    },
  };
}

/** Arma el episodio con un puerto de video de mentira y anotadores de todo. */
function montar(nivel: Nivel = NIVEL): Banco {
  const falso = videoDeMentira();
  const reproducidos = falso.reproducidos;
  const efectos: AccionResuelta[] = [];
  const subidas: Entidad[] = [];
  const devueltas: Entidad[] = [];
  const dichos: string[] = [];
  const banco: Banco = { episodio: null as unknown as Episodio, reproducidos, efectos, subidas, devueltas, festejos: 0, dichos };

  const avisos: AvisosDelJuego = {
    alEfecto: (accion) => efectos.push(accion),
    alDecir: (_entidad, frase) => dichos.push(frase),
    alCelebrar: () => {
      banco.festejos += 1;
    },
  };
  const opciones: OpcionesEpisodio = {
    nivel,
    ancho: 800,
    alto: 600,
    // Sin puerto de audio: `sonar(...)` sale por `alEfecto` y así se puede auditar.
    video: crearPuertoVideo(falso.puerto),
    avisos,
    alSubirMaleta: (entidad) => subidas.push(entidad),
    alVolverMaleta: (entidad) => devueltas.push(entidad),
  };
  banco.episodio = crearEpisodio(opciones);
  return banco;
}

/** Arrastra una maleta hasta un punto, como haría el dedo de Emiliano. */
function arrastrar(episodio: Episodio, maletaId: string, hacia: { x: number; y: number }): void {
  const maleta = episodio.escena.obtener(maletaId);
  if (maleta === null) throw new Error(`falta ${maletaId}`);
  episodio.arrastre.procesar({ tipo: 'pulsar', x: maleta.x, y: maleta.y, puntero: 0 });
  episodio.arrastre.procesar({ tipo: 'mover', x: (maleta.x + hacia.x) / 2, y: (maleta.y + hacia.y) / 2, puntero: 0 });
  episodio.arrastre.procesar({ tipo: 'soltar', x: hacia.x, y: hacia.y, puntero: 0 });
  episodio.paso();
}

function subirMaleta(episodio: Episodio, maletaId: string): void {
  const auto = episodio.escena.obtener(episodio.escenario.piezas.auto);
  if (auto === null) throw new Error('falta el auto');
  arrastrar(episodio, maletaId, { x: auto.x, y: auto.y });
}

function subirLasTres(episodio: Episodio): void {
  for (const id of episodio.escenario.piezas.maletas) subirMaleta(episodio, id);
}

function girarManivela(episodio: Episodio, veces = 3): void {
  for (let i = 0; i < veces; i++) {
    episodio.puente.gestoCompletado(GESTO_MANIVELA, OBJETIVO_MANIVELA);
    episodio.paso();
  }
}

const sonidos = (efectos: AccionResuelta[]): string[] =>
  efectos.filter((a) => a.nombre === 'sonar').map((a) => String(a.args['sonido'] ?? ''));

describe('el viaje: las maletas', () => {
  it('subir una maleta al auto la oculta, suma y suena (sin navegador)', () => {
    const banco = montar();
    subirMaleta(banco.episodio, 'maleta-1');
    expect(banco.episodio.escena.obtener('maleta-1')?.visible).toBe(false);
    expect(banco.episodio.maletasEnElAuto()).toBe(1);
    expect(banco.episodio.maletasCargadas()).toBe(1);
    expect(sonidos(banco.efectos)).toEqual(['bien']);
    expect(banco.subidas.length).toBe(1);
    expect(banco.devueltas.length).toBe(0);
  });

  it('SIN las tres maletas no se puede llegar ni terminar', () => {
    const banco = montar();
    const episodio = banco.episodio;
    subirMaleta(episodio, 'maleta-1');
    subirMaleta(episodio, 'maleta-2');

    expect(episodio.puente.logica.mundo.activo('viaje-activo')).toBe(false);
    expect(episodio.puente.logica.eventos.gestoPedido(GESTO_MANIVELA, OBJETIVO_MANIVELA)).toBeNull();

    // Forzamos la llegada: la regla reacciona, pero sin las maletas no se completa nada.
    episodio.llegarALaCasa();
    episodio.paso();

    expect(episodio.puente.logica.mundo.activo('en-la-casa')).toBe(true);
    expect(episodio.puente.logica.misiones.estadoDe('maletas')).toBe('en_curso');
    expect(episodio.puente.logica.misiones.estadoDe('manejar')).toBe('pendiente');
    expect(episodio.puente.logica.misiones.estadoDe('llegar')).toBe('pendiente');
    expect(episodio.puente.logica.terminadoNivel()).toBe(false);
    expect(banco.reproducidos).toEqual([]);
    expect(banco.festejos).toBe(0);
  });

  it('una maleta ya subida no se puede volver a arrastrar', () => {
    const banco = montar();
    subirMaleta(banco.episodio, 'maleta-1');
    const maleta = banco.episodio.escena.obtener('maleta-1');
    expect(maleta?.datos['cargada']).toBe(true);
    // Está oculta: si alguien igual aprieta ahí, no se levanta nada.
    if (maleta !== null) {
      banco.episodio.arrastre.procesar({ tipo: 'pulsar', x: maleta.x, y: maleta.y, puntero: 0 });
      expect(banco.episodio.arrastre.enMano()).toBeNull();
    }
    expect(banco.episodio.maletasEnElAuto()).toBe(1);
  });

  it('sólo las maletas se arrastran: el auto, la casa y el abuelo no', () => {
    const episodio = montar().episodio;
    const puntos = ['auto', 'casa', 'abuelo'];
    for (const id of puntos) {
      const pieza = episodio.escena.obtener(id);
      if (pieza === null) continue;
      episodio.arrastre.procesar({ tipo: 'pulsar', x: pieza.x, y: pieza.y, puntero: 0 });
      expect(episodio.arrastre.enMano()).toBeNull();
    }
  });
});

describe('el viaje: la manivela', () => {
  it('con las tres maletas el viaje arranca solo y pide la manivela 3 veces', () => {
    const banco = montar();
    subirLasTres(banco.episodio);
    expect(banco.episodio.puente.logica.mundo.activo('viaje-activo')).toBe(true);
    expect(banco.episodio.escena.obtener('manivela')?.visible).toBe(true);
    const pedido = banco.episodio.puente.logica.eventos.gestoPedido(GESTO_MANIVELA, OBJETIVO_MANIVELA);
    expect(pedido?.veces).toBe(3);
    expect(banco.dichos).toContain('¡vamos!');
  });

  it('las vueltas cuentan y a la TERCERA se arranca (con dos no pasa nada)', () => {
    const banco = montar();
    subirLasTres(banco.episodio);
    banco.efectos.length = 0;

    girarManivela(banco.episodio, 2);
    expect(sonidos(banco.efectos)).not.toContain('partida');

    girarManivela(banco.episodio, 1);
    expect(sonidos(banco.efectos)).toContain('partida');
    expect(banco.dichos).toContain('¡arrancamos!');
    expect(banco.episodio.escena.obtener('manivela')?.visible).toBe(false);
    expect(faseDelViaje(banco.episodio.puente.logica)).toBe('manejando');
  });
});

describe('el viaje: la llegada y el premio', () => {
  it('al llegar a la casa sale el VIDEO del día y el festejo, y el nivel termina', () => {
    const banco = montar();
    const episodio = banco.episodio;
    subirLasTres(episodio);
    girarManivela(episodio, 3);

    // Antes de llegar, nada de premio.
    expect(banco.reproducidos).toEqual([]);
    expect(banco.festejos).toBe(0);

    episodio.llegarALaCasa();
    const final = episodio.paso();

    // La recompensa la paga el NIVEL: el video sale de $premio-del-dia.
    expect(banco.reproducidos).toEqual(['assets/videos/casa-de-la-tia.mp4']);
    expect(banco.festejos).toBe(1);
    expect(final.cumplidas).toEqual(['manejar', 'llegar']);
    expect(final.nivelTerminado).toBe(true);
    expect(episodio.puente.logica.terminadoNivel()).toBe(true);
  });

  it('cambiando el premio del nivel cambia el video, sin tocar la app', () => {
    const otro: Nivel = JSON.parse(JSON.stringify(NIVEL)) as Nivel;
    otro.mundo = { ...otro.mundo, variables: { 'premio-del-dia': 'video-de-la-prima' } };
    const banco = montar(otro);
    subirLasTres(banco.episodio);
    girarManivela(banco.episodio, 3);
    banco.episodio.llegarALaCasa();
    banco.episodio.paso();
    expect(banco.reproducidos).toEqual(['assets/videos/video-de-la-prima.mp4']);
  });
});

describe('regla de oro: equivocarse no tiene ningún castigo', () => {
  it('soltar una maleta donde no va: vuelve en silencio, sin mensaje ni sonido de error', () => {
    const banco = montar();
    const episodio = banco.episodio;
    const casa = episodio.escena.obtener(episodio.escenario.piezas.casa);
    if (casa === null) throw new Error('falta la casa');

    arrastrar(episodio, 'maleta-1', { x: casa.x, y: casa.y });

    // Nada se pierde: la maleta sigue, el contador no cambió, no sonó ni se dijo nada.
    expect(episodio.escena.obtener('maleta-1')?.visible).toBe(true);
    expect(episodio.maletasEnElAuto()).toBe(0);
    expect(episodio.puente.logica.mundo.activo('viaje-activo')).toBe(false);
    expect(banco.efectos).toEqual([]);
    expect(sonidos(banco.efectos)).toEqual([]);
    expect(banco.dichos).toEqual([]);
    expect(banco.reproducidos).toEqual([]);
    expect(banco.festejos).toBe(0);
    expect(faseDelViaje(episodio.puente.logica)).toBe('cargando');

    // Y lo único que pasó fue que la app se enteró para devolverla a su lugar.
    expect(banco.subidas.length).toBe(0);
    expect(banco.devueltas.length).toBe(1);
    expect(banco.devueltas[0]?.id).toBe('maleta-1');
  });

  it('soltar una maleta en el vacío tampoco rompe nada', () => {
    const banco = montar();
    const episodio = banco.episodio;
    arrastrar(episodio, 'maleta-2', { x: 4, y: 4 });
    expect(episodio.escena.obtener('maleta-2')?.visible).toBe(true);
    expect(episodio.maletasEnElAuto()).toBe(0);
    expect(banco.devueltas.length).toBe(1);
    expect(banco.efectos).toEqual([]);
  });

  it('el perdón es total: después de equivocarse, la maleta entra igual', () => {
    const banco = montar();
    const episodio = banco.episodio;
    const casa = episodio.escena.obtener(episodio.escenario.piezas.casa);
    if (casa === null) throw new Error('falta la casa');
    arrastrar(episodio, 'maleta-3', { x: casa.x, y: casa.y });
    subirMaleta(episodio, 'maleta-3');
    expect(episodio.maletasEnElAuto()).toBe(1);
    expect(episodio.escena.obtener('maleta-3')?.visible).toBe(false);
  });
});
