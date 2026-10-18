// Punto de entrada de @juegosemi/ui.
//
// Expo revisa aqui los componentes de interfaz en DOM/CSS: botones y tarjetas
// grandes, menu y armazon de pantalla. Todo se construye con elementos nativos
// y sin dependencias externas.
//
// El CSS viaja aparte en `@juegosemi/ui/estilos.css` para que cada app lo
// importe una sola vez.

export { crearBoton } from './boton';
export type { OpcionesBoton } from './boton';

export { crearTarjeta } from './tarjeta';
export type { OpcionesTarjeta } from './tarjeta';

export { crearMenu } from './menu';
export type { OpcionMenu, OpcionesMenu } from './menu';

export { crearPantalla } from './pantalla';
export type { OpcionesPantalla } from './pantalla';

export { crearBarraProgreso } from './barra';
export type { BarraProgreso, OpcionesBarra } from './barra';

export { crearElemento, idUnico, TOQUE_MINIMO_PX, unirClases } from './accesibilidad';
export type { OpcionesElemento } from './accesibilidad';
