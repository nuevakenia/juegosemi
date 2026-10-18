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
import type { NivelEnConstruccion, MisionEditor, ReglaEditor } from './estado.ts';
import {
  agregarAccion,
  agregarReglaEnBlanco,
  alternarRequiere,
  conCosa,
  conTitulo,
  elegirCuando,
  elegirCumple,
  idDesdeNombre,
  idLibre,
  idsDe,
  moverRegla,
  moverRequiere,
  nombreDe,
  ponerRecompensa,
  ponerValorAccion,
  ponerValorCuando,
  ponerValorCumple,
  quitarAccion,
  quitarRegla,
  sinCosa,
  textoDe,
} from './estado.ts';
import { misionesCompletas, reglasCompletas, valoresPorDefectoCuando, valoresPorDefectoEntonces } from './construir.ts';
import { fraseDeMision, fraseDeRegla } from './frases.ts';
import { avisoDeCiclo, candidatasARequisito } from './misiones.ts';
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

/** Qué paso de qué misión está abierto ahora (también de a uno). */
interface AbiertoMision {
  misionId: string;
  paso: 'cumple' | 'datos' | 'antes' | 'premio';
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
  /** Reemplaza el nivel entero (al abrir uno guardado o al importar un archivo). */
  abrir(nivel: NivelEnConstruccion): void;
}

/** Los videos del catálogo de premios: son los que puede pedir `reproducir_video`. */
function videosDisponibles(): Recompensa[] {
  return RECOMPENSAS.filter((premio) => premio.tipo === 'video');
}

export function crearEditor(opciones: OpcionesEditor): Editor {
  let nivel = opciones.nivel;
  let abierto: Abierto | null = null;
  let abiertoMision: AbiertoMision | null = null;

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

  // ── Las misiones (prerrequisitos EN ORDEN y premio) ─────────────────────────

  function abrirMision(misionId: string, paso: AbiertoMision['paso']): void {
    if (abiertoMision !== null && abiertoMision.misionId === misionId && abiertoMision.paso === paso) {
      abiertoMision = null;
      pintar();
      return;
    }
    abiertoMision = { misionId, paso };
    pintar();
  }

  /** La pantalla de las misiones: la lista, el aviso de rueda y el "agregar". */
  function pintarMisiones(): HTMLElement {
    const panel = crearElemento('section', { clases: 'misiones' });
    panel.appendChild(crearElemento('h2', { clases: 'misiones__titulo', texto: '🚩 Las misiones' }));
    panel.appendChild(
      crearElemento('p', {
        clases: 'misiones__bajada',
        texto: 'Qué hay que lograr, en qué orden y qué se gana. El juego termina cuando se cumplen todas.',
      }),
    );

    const ciclo = avisoDeCiclo(nivel);
    if (ciclo !== null) {
      const avisoCiclo = crearElemento('div', { clases: 'aviso aviso--ciclo' });
      avisoCiclo.setAttribute('role', 'status');
      avisoCiclo.appendChild(
        crearElemento('p', { clases: 'aviso__titulo', texto: 'El orden de las misiones se muerde la cola' }),
      );
      avisoCiclo.appendChild(crearElemento('p', { clases: 'misiones__ciclo', texto: ciclo }));
      panel.appendChild(avisoCiclo);
    }

    const lista = crearElemento('div', { clases: 'misiones__lista' });
    if (nivel.misiones.length === 0) {
      lista.appendChild(
        crearElemento('p', {
          clases: 'misiones__vacio',
          texto: 'Todavía no hay misiones. Escribí una abajo (por ejemplo, «subir las maletas»).',
        }),
      );
    }
    nivel.misiones.forEach((mision, i) => lista.appendChild(pintarMision(mision, i)));
    panel.appendChild(lista);

    const agregar = crearElemento('div', { clases: 'agregar' });
    const entrada = crearElemento('input', { clases: 'campo' });
    entrada.type = 'text';
    entrada.placeholder = PISTA_DE_CATEGORIA['misiones'];
    entrada.setAttribute('aria-label', 'El nombre de la misión nueva');
    const sumar = (): void => {
      const texto = entrada.value;
      if (texto.trim() === '') return;
      entrada.value = '';
      const nuevoId = idLibre(idsDe(nivel, 'misiones'), idDesdeNombre(texto.trim()));
      actualizar((actual) => conCosa(actual, 'misiones', texto));
      // Se abre sola la elección de cómo se cumple, como en una regla.
      abiertoMision = { misionId: nuevoId, paso: 'cumple' };
      pintar();
    };
    entrada.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') sumar();
    });
    agregar.appendChild(entrada);
    agregar.appendChild(
      crearBoton({ etiqueta: 'Agregar misión', pictograma: '＋', clasesExtra: 'agregar__boton', alElegir: sumar }),
    );
    panel.appendChild(agregar);
    return panel;
  }

  /** Una misión: su frase en castellano, sus cuatro pasos grandes y su borrar. */
  function pintarMision(mision: MisionEditor, indice: number): HTMLElement {
    const tarjeta = crearElemento('section', { clases: 'mision' });
    tarjeta.setAttribute('data-mision', mision.id);

    tarjeta.appendChild(
      crearElemento('h3', { clases: 'mision__titulo', texto: `Misión ${indice + 1}: ${mision.nombre}` }),
    );
    tarjeta.appendChild(crearElemento('p', { clases: 'mision__frase', texto: fraseDeMision(nivel, mision) }));

    const pasos = crearElemento('div', { clases: 'mision__pasos' });
    pasos.appendChild(pintarPasoCumple(mision));
    if (mision.cumpleId !== null) pasos.appendChild(pintarPasoDatos(mision));
    pasos.appendChild(pintarPasoAntes(mision));
    pasos.appendChild(pintarPasoPremio(mision));
    tarjeta.appendChild(pasos);

    if (abiertoMision !== null && abiertoMision.misionId === mision.id) {
      tarjeta.appendChild(pintarPanelMision(mision));
    }

    const pie = crearElemento('div', { clases: 'mision__pie' });
    pie.appendChild(
      crearBoton({
        etiqueta: 'Borrar la misión',
        pictograma: '🗑',
        clasesExtra: 'mision__borrar',
        alElegir: () => {
          abiertoMision = null;
          actualizar((actual) => sinCosa(actual, 'misiones', mision.id));
        },
      }),
    );
    tarjeta.appendChild(pie);
    return tarjeta;
  }

  function pintarPasoCumple(mision: MisionEditor): HTMLElement {
    const plantilla = plantillaCuando(mision.cumpleId);
    const texto = plantilla === null ? 'Elegir cómo se cumple' : `Cómo se cumple: ${plantilla.etiqueta}`;
    const activo = abiertoMision !== null && abiertoMision.misionId === mision.id && abiertoMision.paso === 'cumple';
    return opcion(texto, activo, () => abrirMision(mision.id, 'cumple'), '1️⃣');
  }

  function pintarPasoDatos(mision: MisionEditor): HTMLElement {
    const plantilla = plantillaCuando(mision.cumpleId);
    let texto = 'Elegir de qué se trata';
    if (plantilla !== null) {
      const elegido = textoDe(mision.cumpleValores, plantilla.quien.clave);
      texto = elegido === '' ? `De qué se trata: ${plantilla.quien.etiqueta}` : `De qué se trata: ${nombreDe(nivel, elegido)}`;
    }
    const activo = abiertoMision !== null && abiertoMision.misionId === mision.id && abiertoMision.paso === 'datos';
    return opcion(texto, activo, () => abrirMision(mision.id, 'datos'), '2️⃣');
  }

  function pintarPasoAntes(mision: MisionEditor): HTMLElement {
    const cuantas = mision.requiere.length;
    const texto =
      cuantas === 0 ? 'Elegir qué va antes' : `Antes: ${cuantas === 1 ? '1 misión' : `${cuantas} misiones`}`;
    const activo = abiertoMision !== null && abiertoMision.misionId === mision.id && abiertoMision.paso === 'antes';
    return opcion(texto, activo, () => abrirMision(mision.id, 'antes'), '3️⃣');
  }

  function pintarPasoPremio(mision: MisionEditor): HTMLElement {
    const texto = mision.recompensa === null ? 'Elegir el premio' : 'Premio elegido';
    const activo = abiertoMision !== null && abiertoMision.misionId === mision.id && abiertoMision.paso === 'premio';
    return opcion(texto, activo, () => abrirMision(mision.id, 'premio'), '4️⃣');
  }

  function pintarPanelMision(mision: MisionEditor): HTMLElement {
    const paso = abiertoMision === null ? 'cumple' : abiertoMision.paso;
    if (paso === 'datos') return pintarPanelDatosMision(mision);
    if (paso === 'antes') return pintarPanelAntesMision(mision);
    if (paso === 'premio') return pintarPanelPremioMision(mision);
    return pintarPanelCumpleMision(mision);
  }

  function pintarPanelCumpleMision(mision: MisionEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    panel.appendChild(crearElemento('p', { clases: 'panel__titulo', texto: '¿Cuándo se cumple?' }));
    const opciones = crearElemento('div', { clases: 'opciones' });
    for (const plantilla of PLANTILLAS_CUANDO) {
      opciones.appendChild(
        opcion(
          plantilla.etiqueta,
          mision.cumpleId === plantilla.id,
          () => {
            abiertoMision = { misionId: mision.id, paso: 'datos' };
            actualizar((actual) =>
              elegirCumple(actual, mision.id, plantilla.id, valoresPorDefectoCuando(plantilla.id)),
            );
          },
          plantilla.pictograma,
        ),
      );
    }
    panel.appendChild(opciones);
    return panel;
  }

  function pintarPanelDatosMision(mision: MisionEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    const plantilla = plantillaCuando(mision.cumpleId);
    if (plantilla === null) return panel;
    panel.appendChild(crearElemento('p', { clases: 'panel__titulo', texto: '¿De qué se trata?' }));
    panel.appendChild(
      pintarPregunta(
        plantilla.quien,
        mision.cumpleValores[plantilla.quien.clave],
        (valor) => actualizar((actual) => ponerValorCumple(actual, mision.id, plantilla.quien.clave, valor)),
        '',
      ),
    );
    for (const extra of plantilla.extras) {
      panel.appendChild(
        pintarPregunta(
          extra,
          mision.cumpleValores[extra.clave],
          (valor) => actualizar((actual) => ponerValorCumple(actual, mision.id, extra.clave, valor)),
          '',
        ),
      );
    }
    return panel;
  }

  function pintarPanelAntesMision(mision: MisionEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    panel.appendChild(
      crearElemento('p', { clases: 'panel__titulo', texto: '¿Qué va antes? (el orden manda)' }),
    );

    const elegidas = crearElemento('div', { clases: 'antes' });
    mision.requiere.forEach((id, i) => {
      const fila = crearElemento('div', { clases: 'antes__fila' });
      fila.appendChild(crearElemento('span', { clases: 'antes__numero', texto: `${i + 1}.` }));
      fila.appendChild(crearElemento('span', { clases: 'antes__nombre', texto: nombreDe(nivel, id) }));
      fila.appendChild(
        crearBoton({
          etiqueta: 'Subir',
          pictograma: '⬆',
          nombreAccesible: `Subir ${nombreDe(nivel, id)}`,
          clasesExtra: 'antes__flecha',
          alElegir: () => actualizar((actual) => moverRequiere(actual, mision.id, id, -1)),
        }),
      );
      fila.appendChild(
        crearBoton({
          etiqueta: 'Bajar',
          pictograma: '⬇',
          nombreAccesible: `Bajar ${nombreDe(nivel, id)}`,
          clasesExtra: 'antes__flecha',
          alElegir: () => actualizar((actual) => moverRequiere(actual, mision.id, id, 1)),
        }),
      );
      fila.appendChild(
        crearBoton({
          etiqueta: 'Sacar',
          pictograma: '✕',
          nombreAccesible: `Sacar ${nombreDe(nivel, id)} de lo que va antes`,
          clasesExtra: 'antes__sacar',
          alElegir: () => actualizar((actual) => alternarRequiere(actual, mision.id, id)),
        }),
      );
      elegidas.appendChild(fila);
    });
    if (mision.requiere.length === 0) {
      elegidas.appendChild(
        crearElemento('p', {
          clases: 'antes__vacio',
          texto: 'Nada antes: esta misión se puede empezar desde el arranque.',
        }),
      );
    }
    panel.appendChild(elegidas);

    const candidatas = candidatasARequisito(nivel, mision.id);
    if (candidatas.length > 0) {
      panel.appendChild(crearElemento('p', { clases: 'pregunta__titulo', texto: 'Tocá una misión para ponerla antes' }));
      const fila = crearElemento('div', { clases: 'opciones' });
      for (const candidata of candidatas) {
        const yaEsta = mision.requiere.indexOf(candidata.id) !== -1;
        fila.appendChild(
          opcion(
            candidata.nombre,
            yaEsta,
            () => actualizar((actual) => alternarRequiere(actual, mision.id, candidata.id)),
            yaEsta ? '✅' : '＋',
          ),
        );
      }
      panel.appendChild(fila);
    } else {
      panel.appendChild(
        crearElemento('p', { clases: 'pregunta__nota', texto: 'Todavía no hay otra misión para poner antes.' }),
      );
    }
    return panel;
  }

  function pintarPanelPremioMision(mision: MisionEditor): HTMLElement {
    const panel = crearElemento('div', { clases: 'panel' });
    panel.appendChild(crearElemento('p', { clases: 'panel__titulo', texto: '¿Qué se gana al cumplirla?' }));
    panel.appendChild(
      crearSelectorDeRecompensas({
        recompensas: videosDisponibles(),
        elegidoId: mision.recompensa,
        etiqueta: 'Ver los videos',
        titulo: '¿Qué video se gana?',
        subtitulo: 'Tocá el premio de esta misión',
        alElegir: (premio) => actualizar((actual) => ponerRecompensa(actual, mision.id, premio.id)),
      }).elemento,
    );
    panel.appendChild(
      crearBoton({
        etiqueta: 'Sin premio',
        pictograma: '🚫',
        clasesExtra: 'mision__sin-premio',
        alElegir: () => actualizar((actual) => ponerRecompensa(actual, mision.id, null)),
      }),
    );
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
    raiz.appendChild(pintarMisiones());

    const revision = revisar(nivel);
    const barra = crearElemento('div', { clases: 'barra' });
    const listas = reglasCompletas(nivel);
    barra.appendChild(
      crearElemento('p', {
        clases: 'barra__cuenta',
        texto:
          nivel.reglas.length === 0
            ? 'Todavía no hay reglas'
            : `${listas} de ${nivel.reglas.length} reglas listas · ${misionesCompletas(nivel)} de ${nivel.misiones.length} misiones`,
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

  function abrirNivel(nuevo: NivelEnConstruccion): void {
    nivel = nuevo;
    abierto = null;
    abiertoMision = null;
    pintar();
  }

  return {
    elemento: raiz,
    pintar,
    nivel: () => nivel,
    actualizar,
    abrir: abrirNivel,
  };
}
