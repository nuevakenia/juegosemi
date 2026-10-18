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
import {
  VARIABLE_PREMIO_DEL_DIA,
  conPremioDelDia,
  crearAlmacenRecompensas,
  crearSelectorDeRecompensas,
  elegirPremioDelDia,
  premioDelDia,
  recompensaPorId,
  recompensasDeEpisodio,
  reproducirRecompensa,
  respaldosDeVideo,
  urlDeRecompensa,
  type Recompensa,
  type ReproduccionRecompensa,
} from '@juegosemi/recompensas';
import '@juegosemi/ui/estilos.css';
import '@juegosemi/recompensas/estilos.css';
import { NIVEL } from './nivel.ts';
import { crearEpisodio, type Episodio } from './episodio.ts';
import { centroEnZona } from './escenario.ts';
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

  // ── el premio del día, ANTES de jugar ──────────────────────────────────────
  // El catálogo vive en datos y el elegido queda guardado; con eso se arma el
  // nivel, que ya paga la recompensa leyendo `$premio-del-dia`. Cambiar el premio
  // es tocar una tarjeta del selector, nunca el código.
  const almacen = crearAlmacenRecompensas();
  let premioActual: Recompensa = premioDelDia(almacen, NIVEL.id);
  const nivel = conPremioDelDia(NIVEL, premioActual);

  // ── el nivel, revisado antes de jugar ──────────────────────────────────────
  const revision = validarNivel(nivel);
  if (!revision.ok) {
    aviso.textContent = `El nivel tiene errores: ${revision.errores.join(' · ')}`;
    return;
  }

  // ── adaptadores ────────────────────────────────────────────────────────────
  const plataforma = crearPlataforma();
  const audio = crearAudioWeb();
  const pantalla = crearPantalla(contenedor.clientWidth || 800, contenedor.clientHeight || 600);

  // El puerto de video de verdad (mide FRAMES: si el WebView no decodifica el
  // códec, devuelve `ok:false` y el premio cae al respaldo del catálogo).
  const videoHtml = crearVideoHtml();

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
    const resumen = `Subiste ${maletas} maletas, giraste la manivela y manejaste hasta la casa de la tía.`;
    // Un premio de tipo `frase` no tiene dónde verse: se muestra acá, grande.
    cartelTexto.textContent = fraseDelPremio === null ? resumen : `${fraseDelPremio} ${resumen}`;
    cartel.classList.add('visible');
  }

  // ── el premio del día (video, frase o sonido) ──────────────────────────────
  // Lo elige el NIVEL con `reproducir_video($premio-del-dia)`. Acá se ve y, si no
  // se puede ver en esta pantalla, se avisa en castellano claro y se prueba el
  // respaldo del catálogo (el mismo `verVideo` del lector de videos: no hay un
  // segundo reproductor). Nunca un rectángulo negro ni una pantalla muda.
  let reproduccionPremio: ReproduccionRecompensa | null = null;
  let huboPremio = false;
  // El texto de un premio de tipo `frase`, para mostrarlo en el cartel del final.
  let fraseDelPremio: string | null = null;

  function reproducirPremioDelDia(idDelNivel: string): void {
    const recompensa = recompensaPorId(idDelNivel) ?? premioActual;
    premioActual = recompensa;
    fraseDelPremio = recompensa.tipo === 'frase' ? (recompensa.texto ?? recompensa.titulo) : null;
    if (reproduccionPremio !== null) reproduccionPremio.cancelar();
    reproduccionPremio = reproducirRecompensa({
      puerto: videoHtml,
      recompensa,
      respaldos: respaldosDeVideo(recompensa, NIVEL.id),
      alAvisar: (frase) => {
        aviso.textContent = frase;
      },
      alTerminar: () => mostrarCartel(),
    });
  }

  function festejarLlegada(): void {
    aviso.textContent = '¡Llegamos a la casa de la tía!';
    aviso.classList.add('festejo');
    tocarSonido('festejo');
    // El premio ya está corriendo (la recompensa del nivel va antes que el
    // festejo): el cartel sale cuando termina. Si por lo que sea no arrancó, el
    // cartel sale igual: nadie se queda esperando para siempre.
    if (!huboPremio) mostrarCartel();
  }

  // ── el episodio (escenario + puente + arrastre) ────────────────────────────
  const episodio: Episodio = crearEpisodio({
    nivel,
    ancho,
    alto,
    // Sin puerto de audio NI de video: `sonar(...)` y `reproducir_video(...)` caen
    // en `alEfecto`, y ahí el premio se maneja con respaldo (ver arriba).
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
        if (accion.nombre === 'reproducir_video') {
          huboPremio = true;
          reproducirPremioDelDia(String(accion.args['video'] ?? ''));
        }
      },
    },
    alSubirMaleta: (entidad) => festejarMaleta(entidad),
    alVolverMaleta: (entidad) => volverALugar(entidad),
  });

  // ── el selector de premios (pieza de @juegosemi/recompensas) ───────────────
  // Botón grande "Cambiar el premio": abre las tarjetas y, al tocar una, la
  // guarda y la usa el juego en curso. Sin escribir código. Es la misma pieza
  // que después va a usar el editor de niveles.
  function cambiarPremio(recompensa: Recompensa): void {
    premioActual = recompensa;
    elegirPremioDelDia(almacen, recompensa);
    // El mundo del juego en curso también: así el nivel paga el nuevo premio.
    episodio.puente.logica.mundo.marcar(VARIABLE_PREMIO_DEL_DIA, recompensa.id);
    aviso.textContent = `Listo: el premio del día ahora es "${recompensa.titulo}".`;
    console.info('juegosemi: premio cambiado', { premio: recompensa.id, titulo: recompensa.titulo });
  }

  const contenedorPremio = document.getElementById('premio');
  if (contenedorPremio) {
    contenedorPremio.appendChild(
      crearSelectorDeRecompensas({
        recompensas: recompensasDeEpisodio(NIVEL.id),
        elegidoId: premioActual.id,
        alElegir: (recompensa) => cambiarPremio(recompensa),
      }).elemento,
    );
  }

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
    premio: premioActual.id,
    titulo: premioActual.titulo,
    url: urlDeRecompensa(premioActual),
    premios: recompensasDeEpisodio(NIVEL.id).length,
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
    nivel,
    /** El premio del día que está puesto ahora. */
    premio: () => premioActual,
    /** Todo el catálogo de premios del episodio. */
    premios: recompensasDeEpisodio(NIVEL.id),
    /** Cambia el premio del día por su id (lo mismo que hace el selector). */
    elegirPremio: (id: string): void => {
      const recompensa = recompensaPorId(id);
      if (recompensa !== null) cambiarPremio(recompensa);
    },
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
