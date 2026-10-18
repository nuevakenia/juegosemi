/**
 * @juegosemi/gestos — el reconocedor de gestos tipo QTE, puro y sin navegador.
 *
 * Lee los eventos de la entrada táctil (los mismos `pulsar/mover/soltar` que ya
 * emite `@juegosemi/adaptadores-web`) y avisa cuándo se completa lo pedido. El
 * tiempo entra por parámetro, así que se prueba entero con vitest, sin DOM.
 *
 * El adaptador que lo enchufa a la pantalla vive en `@juegosemi/adaptadores-web`
 * (`crearGestosTactiles`); este paquete sólo decide.
 */
export { Reconocedor, normalizarPedido } from './reconocedor.ts';
export {
  VUELTA,
  acotar01,
  anguloDe,
  avanceEnDireccion,
  distancia,
  ejeDeDireccion,
  normalizarAngulo,
} from './geometria.ts';
