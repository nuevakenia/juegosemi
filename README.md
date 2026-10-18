# juegosemi

Juegos y material audiovisual **hechos a medida** para Emiliano (11 años): autista,
epilepsia, daño neurológico por una hipoglicemia severa al nacer. Identifica letras
y palabras (no lee fluido), tiene muy buena memoria, se concentra mucho en lo que le
gusta, y se apoya en frases cortas ("quiero galleta", "se cayó el vaso de vidrio").

El objetivo no es "un juego": es un **motor chico con reglas claras** con el que se
arman muchos juegos, personajes y videos, **sin editor gráfico** (todo es texto y
código) para poder trabajarlo con un agente de IA de forma autónoma.

## Reglas que no se negocian

1. **Nunca feedback negativo.** Si Emiliano se equivoca, no pasa nada: la pieza
   vuelve sola a su lugar, no hay sonido de error, no dice "no", no se pierde nada.
   El único festejo es el **acierto** (frase + sonido + juice).
2. **Sin servicios de Google.** La tablet es Huawei sin Play Services. El APK no
   arrastra nada de GMS/Firebase (está verificado en cada build).
3. **Se prueba en el navegador, nunca en emulador.** El APK es un envoltorio del
   paquete web.
4. **Todo lo de plataforma entra por puertos.** El motor no conoce el navegador,
   ni Android, ni PixiJS. Agregar una capacidad (micrófono, giroscopio, volante)
   es escribir un adaptador nuevo, no tocar el juego.
5. **ES2019 y sin dependencias de más.** Nada de `??=`, `.at()`, `structuredClone`:
   apuntamos a Android viejo. Menos código de terceros = menos cosas que se rompen.

## Arranque rápido

    npm install
    npm test                          # la suite completa
    node tools/dev.mjs apps/juego-autos   # probar en el navegador (recarga sola)
    node tools/build.mjs combo             # armar dist/ (menú + juegos)
    bash tools/compilar-apk.sh             # APK (necesita el JDK 21: ver docs/)
    bash tools/verificar.sh --apk          # tests + tipos + build + APK, todo junto

## Cómo está armado

    packages/puertos          contratos: reloj, entrada, video, audio, pantalla,
                              almacenamiento, plataforma, adaptador de render
    packages/motor            escena, ticker de pasos fijos, arrastre, timeline,
                              bucle del juego. NO sabe de qué plataforma corre
    packages/logica           un juego descrito en datos: mundo con memoria (variables,
                              contadores, interruptores), eventos, reglas "si esto →
                              entonces esto" con encadenamiento, misiones con
                              prerrequisitos y su validador. Se engancha al motor con
                              `Puente` (escena, arrastre, gestos, timeline)
    packages/render-pixi      el único lugar que conoce PixiJS
    packages/adaptadores-web  lo que existe en el navegador/WebView: <video>, audio,
                              dedo/mouse, pantalla, plataforma
    packages/contenido        los datos (quién va con qué auto) y su validador
    packages/personajes       personajes articulados por datos (cuerpo + cara +
                              boca que habla), estilo South Park / Mii
    packages/ui               piezas de interfaz en DOM/CSS (botón grande, menú)
    apps/juego-autos          el primer juego: llevar a cada persona a su auto
    apps/estudio              el menú que abre Emiliano, con un botón por juego

Los detalles y los números medidos están en `docs/ARQUITECTURA.md`.

## Estado

Andamiaje completo y funcionando: el juego de los autos se juega de punta a punta
en el navegador, con el APK compilando sin nada de Google. Falta lo que se apoya en
material real: las fotos de los autos y las caras de la familia.
