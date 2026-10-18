/**
 * La pantalla del editor de niveles: armar el juego tocando botones grandes.
 *
 * Es sólo DOM: el estado vive en `estado.ts` (puro) y acá se pinta y se cablean los
 * botones. Cada toque hace una operación de alto nivel ("elegir el cuándo", "elegir
 * qué hace", "borrar la regla") y vuelve a pintar la lista.
 *
 * Cómo está pensado para el grande (y para el niño que toca):
 *   - tres pasos GRANDES por regla: CUÁNDO, QUIÉN y ENTONCES, en ese orden;
 *   - las opciones se abren EN LA MISMA TARJETA, sin saltar de pantalla;
 *   - las listas sólo ofrecen lo que existe en el juego y lo que tiene sentido
 *     (las plantillas se encargan de eso, no esta pantalla);
 *   - el video se elige con el selector de premios que ya existe;
 *   - abajo, la frase en castellano de cada regla y un botón grande para borrarla.
 *
 * Nada de feedback negativo: si algo falta, se dice qué falta y se sigue.
 */
import { crearBoton, crearElemento } from '@juegosemi/ui';
import { RECOMPENSAS, crearSelectorDeRecompensas, type Recompensa } from '@juegosemi/recompensas';
import {
  CATEGORIAS,
  ETIQUETA_DE_CATEGORIA,
  PICTOGRAMA_DE_CATEGORIA,
  PISTA_DE_CATEGORIA,
  type Categoria,
} from './categorias.ts';
import type { NivelEnConstruccion, ReglaEditor } from './estado.ts';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  conCosa,
  conTitulo,
  elegirCuando,
  idLibre,
  idsDe,
  moverRegla,
  nombreDe,
  ponerValorAccion,
  ponerValorCuando,
  quitarAccion,
  quitarRegla,
  sinCosa,
  textoDe,
} from './estado.ts';
import { reglasCompletas, valoresPorDefectoCuando, valoresPorDefectoEntonces } from './construir.ts';
import { fraseDeRegla } from './frases.ts';
import {
  GESTOS,
  ENTIDAD_ACTUAL,
  PLANTILLAS_CUANDO,
  entoncesDisponibles,
  plantillaCuando,
  plantillaEntonces,
  type Pregunta,
} from './plantillas.ts';
import { AVISO_INCOMPLETO, AVISO_LISTO, revisar } from './validar-editor.ts';

/** Qué paso de qué regla está abierto ahora (se abren de a uno). */
interface Abierto {
  reglaId: string;
  paso: 'cuando' | 'quien' | 'entonces';
}

export interface OpcionesEditor {
  nivel: NivelEnConstruccion;
  /** Se tocó "Probar": acá va la prueba en vivo (sólo se llama si el nivel cierra). */
  alProbar: (nivel: NivelEnConstruccion) => void;
}

export interface Editor {
  /** El elemento para meter en la página. */
  elemento: HTMLElement;
  /** Vuelve a pintar todo desde el estado actual. */
  pintar(): void;
  /** El nivel que se está armando ahora. */
  nivel(): NivelEnConstruccion;
  /** Aplica una operación de alto nivel y repinta. */
  actualizar(cambio: (nivel: NivelEnConstruccion) => NivelEnConstruccion): void;
}

/** Los videos del catálogo de premios: son los que puede pedir `reproducir_video`. */
function videosDisponibles(): Recompensa[] {
  return RECOMPENSAS.filter((premio) => premio.tipo === 'video');
}

export function crearEditor(opciones: OpcionesEditor): Editor {
  let nivel = opciones.nivel;
  let abierto: Abierto | null = null;

  const raiz = crearElemento('div', { clases: 'editor' });

  /** Un botón grande de opción, marcado si es la que está elegida. */
  function opcion(etiqueta: string, elegido: boolean, alElegir: () => void, pictograma?: string): HTMLButtonElement {
    const boton = crearBoton({
      etiqueta,
      alElegir,
      clasesExtra: 'opcion',
      ...(pictograma === undefined ? {} : { pictograma }),
    });
    boton.setAttribute('aria-pressed', elegido ? 'true' : 'false');
    return boton;
  }

  /** Los ids disponibles para una pregunta de lista. */
  function opcionesDe(pregunta: Pregunta): Array<{ id: string; nombre: string }> {
    if (pregunta.tipo === 'entidad') return nivel.entidades;
    if (pregunta.tipo === 'zona') return nivel.zonas;
    if (pregunta.tipo === 'contador') return nivel.contadores;
    if (pregunta.tipo === 'interruptor') return nivel.interruptores;
    if (pregunta.tipo === 'mision') return nivel.misiones;
    return [];
  }

  /**
   * Una pregunta del editor: botones grandes con lo que existe (y el comodín
   * "lo que se suelta" donde tenga sentido). Los números y los textos cortos se
   * escriben a mano.
   */
  function pintarPregunta(
    pregunta: Pregunta,
    valor: string | number | undefined,
    alElegir: (nuevo: string | number) => void,
    texto: string,
  ): HTMLElement {
    const caja = crearElemento('div', { clases: 'pregunta' });
    caja.appendChild(crearElemento('p', { clases: 'pregunta__titulo', texto: `${pregunta.etiqueta}${pregunta.opcional === true ? ' (si querés)' : ''}` }));

    if (pregunta.tipo === 'numero') {
      const entrada = crearElemento('input', { clases: 'campo campo--numero' });
      entrada.type = 'number';
      entrada.inputMode = 'numeric';
      entrada.min = '1';
      entrada.value = valor === undefined ? '' : String(valor);
      entrada.addEventListener('change', () => {
        const numero = Number(entrada.value);
        alElegir(Number.isFinite(numero) ? numero : 0);
      });
      caja.appendChild(entrada);
      return caja;
    }

    if (pregunta.tipo === 'frase' || pregunta.tipo === 'sonido') {
      const entrada = crearElemento('input', { clases: 'campo' });
      entrada.type = 'text';
      entrada.placeholder = pregunta.pista ?? '';
      entrada.value = valor === undefined ? '' : String(valor);
      entrada.addEventListener('change', () => alElegir(entrada.value));
      caja.appendChild(entrada);
      return caja;
    }

    if (pregunta.tipo === 'video') {
      const elegido = valor === undefined ? null : String(valor);
      caja.appendChild(
        crearSelectorDeRecompensas({
          recompensas: videosDisponibles(),
          elegidoId: elegido,
          etiqueta: 'Elegí el video',
          titulo: '¿Qué video se ve?',
          subtitulo: 'Tocá el premio que se gana',
          alElegir: (premio) => alElegir(premio.id),
        }).elemento,
      );
      return caja;
    }

    if (pregunta.tipo === 'gesto') {
      const fila = crearElemento('div', { clases: 'opciones' });
      for (const gesto of GESTOS) {
        fila.appendChild(opcion(gesto, String(valor ?? '') === gesto, () => alElegir(gesto)));
      }
      caja.appendChild(fila);
      return caja;
    }

    // Listas de cosas del juego (entidad, zona, contador, interruptor, misión).
    const lista = opcionesDe(pregunta);
    const fila = crearElemento('div', { clases: 'opciones' });

    if (pregunta.tipo === 'entidad' && pregunta.admiteEntidadActual === true) {
      fila.appendChild(
        opcion('lo que se suelta', String(valor ?? '') === ENTIDAD_ACTUAL, () => alElegir(ENTIDAD_ACTUAL)),
      );
    }
    for (const cosa of lista) {
      fila.appendChild(opcion(cosa.nombre, String(valor ?? '') === cosa.id, () => alElegir(cosa.id)));
    }

    if (lista.length === 0 && !(pregunta.tipo === 'entidad' && pregunta.admiteEntidadActual === true)) {
      // Todavía no hay nada de esta clase: se deja escribir el nombre y listo.
      const entrada = crearElemento('input', { clases: 'campo' });
      entrada.type = 'text';
      entrada.placeholder = 'escribí el nombre';
      entrada.value = valor === undefined ? '' : String(valor);
      entrada.addEventListener('change', () => alElegir(entrada.value));
      fila.appendChild(entrada);
    }

    caja.appendChild(fila);
    if (texto !== '') caja.appendChild(crearElemento('p', { clases: 'pregunta__nota', texto }));
    return caja;
  }

  // ── Las cosas del juego ────────────────────────────────────────────────────

  function pintarCosas(): HTMLElement {
    const panel = crearElemento('section', { clases: 'cosas' });
    panel.appendChild(crearElemento('h2', { clases: 'cosas__titulo', texto: 'Lo que tiene el juego' }));

    for (const categoria of CATEGORIAS) {
      panel.appendChild(pintarCategoria(categoria));
    }
    return panel;
  }

  function pintarCategoria(categoria: Categoria): HTMLElement {
    const grupo = crearElemento('div', { clases: 'grupo' });
    grupo.appendChild(
      crearElemento('h3', {
        clases: 'grupo__titulo',
        texto: `${PICTOGRAMA_DE_CATEGORIA[categoria]} ${ETIQUETA_DE_CATEGORIA[categoria]}`,
      }),
    );

    const fila = crearElemento('div', { clases: 'fila' });
    for (const cosa of nivel[categoria]) {
      const chip = crearElemento('span', { clases: 'chip' });
      chip.appendChild(crearElemento('span', { clases: 'chip__texto', texto: cosa.nombre }));
      chip.appendChild(
        crearBoton({
          etiqueta: '✕',
          nombreAccesible: `Sacar ${cosa.nombre}`,
          clasesExtra: 'chip__sacar',
          alElegir: () => actualizar((actual) => sinCosa(actual, categoria, cosa.id)),
        }),
      );
      fila.appendChild(chip);
    }
    grupo.appendChild(fila);

    const agregar = crearElemento('div', { clases: 'agregar' });
    const entrada = crearElemento('input', { clases: 'campo' });
    entrada.type = 'text';
    entrada.placeholder = PISTA_DE_CATEGORIA[categoria];
    const sumar = (): void => {
      const texto = entrada.value;
      if (texto.trim() === '') return;
      entrada.value = '';
      actualizar((actual) => conCosa(actual, categoria, texto));
    };
    entrada.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') sumar();
    });
    agregar.appendChild(entrada);
    agregar.appendChild(
      crearBoton({ etiqueta: 'Agregar', pictograma: '＋', clasesExtra: 'agregar__boton', alElegir: sumar }),
    );
    grupo.appendChild(agregar);
    return grupo;
  }

  // ── Las reglas ─────────────────────────────────────────────────────────────

  function pintarRegla(regla: ReglaEditor, indice: number): HTMLElement {
    const tarjeta = crearElemento('section', { clases: 'regla' });
    tarjeta.setAttribute('data-regla', regla.id);

    tarjeta.appendChild(
      crearElemento('h2', { clases: 'regla__titulo', texto: `Regla ${indice + 1}` }),
    );
    tarjeta.appendChild(
      crearElemento('p', { clases: 'regla__frase', texto: fraseDeRegla(nivel, regla) }),
    );

    const pasos = crearElemento('div', { clases: 'regla__pasos' });
    pasos.appendChild(pintarPasoCuando(regla));
    if (regla.cuandoId !== null) {
      pasos.appendChild(pintarPasoQuien(regla));
      pasos.appendChild(pintarPasoEntonces(regla));
    }
    tarjeta.appendChild(pasos);

    if (abierto !== null && abierto.reglaId === regla.id) {
      tarjeta.appendChild(pintarPanelAbierto(regla));
    }

    const pie = crearElemento('div', { clases: 'regla__pie' });
    pie.appendChild(
      crearBoton({
        etiqueta: 'Subir',
        pictograma: '⬆',
        clasesExtra: 'regla__flecha',
        alElegir: () => actualizar((actual) => moverRegla(actual, regla.id, -1)),
      }),
    );
    pie.appendChild(
      crearBoton({
        etiqueta: 'Bajar',
        pictograma: '⬇',
        clasesExtra: 'regla__flecha',
        alElegir: () => actualizar((actual) => moverRegla(actual, regla.id, 1)),
      }),
    );
    pie.appendChild(
      crearBoton({
        etiqueta: 'Borrar la regla',
        pictograma: '🗑',
        clasesExtra: 'regla__borrar',
        alElegir: () => {
          abierto = null;
          actualizar((actual) => quitarRegla(actual, regla.id));
        },
      }),
    );
    tarjeta.appendChild(pie);
    return tarjeta;
  }

  /** El resumen del paso CUANDO ("Toca algo") en el botón grande. */
  function pintarPasoCuando(regla: ReglaEditor): HTMLElement {
    const plantilla = plantillaCuando(regla.cuandoId);
    const texto = plantilla === null ? 'Elegir el cuándo' : `Cuándo: ${plantilla.etiqueta}`;
    const activo = abierto !== null && abierto.reglaId === regla.id && abierto.paso === 'cuando';
    return opcion(texto, activo, () => abrir(regla.id, 'cuando'), '1️⃣');
  }

  /** El resumen del paso QUIEN, con lo que ya se eligió. */
  function pintarPasoQuien(regla: ReglaEditor): HTMLElement {
    const plantilla = plantillaCuando(regla.cuandoId);
    let texto = 'Elegir quién';
    if (plantilla !== null) {
      const elegido = textoDe(regla.cuandoValores, plantilla.quien.clave);
      texto = elegido === '' ? `Quién: ${plantilla.quien.etiqueta}` : `Quién: ${nombreDe(nivel, elegido)}`;
    }
    const activo = abierto !== null && abierto.reglaId === regla.id && abierto.paso === 'quien';
    return opcion(texto, activo, () => abrir(regla.id, 'quien'), '2️⃣');
  }

  /** El resumen del paso ENTONCES: cuántas cosas hace. */
  function pintarPasoEntonces(regla: ReglaEditor): HTMLElement {
    const cuantas = regla.acciones.length;
    const texto = cuantas === 0 ? 'Elegir qué hace' : `Entonces: ${cuantas === 1 ? '1 cosa' : `${cuantas} cosas`}`;
    const activo = abierto !== null && abierto.reglaId === regla.id && abierto.paso === 'entonces';
    return opcion(texto, activo, () => abrir(regla.id, 'entonces'), '3️⃣');
  }

  function abrir(reglaId: string, paso: Abierto['paso']): void {
    if (abierto !== null && abierto.reglaId === reglaId && abierto.paso === paso) {
      abierto = null;
      pintar();
      return;
    }
    abierto = { reglaId, paso };
    pintar();
  }

  /** El panel con las opciones del paso que está abierto. */
  function pintarPanelAbierto(regla: ReglaEditor): HTMLElement {
    const paso = abierto === null ? 'cuando' : abierto.paso;
    if (paso === 'cuando') return pintarPanelCuando(regla);
    if (paso === 'quien') return pintarPanelQuien(regla);
    return pintarPanelEntonces(regla);
  }

  function pintarPanelCuando(regla: ReglaEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    panel.appendChild(crearElemento('p', { clases: 'panel__titulo', texto: '¿Qué pasa?' }));
    const opciones = crearElemento('div', { clases: 'opciones' });
    for (const plantilla of PLANTILLAS_CUANDO) {
      opciones.appendChild(
        opcion(plantilla.etiqueta, regla.cuandoId === plantilla.id, () => {
          // Al elegir el cuándo, se abre solo el paso siguiente: QUIÉN.
          abierto = { reglaId: regla.id, paso: 'quien' };
          actualizar((actual) =>
            elegirCuando(actual, regla.id, plantilla.id, valoresPorDefectoCuando(plantilla.id)),
          );
        }, plantilla.pictograma),
      );
    }
    panel.appendChild(opciones);
    return panel;
  }

  function pintarPanelQuien(regla: ReglaEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    const plantilla = plantillaCuando(regla.cuandoId);
    if (plantilla === null) return panel;
    panel.appendChild(crearElemento('p', { clases: 'panel__titulo', texto: '¿De qué se trata?' }));
    panel.appendChild(
      pintarPregunta(
        plantilla.quien,
        regla.cuandoValores[plantilla.quien.clave],
        (valor) => actualizar((actual) => ponerValorCuando(actual, regla.id, plantilla.quien.clave, valor)),
        '',
      ),
    );
    for (const extra of plantilla.extras) {
      panel.appendChild(
        pintarPregunta(
          extra,
          regla.cuandoValores[extra.clave],
          (valor) => actualizar((actual) => ponerValorCuando(actual, regla.id, extra.clave, valor)),
          '',
        ),
      );
    }
    return panel;
  }

  function pintarPanelEntonces(regla: ReglaEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    panel.appendChild(crearElemento('p', { clases: 'panel__titulo', texto: '¿Qué hace? (podés sumar varias)' }));

    const lista = crearElemento('div', { clases: 'acciones' });
    regla.acciones.forEach((accion, i) => {
      const bloque = crearElemento('div', { clases: 'accion' });
      const plantilla = plantillaEntonces(accion.entoncesId);
      bloque.appendChild(
        crearElemento('p', {
          clases: 'accion__titulo',
          texto: `${plantilla === null ? '?' : plantilla.pictograma + ' ' + plantilla.etiqueta}`,
        }),
      );
      if (plantilla !== null) {
        for (const pregunta of plantilla.preguntas) {
          bloque.appendChild(
            pintarPregunta(
              pregunta,
              accion.valores[pregunta.clave],
              (valor) => actualizar((actual) => ponerValorAccion(actual, regla.id, i, pregunta.clave, valor)),
              '',
            ),
          );
        }
      }
      bloque.appendChild(
        crearBoton({
          etiqueta: 'Sacar',
          pictograma: '✕',
          clasesExtra: 'accion__sacar',
          alElegir: () => actualizar((actual) => quitarAccion(actual, regla.id, i)),
        }),
      );
      lista.appendChild(bloque);
    });
    panel.appendChild(lista);

    const opciones = crearElemento('div', { clases: 'opciones' });
    for (const plantilla of entoncesDisponibles(regla.cuandoId)) {
      opciones.appendChild(
        opcion(plantilla.etiqueta, false, () => {
          actualizar((actual) =>
            agregarAccion(actual, regla.id, plantilla.id, valoresPorDefectoEntonces(regla, plantilla.id)),
          );
        }, plantilla.pictograma),
      );
    }
    panel.appendChild(opciones);
    return panel;
  }

  // ── La pantalla entera ─────────────────────────────────────────────────────

  function actualizar(cambio: (nivel: NivelEnConstruccion) => NivelEnConstruccion): void {
    nivel = cambio(nivel);
    pintar();
  }

  function pintar(): void {
    raiz.textContent = '';

    const cabecera = crearElemento('header', { clases: 'cabecera' });
    const titulo = crearElemento('input', { clases: 'cabecera__titulo' });
    titulo.type = 'text';
    titulo.value = nivel.titulo;
    titulo.setAttribute('aria-label', 'El nombre del juego');
    titulo.addEventListener('change', () => actualizar((actual) => conTitulo(actual, titulo.value)));
    cabecera.appendChild(titulo);
    cabecera.appendChild(
      crearElemento('p', { clases: 'cabecera__bajada', texto: 'Armá el juego tocando botones: ¿qué pasa, de qué se trata y qué hace?' }),
    );
    raiz.appendChild(cabecera);

    raiz.appendChild(pintarCosas());

    const revision = revisar(nivel);
    const barra = crearElemento('div', { clases: 'barra' });
    const listas = reglasCompletas(nivel);
    barra.appendChild(
      crearElemento('p', {
        clases: 'barra__cuenta',
        texto: nivel.reglas.length === 0 ? 'Todavía no hay reglas' : `${listas} de ${nivel.reglas.length} reglas listas`,
      }),
    );
    barra.appendChild(
      crearBoton({
        etiqueta: 'Nueva regla',
        pictograma: '＋',
        clasesExtra: 'barra__nueva',
        alElegir: () => {
          const nuevaId = idLibre(nivel.reglas.map((regla) => regla.id), 'regla');
          actualizar((actual) => agregarReglaEnBlanco(actual));
          abierto = { reglaId: nuevaId, paso: 'cuando' };
          pintar();
        },
      }),
    );
    const probar = crearBoton({
      etiqueta: 'Probar el juego',
      pictograma: '▶️',
      clasesExtra: 'barra__probar',
      deshabilitado: !revision.ok,
      ...(revision.ok ? { alElegir: () => opciones.alProbar(nivel) } : {}),
    });
    barra.appendChild(probar);
    raiz.appendChild(barra);

    const aviso = crearElemento('div', { clases: revision.ok ? 'aviso aviso--listo' : 'aviso' });
    aviso.setAttribute('role', 'status');
    if (revision.ok) {
      aviso.textContent = AVISO_LISTO;
    } else {
      aviso.appendChild(crearElemento('p', { clases: 'aviso__titulo', texto: AVISO_INCOMPLETO }));
      const lista = crearElemento('ul', { clases: 'aviso__lista' });
      for (const mensaje of revision.mensajes) {
        lista.appendChild(crearElemento('li', { texto: mensaje }));
      }
      aviso.appendChild(lista);
    }
    raiz.appendChild(aviso);

    const reglas = crearElemento('div', { clases: 'reglas' });
    if (nivel.reglas.length === 0) {
      reglas.appendChild(
        crearElemento('p', { clases: 'reglas__vacio', texto: 'Tocá «Nueva regla» para armar la primera.' }),
      );
    }
    nivel.reglas.forEach((regla, i) => reglas.appendChild(pintarRegla(regla, i)));
    raiz.appendChild(reglas);
  }

  // La función se usa antes de declararla (los botones la llaman al tocarse).
  pintar();

  return {
    elemento: raiz,
    pintar,
    nivel: () => nivel,
    actualizar,
  };
}
