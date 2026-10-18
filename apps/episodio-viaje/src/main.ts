/**
 * El episodio piloto: el viaje a la casa de la tía. La pantalla de verdad.
 *
 * Qué se juega, y con qué de lo que ya existe:
 *   1. arrastrar las tres maletas hasta el auto  → arrastre del motor + reglas del nivel
 *   2. girar la manivela 3 veces                 → reconocedor de gestos + barra de @juegosemi/ui
 *   3. llegar a la casa                          → ZONA, premio (video del día) y cartel grande
 *
 * Lo que NO hay acá: ni una regla del juego. El recorrido entero vive en los datos
 * del nivel (`viaje-casa-tia.json`) y el `Puente` los conecta. Esta pantalla sólo
 * decide cómo se ve (Pixi), cómo se oye (WebAudio) y **cuándo** el auto maneja,
 * que es lo único que faltaba en los datos.
 *
 * Regla de oro del proyecto, dicha de nuevo porque es la que manda: NUNCA hay
 * feedback negativo. Si una maleta se suelta donde no va, vuelve a su lugar sin un
 * solo mensaje, sin sonido de error y sin que se pierda nada. El único refuerzo
 * fuerte es el acierto: frase + sonido + festejo.
 */
import type { AccionResuelta } from '@juegosemi/logica';
import { validarNivel } from '@juegosemi/logica';
import type { Entidad } from '@juegosemi/motor';
import { Juego } from '@juegosemi/motor';
import type { PedidoGesto, TipoGesto } from '@juegosemi/puertos';
import { crearRenderPixi, type RenderPixi } from '@juegosemi/render-pixi';
import {
  crearAudioWeb,
  crearEntradaTactil,
  crearGestosTactiles,
  crearPantalla,
  crearPlataforma,
  crearReloj,
  crearVideoHtml,
} from '@juegosemi/adaptadores-web';
import { crearBarraProgreso } from '@juegosemi/ui';
import { NIVEL } from './nivel.ts';
import { crearEpisodio, type Episodio } from './episodio.ts';
import { centroEnZona } from './escenario.ts';
import { crearPuertoVideo, premioDelNivel, urlDeVideo } from './premio.ts';
import { faseDelViaje, GESTO_MANIVELA, OBJETIVO_MANIVELA, type FaseViaje } from './viaje.ts';

/** Un efecto de pantalla en curso (por ahora, sólo "la maleta vuelve a su lugar"). */
interface Efecto {
  entidad: Entidad;
  tipo: 'volver' | 'pop';
  t: number;
  duracion: number;
  desde: { x: number; y: number };
  hacia: { x: number; y: number };
}

/** Los tonos del juice, sin un solo archivo de audio. */
const SONIDOS: Record<string, number[]> = {
  bien: [880, 1320],
  partida: [196, 294, 392],
  festejo: [659, 880, 1100],
};

async function principal(): Promise<void> {
  function exigir<T extends HTMLElement>(id: string): T {
    const elemento = document.getElementById(id);
    if (!elemento) throw new Error(`falta el elemento #${id} en el HTML`);
    return elemento as T;
  }

  const contenedor = exigir<HTMLDivElement>('juego');
  const aviso = exigir<HTMLDivElement>('aviso');
  const panel = exigir<HTMLElement>('panel');
  const barraContenedor = exigir<HTMLDivElement>('barra');
  const cartel = exigir<HTMLDivElement>('cartel');
  const cartelTexto = exigir<HTMLParagraphElement>('cartel-texto');

  // ── el nivel, revisado antes de jugar ──────────────────────────────────────
  const revision = validarNivel(NIVEL);
  if (!revision.ok) {
    aviso.textContent = `El nivel tiene errores: ${revision.errores.join(' · ')}`;
    return;
  }

  // ── adaptadores ────────────────────────────────────────────────────────────
  const plataforma = crearPlataforma();
  const audio = crearAudioWeb();
  const pantalla = crearPantalla(contenedor.clientWidth || 800, contenedor.clientHeight || 600);

  // El puerto de video traduce el id lógico del premio a una ruta real y, como
  // pide el proyecto, verifica FRAMES: si el WebView no decodifica, devuelve `ok:false`.
  const video = crearPuertoVideo(crearVideoHtml());

  const ancho = contenedor.clientWidth || 800;
  const alto = contenedor.clientHeight || 600;

  const render: RenderPixi = await crearRenderPixi(contenedor, { ancho, alto, fondo: 0x0d1117 });

  // ── la barra del gesto (paquete ui) ────────────────────────────────────────
  const barra = crearBarraProgreso({ etiqueta: 'Girá la manivela' });
  barraContenedor.appendChild(barra.elemento);

  // ── efectos de pantalla ────────────────────────────────────────────────────
  const efectos: Efecto[] = [];

  function volverALugar(entidad: Entidad): void {
    // La maleta se soltó donde no iba: vuelve a su lugar, en silencio.
    const origen = episodio.escenario.origenes[entidad.id];
    if (origen === undefined) return;
    efectos.push({
      entidad,
      tipo: 'volver',
      t: 0,
      duracion: 0.3,
      desde: { x: entidad.x, y: entidad.y },
      hacia: { x: origen.x, y: origen.y },
    });
  }

  function festejarMaleta(entidad: Entidad): void {
    // El único refuerzo fuerte: la maleta subió al auto.
    efectos.push({
      entidad,
      tipo: 'pop',
      t: 0,
      duracion: 0.4,
      desde: { x: entidad.x, y: entidad.y },
      hacia: { x: entidad.x, y: entidad.y },
    });
    aviso.classList.add('festejo');
    window.setTimeout(() => aviso.classList.remove('festejo'), 1200);
  }

  function tocarSonido(id: string): void {
    const notas = SONIDOS[id];
    if (notas === undefined) return;
    notas.forEach((frecuencia, i) => {
      window.setTimeout(() => audio.tono(frecuencia, 0.18, 0.35), i * 140);
    });
  }

  // ── el cartel grande del final ─────────────────────────────────────────────
  function mostrarCartel(): void {
    const maletas = episodio.maletasEnElAuto();
    cartelTexto.textContent = `Subiste ${maletas} maletas, giraste la manivela y manejaste hasta la casa de la tía.`;
    cartel.classList.add('visible');
  }

  /**
   * Espera a que termine el video del premio y recién ahí levanta el cartel.
   *
   * No se cree de un solo evento: revisa cada medio segundo el estado real del
   * `<video>` y cierra por donde corresponda (terminó, falló, nunca arrancó, no
   * decodificó frames, o pasó el tope). El cartel SIEMPRE aparece: un premio que
   * no se puede ver no puede dejar al niño esperando para siempre.
   */
  function esperarFinDelVideo(alTerminar: () => void): void {
    let cerrado = false;
    let quieto = 0;
    let sinFrames = 0;
    let transcurrido = 0;
    const cerrar = (): void => {
      if (cerrado) return;
      cerrado = true;
      video.detener();
      alTerminar();
    };
    const revisar = (): void => {
      if (cerrado) return;
      transcurrido += 500;
      const v = document.querySelector('video');
      if (v === null) return cerrar(); // ya no hay video: lo cerró alguien
      if (v.ended || v.error !== null) return cerrar();

      const duracion = v.duration;
      if (Number.isFinite(duracion) && duracion > 0 && v.currentTime >= duracion - 0.25) return cerrar();

      // El navegador no dejó reproducir (autoplay bloqueado): no se hace esperar.
      if (v.paused && v.currentTime === 0 && v.readyState >= 3) {
        quieto += 500;
        if (quieto >= 3000) return cerrar();
      } else {
        quieto = 0;
      }

      // Arrancó pero no decodifica (el caso del H.265 en el WebView viejo).
      if (v.videoWidth === 0) {
        sinFrames += 500;
        if (sinFrames >= 8000) return cerrar();
      } else {
        sinFrames = 0;
      }

      if (transcurrido >= 60000) return cerrar(); // tope: el cartel sale igual
      window.setTimeout(revisar, 500);
    };
    window.setTimeout(revisar, 500);
  }

  function festejarLlegada(): void {
    aviso.textContent = '¡Llegamos a la casa de la tía!';
    aviso.classList.add('festejo');
    tocarSonido('festejo');
    // El video ya está reproduciéndose (la recompensa del nivel corre antes que
    // el festejo): el cartel sale cuando termina.
    esperarFinDelVideo(mostrarCartel);
  }

  // ── el episodio (escenario + puente + arrastre) ────────────────────────────
  const episodio: Episodio = crearEpisodio({
    nivel: NIVEL,
    ancho,
    alto,
    // Sin puerto de audio: `sonar(...)` cae en `alEfecto` y ahí ponemos el tono.
    video,
    avisos: {
      alDecir: (_entidad, frase) => {
        aviso.textContent = frase;
      },
      alMensaje: (texto) => {
        aviso.textContent = texto;
      },
      alCelebrar: () => festejarLlegada(),
      alEfecto: (accion: AccionResuelta) => {
        if (accion.nombre === 'sonar') tocarSonido(String(accion.args['sonido'] ?? ''));
      },
    },
    alSubirMaleta: (entidad) => festejarMaleta(entidad),
    alVolverMaleta: (entidad) => volverALugar(entidad),
  });

  // ── los gestos (el reconocedor del paquete gestos, vía adaptadores-web) ────
  const gestos = crearGestosTactiles({
    elemento: contenedor,
    tamanoLogico: () => ({ ancho, alto }),
    alProgresar: (avance) => barra.actualizar(avance.progreso),
    alCompletarGesto: (pedido: PedidoGesto) => {
      // Una unidad del gesto → un `gesto_completado`; la lógica es la que cuenta.
      episodio.puente.gestoCompletado(pedido.gesto, pedido.destino);
    },
  });

  // ── la entrada (para el arrastre) y el juego ──────────────────────────────
  const entrada = crearEntradaTactil({ elemento: contenedor, tamanoLogico: () => ({ ancho, alto }) });

  let enMarcha = false;
  let faseAnterior: FaseViaje | null = null;

  /** Sincroniza el reconocedor con el gesto que la lógica tiene pedido. */
  function sincronizarGesto(): void {
    const pendiente = episodio.puente.logica.eventos.gestosPendientes()[0];
    if (pendiente === undefined) {
      panel.classList.remove('visible');
      return;
    }
    panel.classList.add('visible');
    const actual = gestos.pedido();
    if (
      actual !== null &&
      actual.gesto === pendiente.gesto &&
      actual.destino === pendiente.objetivo &&
      actual.veces === pendiente.veces
    ) {
      return; // ya está pedido y sin completar: no se rearma (perdería el avance)
    }
    gestos.pedir({
      gesto: pendiente.gesto as TipoGesto,
      destino: pendiente.objetivo,
      veces: pendiente.veces,
      sentido: 'horario',
    });
    barra.actualizar(0);
    barra.ponerEtiqueta('Girá la manivela');
    aviso.textContent = 'Girá la manivela 3 veces, como si le dieras cuerda';
  }

  /** Manejar: el auto avanza hacia la casa y, al entrar en la zona, avisa. */
  function manejar(paso: number): void {
    const auto = episodio.escena.obtener(episodio.escenario.piezas.auto);
    if (auto === null) return;
    const objetivo = episodio.zonaCasa.x;
    const velocidad = Math.max(120, ancho * 0.55); // píxeles por segundo
    const destino = objetivo - auto.x;
    const avance = Math.min(Math.abs(destino), velocidad * paso);
    auto.x += Math.sign(destino) * avance;
    if (centroEnZona(episodio.zonaCasa, { x: auto.x, y: auto.y })) {
      enMarcha = false;
      episodio.llegarALaCasa();
    }
  }

  function actualizarFase(fase: FaseViaje, paso: number): void {
    if (fase !== faseAnterior) {
      faseAnterior = fase;
      enMarcha = fase === 'manejando';
      if (fase === 'cargando') aviso.textContent = 'Llevá las tres maletas hasta el auto';
      if (fase === 'manejando') aviso.textContent = '¡Manejando hasta la casa de la tía!';
    }
    if (enMarcha && fase === 'manejando') manejar(paso);
  }

  function avanzarEfectos(paso: number): void {
    for (let i = efectos.length - 1; i >= 0; i--) {
      const efecto = efectos[i]!;
      efecto.t += paso;
      const avance = Math.min(1, efecto.t / efecto.duracion);
      if (efecto.tipo === 'volver') {
        efecto.entidad.x = efecto.desde.x + (efecto.hacia.x - efecto.desde.x) * avance;
        efecto.entidad.y = efecto.desde.y + (efecto.hacia.y - efecto.desde.y) * avance;
      } else {
        const escala = 1 + Math.sin(avance * Math.PI) * 0.15;
        efecto.entidad.escalaX = escala;
        efecto.entidad.escalaY = escala;
      }
      if (avance >= 1) {
        if (efecto.tipo === 'pop') {
          efecto.entidad.escalaX = 1;
          efecto.entidad.escalaY = 1;
        }
        efectos.splice(i, 1);
      }
    }
  }

  const juego = new Juego({
    escena: episodio.escena,
    render,
    entrada,
    pantalla,
    reloj: crearReloj(),
    arrastre: episodio.arrastre,
    alPaso: (paso, tiempoSimulado) => {
      episodio.paso(tiempoSimulado);
      avanzarEfectos(paso);
      sincronizarGesto();
      actualizarFase(faseDelViaje(episodio.puente.logica), paso);
    },
  });

  document.getElementById('otra-vez')?.addEventListener('click', () => location.reload());

  // El audio del navegador necesita un gesto: el primer toque lo desbloquea.
  contenedor.addEventListener('pointerdown', () => {
    void audio.desbloquear();
  }, { once: true });

  const info = plataforma.info();
  console.info('juegosemi: plataforma', {
    nombre: info.nombre,
    chromium: info.soporte.chromium,
    huawei: info.soporte.huawei,
    nucleos: info.nucleos,
  });
  console.info('juegosemi: episodio', {
    premio: premioDelNivel(NIVEL),
    url: urlDeVideo(premioDelNivel(NIVEL)),
    maletas: episodio.escenario.piezas.maletas.length,
    zona: episodio.zonaCasa.nombre,
    gesto: `${GESTO_MANIVELA} sobre ${OBJETIVO_MANIVELA}`,
  });

  juego.iniciar();
  juego.dibujar(); // primer cuadro ya mismo (para no ver la pantalla vacía)

  // Hook de diagnóstico para la consola del navegador (QA): deja todo a mano y
  // permite jugar el episodio sin dedo.
  (window as unknown as Record<string, unknown>)['juegosemi'] = {
    episodio,
    gestos,
    nivel: NIVEL,
    ayuda: {
      /** Arrastra una maleta hasta el auto (simulando el dedo). */
      arrastrarMaleta(maletaId: string, alAuto = true): void {
        const maleta = episodio.escena.obtener(maletaId);
        const auto = episodio.escena.obtener(episodio.escenario.piezas.auto);
        if (maleta === null || auto === null) throw new Error('no encuentro esa maleta o el auto');
        const caja = contenedor.getBoundingClientRect();
        const escalaX = caja.width / ancho;
        const escalaY = caja.height / alto;
        const evento = (tipo: string, x: number, y: number): PointerEvent =>
          new PointerEvent(tipo, {
            clientX: caja.left + x * escalaX,
            clientY: caja.top + y * escalaY,
            pointerId: 7,
            bubbles: true,
          });
        const destino = alAuto
          ? { x: auto.x, y: auto.y }
          : { x: episodio.zonaCasa.x, y: episodio.zonaCasa.y };
        contenedor.dispatchEvent(evento('pointerdown', maleta.x, maleta.y));
        contenedor.dispatchEvent(evento('pointermove', (maleta.x + destino.x) / 2, (maleta.y + destino.y) / 2));
        contenedor.dispatchEvent(evento('pointermove', destino.x, destino.y));
        contenedor.dispatchEvent(evento('pointerup', destino.x, destino.y));
      },
      /** Da por hechas las 3 vueltas de la manivela (lo que hace el dedo). */
      girarManivela(veces = 3): void {
        for (let i = 0; i < veces; i++) episodio.puente.gestoCompletado(GESTO_MANIVELA, OBJETIVO_MANIVELA);
      },
      /** Avisa que el auto llegó a la casa (lo que pasa al manejar). */
      llegarALaCasa(): void {
        episodio.llegarALaCasa();
      },
    },
  };
}

void principal();
