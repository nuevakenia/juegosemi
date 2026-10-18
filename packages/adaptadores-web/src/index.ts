/**
 * @juegosemi/adaptadores-web — implementaciones de los puertos para el navegador
 * (y para el WebView de Android, que es el same motor).
 *
 * El APK usa estos mismos adaptadores; cuando algo no se puede hacer en el
 * WebView (por ejemplo reproducir H.265 en un Huawei viejo), se escribe un
 * adaptador NATIVO que cumple el mismo puerto y se elige al arrancar. El juego
 * no se entera.
 */
export { crearVideoHtml, type OpcionesVideoHtml } from './video-html.ts';
export { crearAudioWeb, type AudioWeb } from './audio-webaudio.ts';
export { crearEntradaTactil, type OpcionesEntradaTactil } from './entrada-tactil.ts';
export {
  crearGestosTactiles,
  type GestosTactiles,
  type OpcionesGestosTactiles,
} from './gestos.ts';
export { crearAlmacenamientoLocal, crearReloj, crearPantalla, crearPlataforma } from './plataforma.ts';
