/**
 * @juegosemi/personajes — personajes articulados 2D (tipo Mii / South Park).
 *
 * Definidos 100% por DATOS: una plantilla de rig (la jerarquía de piezas), una
 * paleta (los colores por rol), unas poses y una tabla de boca. Nada de arte
 * horneado ni editores gráficos: el contenido se escribe en JSON.
 *
 * Los datos de verdad viven en `data/` y entran por `./catalogo.ts`, que los
 * valida al cargar. El resto de los módulos trabaja con ellos:
 *
 *   - `matriz.ts`   — la matemática del hueso (2x3 afín).
 *   - `color.ts`    — hex ↔ número y sombreado barato.
 *   - `tipo.ts`     — el contrato de los JSON.
 *   - `validar.ts`  — el guardián de los JSON.
 *   - `rig.ts`      — arma las piezas: matrices de mundo, color, orden de dibujo.
 *   - `pose.ts`     — poses, mezcla e interpolación de animaciones.
 *   - `boca.ts`     — la boca de ventrílocuo (visemas).
 *   - `cara.ts`     — arma la cara eligiendo del catálogo, como en los Miis.
 */

// Matemática y color
export {
  identidad,
  multiplicar,
  trasladar,
  rotar,
  escalar,
  aplicar,
  rotacion,
  largoX,
  largoY,
  aRadianes,
  aGrados,
  casiIgual,
  puntoCasiIgual,
  type Matriz,
  type Punto,
} from './matriz.ts';
export {
  esHexValido,
  colorANumero,
  numeroAColor,
  aRgb,
  deRgb,
  mezclarColores,
  aclarar,
  oscurecer,
  contornoDe,
  type ColorRgb,
} from './color.ts';

// El contrato de los datos
export type {
  Tamano,
  Desplazamiento,
  PiezaRig,
  PlantillaRig,
  RasgoPieza,
  PersonajeDatos,
  Paleta,
  Pose,
  Fotograma,
  Animacion,
  Visema,
  TablaVisemas,
  CatalogoCaras,
  ResultadoValidacion,
} from './tipo.ts';

// El guardián
export {
  validarPlantilla,
  validarPersonaje,
  validarCoherenciaPersonaje,
  validarPaleta,
  validarAnimacion,
  validarTablaVisemas,
  validarCatalogoCaras,
} from './validar.ts';

// El rig
export { Rig, armar, type PiezaResuelta, type OpcionesRig, type OpcionesDibujo } from './rig.ts';

// Poses
export { poseVacia, mezclarPoses, tramoEn, poseEnTiempo, Animador } from './pose.ts';

// Boca de ventrílocuo
export {
  Boca,
  bloquesDeTexto,
  visemaPorId,
  visemaDeLetra,
  visemaCerrado,
  letraNormalizada,
  poseDeVisema,
  texturasDeVisema,
  type BloqueVisema,
  type OpcionesBoca,
} from './boca.ts';

// Cara
export {
  rasgosDeCara,
  elegirDeCatalogo,
  tieneTextura,
  PIEZAS_DE_CARA_POR_DEFECTO,
  type OpcionesCara,
  type PiezasDeCara,
} from './cara.ts';

// El catálogo de datos reales
export {
  problemasDeDatos,
  datosSanos,
  contenido,
  plantillas,
  plantillaPorId,
  paletas,
  paletaPorId,
  animaciones,
  animacionPorId,
  animacionesDePersonaje,
  catalogosDeCaras,
  catalogoDeCarasPorId,
  personajes,
  personajePorId,
  tablaVisemas,
  armarPersonaje,
  armarPlantilla,
  type Catalogo,
} from './catalogo.ts';
