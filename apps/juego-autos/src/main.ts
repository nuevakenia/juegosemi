import { validarFamilia, type Familia } from '@juegosemi/contenido';
import { Escena, Arrastre, Juego, Timeline, type Entidad } from '@juegosemi/motor';
import { crearRenderPixi, type RenderPixi } from '@juegosemi/render-pixi';
import {
  crearAudioWeb,
  crearEntradaTactil,
  crearPantalla,
  crearPlataforma,
  crearReloj,
} from '@juegosemi/adaptadores-web';
import { crearPartida, intentar, autoCorrecto, type Partida } from './reglas.ts';
import { casillaDeOrigen, disenarTablero, type Tablero } from './layout.ts';

/**
 * El primer juego: llevar a cada persona hasta su auto.
 *
 * Cómo está armado (y por qué): el juego es la parte que SÍ conoce la pantalla.
 * Toda la lógica (quién va con quién, sin castigo al errar) vive en `reglas.ts`
 * y el reparto en pantalla en `layout.ts`; los dos se prueban sin navegador. Acá
 * sólo queda pegarlos al motor, el render y los adaptadores.
 */

const COLORES = [0xffb703, 0x8ecae6, 0xfb8500, 0xa3b18a, 0xcdb4db, 0xffc8dd, 0x90e0ef, 0xf6bd60];

function colorDe(texto: string): number {
  let suma = 0;
  for (let i = 0; i < texto.length; i++) suma = (suma * 31 + texto.charCodeAt(i)) % 100000;
  return COLORES[suma % COLORES.length]!;
}

interface Efecto {
  entidad: Entidad;
  tipo: 'pop' | 'volver' | 'desvanecer';
  t: number;
  duracion: number;
  desde: { x: number; y: number };
  hacia: { x: number; y: number };
}

async function principal(): Promise<void> {
  function exigir<T extends HTMLElement>(id: string): T {
    const elemento = document.getElementById(id);
    if (!elemento) throw new Error(`falta el elemento #${id} en el HTML`);
    return elemento as T;
  }
  const contenedor = exigir<HTMLDivElement>('juego');
  const aviso = exigir<HTMLDivElement>('aviso');
  const cartel = exigir<HTMLDivElement>('cartel');
  const cartelTexto = exigir<HTMLParagraphElement>('cartel-texto');

  // ── contenido ──────────────────────────────────────────────────────────────
  const respuesta = await fetch('./contenido/familia.json');
  const validada = validarFamilia(await respuesta.json());
  if (!validada.ok || !validada.valor) {
    aviso.textContent = `El contenido tiene errores: ${validada.errores.join(' · ')}`;
    return;
  }
  const familia: Familia = validada.valor;
  const partida: Partida = crearPartida(familia);

  // ── plataforma y adaptadores ───────────────────────────────────────────────
  const plataforma = crearPlataforma();
  const pantalla = crearPantalla(contenedor.clientWidth, contenedor.clientHeight);
  const audio = crearAudioWeb();
  const info = plataforma.info();

  const ancho = contenedor.clientWidth || 800;
  const alto = contenedor.clientHeight || 600;
  const tablero: Tablero = disenarTablero(familia, ancho, alto);

  const render: RenderPixi = await crearRenderPixi(contenedor, {
    ancho,
    alto,
    fondo: 0x0d1117,
  });

  // Si hay caras recortadas, se registran como textura (si no, se dibuja un
  // rectángulo con el nombre: el juego se puede jugar sin un solo asset).
  let hayCaras = false;
  for (const persona of familia.personas) {
    if (!persona.cara) continue;
    try {
      await render.registrarTextura(`cara:${persona.id}`, `./assets/${persona.cara}`);
      hayCaras = true;
    } catch {
      // si la imagen no está, se sigue con el rectángulo
    }
  }

  // ── escena ─────────────────────────────────────────────────────────────────
  const escena = new Escena();
  for (const casilla of tablero.casillas) {
    if (casilla.clase === 'persona') {
      const id = casilla.id.slice('persona:'.length);
      const persona = familia.personas.find((p) => p.id === id);
      escena.agregar({
        id: casilla.id,
        x: casilla.x,
        y: casilla.y,
        ancho: casilla.ancho,
        alto: casilla.alto,
        color: hayCaras ? null : colorDe(id),
        textura: hayCaras ? `cara:${id}` : null,
        // el nombre queda visible: Emiliano identifica palabras aunque no lea todo
        etiqueta: persona?.nombre ?? null,
        orden: 10,
        datos: { clase: 'persona', idPersona: id },
      });
    } else {
      const id = casilla.id.slice('auto:'.length);
      const auto = familia.autos.find((a) => a.id === id);
      escena.agregar({
        id: casilla.id,
        x: casilla.x,
        y: casilla.y,
        ancho: casilla.ancho,
        alto: casilla.alto,
        color: 0x3d5a80,
        etiqueta: auto?.nombre ?? null,
        orden: 1,
        datos: { clase: 'auto', idAuto: id },
      });
    }
  }

  const efectos: Efecto[] = [];

  // ── timeline: intro y latido de las piezas que esperan ─────────────────────
  const timeline = new Timeline(
    [
      { desde: 0, hasta: 0.6, esperar: 0.1, hacer: 'entrada' },
      { siempre_que: 'mirando', esperar: 1.6, hacer: 'latido' },
      { cuando: 'respiro', hacer: 'nada' },
    ],
    (accion) => {
      if (accion === 'entrada') {
        for (const e of escena.todas()) e.alfa = Math.min(1, e.alfa + 0.25);
      } else if (accion === 'latido') {
        for (const e of escena.todas()) {
          if (e.datos['clase'] === 'persona' && e.datos['resuelta'] !== true) efectos.push({ entidad: e, tipo: 'pop', t: 0, duracion: 0.45, desde: { x: e.x, y: e.y }, hacia: { x: e.x, y: e.y } });
        }
      }
    },
  );
  timeline.marcar('mirando');

  // ── entrada y arrastre ─────────────────────────────────────────────────────
  const entrada = crearEntradaTactil({ elemento: contenedor, tamanoLogico: () => ({ ancho, alto }) });

  function volverAlOrigen(personaId: string, entidad: Entidad): void {
    const origen = casillaDeOrigen(tablero, personaId);
    if (!origen) return;
    entidad.datos['volviendo'] = true;
    efectos.push({
      entidad,
      tipo: 'volver',
      t: 0,
      duracion: 0.28,
      desde: { x: entidad.x, y: entidad.y },
      hacia: { x: origen.x, y: origen.y },
    });
  }

  function festejar(personaId: string, entidad: Entidad, frase: string): void {
    entidad.datos['resuelta'] = true;
    aviso.textContent = frase;
    aviso.classList.add('festejo');
    audio.tono(880, 0.16, 0.4);
    window.setTimeout(() => audio.tono(1320, 0.22, 0.35), 150);
    efectos.push({ entidad, tipo: 'pop', t: 0, duracion: 0.4, desde: { x: entidad.x, y: entidad.y }, hacia: { x: entidad.x, y: entidad.y } });
    window.setTimeout(() => aviso.classList.remove('festejo'), 2200);
    entidad.datos['personaId'] = personaId;
  }

  const arrastre = new Arrastre(escena, {
    // sólo se arrastran las personas que todavía no tienen su auto
    sePuedeArrastrar: (e) => e.datos['clase'] === 'persona' && e.datos['resuelta'] !== true,
    // y sólo los autos son destino válido: una persona desvaneciéndose encima de
    // un auto no puede "robar" el destino de la siguiente
    sePuedeSoltar: (e) => e.datos['clase'] === 'auto' && e.datos['tomado'] !== true,
    alSoltar: (entidad, destino) => {
      const personaId = String(entidad.datos['idPersona']);
      const autoId = destino && destino.datos['clase'] === 'auto' ? String(destino.datos['idAuto']) : null;
      const resultado = intentar(partida, personaId, autoId);
      if (resultado.correcto && resultado.frase) {
        const casillaAuto = destino;
        if (casillaAuto) {
          casillaAuto.datos['tomado'] = true;
          entidad.datos['resuelta'] = true;
          efectos.push({
            entidad,
            tipo: 'desvanecer',
            t: 0,
            duracion: 0.35,
            desde: { x: entidad.x, y: entidad.y },
            hacia: { x: casillaAuto.x, y: casillaAuto.y },
          });
        }
        festejar(personaId, entidad, resultado.frase);
        if (resultado.completada) mostrarCartel();
      } else {
        volverAlOrigen(personaId, entidad);
      }
    },
  });

  // ── el juego en sí ─────────────────────────────────────────────────────────
  const juego = new Juego({
    escena,
    render,
    entrada,
    pantalla,
    reloj: crearReloj(),
    arrastre,
    timeline,
    alPaso: (paso) => actualizarEfectos(paso),
  });

  function actualizarEfectos(paso: number): void {
    for (let i = efectos.length - 1; i >= 0; i--) {
      const efecto = efectos[i]!;
      efecto.t += paso;
      const avance = Math.min(1, efecto.t / efecto.duracion);
      if (efecto.tipo === 'volver' || efecto.tipo === 'desvanecer') {
        efecto.entidad.x = efecto.desde.x + (efecto.hacia.x - efecto.desde.x) * avance;
        efecto.entidad.y = efecto.desde.y + (efecto.hacia.y - efecto.desde.y) * avance;
        if (efecto.tipo === 'desvanecer') efecto.entidad.alfa = 1 - avance;
      } else {
        // pop: un pequeño rebote
        const escala = 1 + Math.sin(avance * Math.PI) * 0.18;
        efecto.entidad.escalaX = escala;
        efecto.entidad.escalaY = escala;
      }
      if (avance >= 1) {
        if (efecto.tipo === 'pop') {
          efecto.entidad.escalaX = 1;
          efecto.entidad.escalaY = 1;
        }
        if (efecto.tipo === 'desvanecer') {
          efecto.entidad.visible = false;
          // ya subió a su auto: se retira del tablero para no estorbar (y para que
          // ningún arrastre siguiente la tome como destino)
          escena.quitar(efecto.entidad.id);
        }
        efectos.splice(i, 1);
      }
    }
  }

  function mostrarCartel(): void {
    const total = partida.intentos;
    cartelTexto.textContent = `Los llevaste a todos a su auto. Tuviste ${partida.aciertos} aciertos en ${total} intentos.`;
    cartel.classList.add('visible');
    audio.tono(660, 0.2, 0.4);
    window.setTimeout(() => audio.tono(880, 0.2, 0.4), 180);
    window.setTimeout(() => audio.tono(1100, 0.3, 0.4), 360);
  }

  document.getElementById('otra-vez')?.addEventListener('click', () => {
    cartel.classList.remove('visible');
    location.reload();
  });

  // el audio del navegador necesita un gesto: el primer toque lo desbloquea
  contenedor.addEventListener('pointerdown', () => {
    void audio.desbloquear();
  }, { once: true });

  // deja constancia en consola de lo que la plataforma declara (útil en la tablet)
  console.info('juegosemi: plataforma', {
    nombre: info.nombre,
    chromium: info.soporte.chromium,
    huawei: info.soporte.huawei,
    webgl1: info.soporte.webgl1,
    webgl2: info.soporte.webgl2,
    nucleos: info.nucleos,
    densidad: info.densidad,
  });
  console.info('juegosemi: autos correctos por persona', familia.personas.map((p) => `${p.nombre}→${autoCorrecto(partida, p.id)?.nombre ?? '?'}`));

  juego.iniciar();
  // primer cuadro inmediato (para que no se vea vacío hasta el primer frame)
  juego.dibujar();

  // Hook de diagnóstico: deja la escena, el tablero y la partida a mano para
  // inspeccionarlos desde la consola del navegador (QA) o desde una prueba.
  (window as unknown as Record<string, unknown>)['juegosemi'] = {
    escena,
    tablero,
    partida,
    familia,
    juego,
    ayuda: {
      /** Arrastra (simulando el dedo) a una persona hasta arriba de un auto. */
      arrastrar(personaId: string, autoId: string): void {
        const origen = tablero.casillas.find((c) => c.id === `persona:${personaId}`);
        const destino = tablero.casillas.find((c) => c.id === `auto:${autoId}`);
        if (!origen || !destino) throw new Error('no encuentro esas casillas');
        const caja = contenedor.getBoundingClientRect();
        const evento = (tipo: string, x: number, y: number) =>
          new PointerEvent(tipo, { clientX: caja.left + x, clientY: caja.top + y, pointerId: 7, bubbles: true });
        contenedor.dispatchEvent(evento('pointerdown', origen.x, origen.y));
        contenedor.dispatchEvent(evento('pointermove', (origen.x + destino.x) / 2, (origen.y + destino.y) / 2));
        contenedor.dispatchEvent(evento('pointermove', destino.x, destino.y));
        contenedor.dispatchEvent(evento('pointerup', destino.x, destino.y));
      },
    },
  };
}

void principal();
