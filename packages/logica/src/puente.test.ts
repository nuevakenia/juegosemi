/**
 * El puente, probado con el motor de verdad: escena, arrastre, ticker y timeline.
 *
 * Sigue sin haber navegador: los puertos de audio y video son de mentira y el
 * tiempo lo pone el ticker. Lo que se comprueba es lo que importa: que tocar y
 * arrastrar de verdad mueva la lógica, que la lógica mueva de verdad la escena,
 * y que lo que no es de la lógica salga por el puerto o por el aviso correcto.
 */
import { describe, expect, it } from 'vitest';
import { Escena, Ticker } from '@juegosemi/motor';
import type { EventoEntrada, PuertoAudio, PuertoVideo } from '@juegosemi/puertos';
import { Puente } from './puente.ts';
import type { AccionResuelta, Nivel } from './tipo.ts';

const nivel: Nivel = {
  id: 'puente',
  titulo: 'La prueba del puente',
  mundo: {
    variables: { premio: 'video-del-dia' },
    contadores: { maletas: 0 },
    objetos: { listo: false, 'en-marcha': false },
  },
  reglas: [
    {
      id: 'subir',
      si: { evento: 'entidad_soltada', destino: 'auto' },
      hacer: ['ocultar($entidad)', 'sumar(maletas, 1)', 'sonar(bien)'],
    },
    { id: 'avisar', si: { contador: 'maletas', al_menos: 2 }, hacer: ['activar(listo)'] },
    { id: 'saludo', si: { evento: 'objeto_activado', objeto: 'listo' }, hacer: ['decir(abuelo, "¡vamos!")'] },
    { id: 'pedir-manivela', si: { activo: 'listo' }, hacer: ['mostrar(manivela)', 'pedir_gesto(circulo, 3, manivela)'] },
    {
      id: 'manivela-lista',
      si: { evento: 'gesto_completado', gesto: 'circulo', destino: 'manivela', veces: 3 },
      hacer: ['mostrar_mensaje("¡arrancamos!")', 'activar(en-marcha)'],
    },
    { id: 'machaque', si: { toco: 'bomba', veces: 3 }, hacer: ['celebrar'] },
    { id: 'llegada', si: { evento: 'zona_entrada', zona: 'casa' }, hacer: ['reproducir_video($premio)'] },
    { id: 'rutina-hecha', si: { paso: 'rutina', al_menos: 1 }, hacer: ['sonar(arranque)'] },
  ],
  misiones: [
    { id: 'subir-todo', texto: 'Subir las maletas', cumple: { contador: 'maletas', al_menos: 2 } },
    { id: 'arrancar', texto: 'Hacer arrancar el auto', cumple: { activo: 'en-marcha' }, requiere: ['subir-todo'] },
  ],
  nivel_terminado: { y: [{ mision: 'arrancar', hecha: true }] },
};

function escenaDePrueba(): Escena {
  const escena = new Escena();
  escena.agregar({ id: 'maleta-1', x: 100, y: 100, ancho: 80, alto: 80 });
  escena.agregar({ id: 'maleta-2', x: 100, y: 300, ancho: 80, alto: 80 });
  escena.agregar({ id: 'auto', x: 500, y: 300, ancho: 200, alto: 200 });
  escena.agregar({ id: 'bomba', x: 800, y: 500, ancho: 100, alto: 100 });
  escena.agregar({ id: 'estrella', x: 900, y: 100, ancho: 60, alto: 60, visible: false });
  return escena;
}

function audioDeMentira(): { puerto: PuertoAudio; sonados: string[] } {
  const sonados: string[] = [];
  return {
    sonados,
    puerto: {
      cargar: async () => {},
      reproducir: async (id) => {
        sonados.push(id);
      },
      detener: () => {},
      detenerTodo: () => {},
      estaDesbloqueado: () => true,
      desbloquear: async () => {},
    },
  };
}

function videoDeMentira(): { puerto: PuertoVideo; reproducidos: string[] } {
  const reproducidos: string[] = [];
  return {
    reproducidos,
    puerto: {
      soporta: async () => true,
      reproducir: async (url) => {
        reproducidos.push(url);
        return { ok: true };
      },
      detener: () => {},
    },
  };
}

const dedo = (tipo: EventoEntrada['tipo'], x: number, y: number): EventoEntrada => ({ tipo, x, y, puntero: 0 });

/** Suelta la pieza que está en `desde` sobre el auto, como lo haría el dedo de Emiliano. */
function soltarSobreElAuto(puente: Puente, desde: { x: number; y: number }): void {
  const arrastre = puente.arrastre();
  arrastre.procesar(dedo('pulsar', desde.x, desde.y));
  arrastre.procesar(dedo('mover', 500, 300));
  arrastre.procesar(dedo('soltar', 500, 300));
}

describe('Puente: el arrastre de verdad mueve la lógica y la lógica mueve la escena', () => {
  it('soltar una maleta sobre el auto la oculta, suma y suena (sin navegador)', () => {
    const escena = escenaDePrueba();
    const audio = audioDeMentira();
    const puente = new Puente(nivel, { escena, audio: audio.puerto });

    soltarSobreElAuto(puente, { x: 100, y: 100 });
    puente.paso();

    expect(escena.obtener('maleta-1')?.visible).toBe(false);
    expect(puente.logica.mundo.contador('maletas')).toBe(1);
    expect(audio.sonados).toEqual(['bien']);
    expect(puente.logica.terminadoNivel()).toBe(false); // con una sola maleta no alcanza
  });

  it('ENCADENA dentro del mismo paso: la segunda maleta activa el viaje y el saludo sale solo', () => {
    const escena = escenaDePrueba();
    const dichos: Array<{ entidad: string; frase: string }> = [];
    const avisos: AccionResuelta[] = [];
    const puente = new Puente(nivel, {
      escena,
      avisos: {
        alDecir: (entidad, frase) => dichos.push({ entidad, frase }),
        alEfecto: (accion) => avisos.push(accion),
      },
    });

    soltarSobreElAuto(puente, { x: 100, y: 100 });
    puente.paso();
    expect(puente.logica.mundo.activo('listo')).toBe(false);

    soltarSobreElAuto(puente, { x: 100, y: 300 });
    puente.paso();

    // Regla 'avisar' → activar(listo) → evento `objeto_activado` → regla 'saludo'.
    expect(puente.logica.mundo.activo('listo')).toBe(true);
    expect(dichos).toEqual([{ entidad: 'abuelo', frase: '¡vamos!' }]);
    // El nivel NO se termina acá: todavía falta la manivela (el orden manda).
    expect(puente.logica.misiones.estadoDe('subir-todo')).toBe('hecha');
    expect(puente.logica.misiones.estadoDe('arrancar')).toBe('en_curso');
    expect(puente.logica.terminadoNivel()).toBe(false);
    // 'mostrar(manivela)' pidió algo que no está en la escena: se avisa al juego.
    expect(avisos.map((a) => `${a.nombre}:${String(a.args['objetivo'] ?? '')}`)).toContain('mostrar:manivela');
  });
});

describe('Puente: los gestos y los toques', () => {
  it('el gesto pedido se completa a las 3 vueltas y la lógica avisa el mensaje', () => {
    const escena = escenaDePrueba();
    const mensajes: string[] = [];
    const puente = new Puente(nivel, { escena, avisos: { alMensaje: (texto) => mensajes.push(texto) } });

    soltarSobreElAuto(puente, { x: 100, y: 100 });
    puente.paso();
    soltarSobreElAuto(puente, { x: 100, y: 300 });
    puente.paso();

    puente.gestoCompletado('circulo', 'manivela');
    puente.paso();
    puente.gestoCompletado('circulo', 'manivela');
    puente.paso();
    expect(mensajes).toEqual([]);
    puente.gestoCompletado('circulo', 'manivela');
    puente.paso();
    expect(mensajes).toEqual(['¡arrancamos!']);
    // Y con la última misión cumplida, el nivel termina solo.
    expect(puente.logica.misiones.estadoDe('arrancar')).toBe('hecha');
    expect(puente.logica.terminadoNivel()).toBe(true);
  });

  it('los toques repetidos cuentan dentro de la ventana y se vencen solos', () => {
    const escena = escenaDePrueba();
    const puente = new Puente(nivel, { escena });

    puente.tocar('bomba');
    puente.tocar('bomba');
    expect(puente.paso(0.1).acciones.map((a) => a.nombre)).not.toContain('celebrar');
    expect(puente.toquesSeguidos()).toEqual([{ entidad: 'bomba', veces: 2 }]);

    puente.tocar('bomba');
    expect(puente.paso(0.2).acciones.map((a) => a.nombre)).toContain('celebrar');

    // Pasó la ventana: la cuenta vuelve a empezar de cero.
    puente.paso(5);
    puente.tocar('bomba');
    expect(puente.toquesSeguidos()).toEqual([{ entidad: 'bomba', veces: 1 }]);
  });
});

describe('Puente: zonas, puertos y timeline', () => {
  it('llegar a una zona pide el video del día (el comodín sale de las variables del mundo)', () => {
    const escena = escenaDePrueba();
    const video = videoDeMentira();
    const puente = new Puente(nivel, { escena, video: video.puerto });

    puente.entrarZona('casa', 'auto');
    puente.paso();

    expect(video.reproducidos).toEqual(['video-del-dia']);
  });

  it('el timeline del motor avanza con el ticker: publica `paso_completado` y aplica su acción', () => {
    const escena = escenaDePrueba();
    const audio = audioDeMentira();
    const puente = new Puente(nivel, {
      escena,
      audio: audio.puerto,
      timeline: { secuencia: 'rutina', reglas: [{ en: '2s', hacer: ['mostrar(estrella)'] }] },
    });
    const ticker = new Ticker();

    // Igual que el motor: primero el timeline, después el paso de la lógica.
    for (let i = 0; i < 40; i++) {
      ticker.avanzar(0.0834, (paso) => {
        puente.timeline?.actualizar(paso);
        puente.paso(ticker.tiempo());
      });
    }

    expect(escena.obtener('estrella')?.visible).toBe(true);
    expect(puente.logica.pasosCompletados('rutina')).toBe(1);
    // La regla que mira el paso de la secuencia reaccionó sola.
    expect(audio.sonados).toContain('arranque');
  });
});
