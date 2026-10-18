/**
 * El juego de gestos: la pantalla de verdad.
 *
 * Cablea las piezas que ya existen —la lógica por datos (@juegosemi/logica), el
 * adaptador de gestos sobre la entrada táctil (@juegosemi/gestos +
 * @juegosemi/adaptadores-web) y la barra (@juegosemi/ui)— contra la estructura
 * fija de index.html.
 *
 * El reparto de responsabilidades (y por qué):
 *   - el NIVEL (nivel.ts) dice qué gesto se pide y cuántas veces;
 *   - la LÓGICA lleva la cuenta y avisa cuándo un gesto quedó completo;
 *   - el RECONOCEDOR mira el dedo y avisa cada unidad del gesto;
 *   - esta pantalla sólo pega las tres cosas y muestra la barra.
 *
 * Regla de oro: nada de feedback negativo. Si el niño no completa el gesto, no
 * pasa nada malo: la barra vuelve a empezar y se sigue esperando con la misma
 * carita amable.
 */
import { Logica, validarNivel, type Efectos, type Evento } from '@juegosemi/logica';
import { crearGestosTactiles } from '@juegosemi/adaptadores-web';
import { crearBarraProgreso } from '@juegosemi/ui';
import type { AvanceGesto, PedidoGesto, TipoGesto } from '@juegosemi/puertos';
import { crearNivelGestos, pasoPorGesto, type PasoGesto } from './nivel.ts';

/** Busca un elemento fijo del HTML o se planta (mejor fallar claro que a medias). */
function exigir<T extends HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`falta el elemento #${id} en el HTML`);
  return elemento as T;
}

function principal(): void {
  const escenario = exigir<HTMLDivElement>('escenario');
  const barraContenedor = exigir<HTMLDivElement>('barra');
  const pictograma = exigir<HTMLSpanElement>('pictograma');
  const titulo = exigir<HTMLHeadingElement>('titulo');
  const ayuda = exigir<HTMLParagraphElement>('ayuda');
  const estado = exigir<HTMLDivElement>('estado');
  const cartel = exigir<HTMLDivElement>('cartel');
  const cartelTexto = exigir<HTMLParagraphElement>('cartel-texto');

  // ── el nivel y su revisión ────────────────────────────────────────────────
  const nivel = crearNivelGestos();
  const revision = validarNivel(nivel);
  if (!revision.ok) {
    ayuda.textContent = `El nivel tiene errores: ${revision.errores.join(' · ')}`;
    return;
  }

  // ── la barra ──────────────────────────────────────────────────────────────
  const barra = crearBarraProgreso();
  barraContenedor.appendChild(barra.elemento);

  // ── la lógica (cuenta los gestos y avisa cuándo terminó) ───────────────────
  const cola: Evento[] = [];
  let corriendo = true;

  const efectos: Efectos = {
    aplicar(): void {
      // El nivel de gestos no usa acciones externas: todo (pedir, sumar) es local.
    },
    termino(): void {
      cartelTexto.textContent = 'Hiciste los cuatro gestos. ¡Genial!';
      cartel.classList.add('visible');
      corriendo = false;
    },
  };
  const logica = new Logica(nivel, efectos);

  // ── el reconocedor sobre el dedo (o el mouse) ──────────────────────────────
  const gestos = crearGestosTactiles({
    elemento: escenario,
    alProgresar(avance: AvanceGesto): void {
      barra.actualizar(avance.progreso);
    },
    alCompletarGesto(pedido: PedidoGesto): void {
      // Una unidad del gesto → un `gesto_completado` para la lógica, que sabe contar.
      cola.push({ tipo: 'gesto_completado', gesto: pedido.gesto, destino: pedido.destino });
    },
  });

  let gestoActual: TipoGesto | null = null;

  function mostrarPaso(paso: PasoGesto): void {
    pictograma.textContent = paso.pictograma;
    titulo.textContent = paso.etiqueta;
    ayuda.textContent = paso.ayuda;
    barra.ponerEtiqueta(paso.etiqueta);
  }

  /**
   * Pone al reconocedor a esperar el gesto que la lógica tiene pedido. Se llama
   * cada cuadro: cuando cambia el pedido (porque se completó el anterior), se
   * rearma el reconocedor con las tolerancias del paso.
   */
  function sincronizarPedido(): void {
    const pendiente = logica.eventos.gestosPendientes()[0];
    if (pendiente === undefined) return;
    if (gestoActual === (pendiente.gesto as TipoGesto)) return;
    const paso = pasoPorGesto(pendiente.gesto as TipoGesto);
    if (paso === null) return;

    const pedido: PedidoGesto = {
      gesto: paso.gesto,
      destino: pendiente.objetivo,
      veces: pendiente.veces,
    };
    if (paso.milisegundos !== undefined) pedido.milisegundos = paso.milisegundos;
    if (paso.sentido !== undefined) pedido.sentido = paso.sentido;
    if (paso.direccion !== undefined) pedido.direccion = paso.direccion;
    if (paso.distancia !== undefined) pedido.distancia = paso.distancia;

    gestoActual = paso.gesto;
    barra.actualizar(0);
    mostrarPaso(paso);
    gestos.pedir(pedido);
  }

  function actualizarEstado(): void {
    const avance = gestos.avance();
    estado.textContent = avance.veces > 1 ? `${avance.hechas} de ${avance.veces}` : '';
  }

  function cuadro(): void {
    if (!corriendo) return;
    sincronizarPedido();
    logica.paso(cola.splice(0, cola.length));
    actualizarEstado();
    if (!logica.terminadoNivel()) window.requestAnimationFrame(cuadro);
  }

  document.getElementById('otra-vez')?.addEventListener('click', () => {
    location.reload();
  });

  // La primera vuelta del paso: ahí la lógica registra el pedido del primer gesto.
  logica.paso([]);
  sincronizarPedido();
  actualizarEstado();
  window.requestAnimationFrame(cuadro);

  // Hook de diagnóstico para la consola del navegador (QA): deja la lógica, el
  // reconocedor y el nivel a mano para mirarlos y disparar gestos sintéticos.
  (window as unknown as Record<string, unknown>)['juegosemi'] = { logica, gestos, nivel };
}

principal();
