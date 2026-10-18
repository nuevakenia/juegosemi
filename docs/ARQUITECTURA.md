# Arquitectura y decisiones (juegosemi)

Documento de referencia del proyecto. Todo lo que dice acá está **medido en este
host** (CachyOS, 2026-10-17) o verificado en navegador real, no copiado de un blog.

---

## 1. El problema, en términos técnicos

Lo que define la arquitectura no es "hacer un juego", son cinco restricciones duras:

| Restricción real | Decisión técnica que obliga |
|---|---|
| Tablet Huawei **sin Play Services**; también celulares Samsung comunes | Nada de GMS/Firebase. APK propio (envoltorio web), no TWA ni Play. |
| **No** queremos emulador de Android | El juego se ejecuta y se prueba en el navegador del PC. El APK es sólo el empaque. |
| El agente de IA **no puede usar editores gráficos** | Motores totalmente "por código/datos": escenas, personajes y animaciones se describen en JSON/TS. Nada de Godot, Defold, Rive, Spine. |
| Android viejo y hardware modesto (4 GB) | Target ES2019, bundles chicos, render con fallback a WebGL1, pasos de simulación fijos. |
| Tiene que servir para **muchos** juegos, no uno | Monorepo con un motor por puertos: el juego es una app que se enchufa. |

Y una restricción de producto que manda sobre el código:

> **Regla de oro:** cuando Emiliano se equivoca no hay feedback negativo. La pieza
> vuelve a su lugar en silencio. El único refuerzo fuerte es el acierto.

---

## 2. El stack, con números

| Pieza | Elegido | Por qué (medido) |
|---|---|---|
| Lenguaje | **TypeScript 7**, target **ES2019**, `strict` + `noUncheckedIndexedAccess` | Tipos para que el agente no invente APIs; ES2019 por WebView viejo. |
| Empaquetado | **esbuild 0.28** (bundle + serve) | Un binario, milisegundos. Sin webpack. |
| Pruebas | **Vitest 5** (+ `jsdom` sólo donde hay DOM) | 149 tests en **~650 ms**. Rápido = se corre siempre. |
| Render 2D | **PixiJS 8.22** | El más liviano de los grandes y el **único con fallback WebGL2 → WebGL1** (clave en un WebView de 2019). |
| 3D (opcional, después) | **three 0.186** en un paquete aparte | 529 KB / 131 KB gzip, y no ensucia el 2D. |
| Interfaz | **DOM/CSS** (no canvas) | Botones y menús accesibles, responsivos y gratis de batería. |
| APK | **Capacitor 8** (`minSdk 24` = Android 7) | Web + envoltorio; **sin GMS** (verificado). |
| Monorepo | **npm workspaces** | Ya viene con node 26. Sin pnpm/yarn/bun que instalar. |

### Bundles medidos (esbuild, `--minify --target=es2019`, gzip)

| Librería | min | gzip |
|---|---|---|
| **PixiJS 8.22** | 599 KB | **176 KB** |
| three 0.186 | 529 KB | 131 KB |
| Phaser 4.2 | 1357 KB | 360 KB |
| Babylon.js 9.31 | 1624 KB | 385 KB |

### Descartados y por qué

- **Phaser 4**: 1,36 MB y **sus tipos no compilan con TS 7**.
- **Babylon.js** (para 2D) y **three** (para 2D): mucho peso para lo que necesitamos.
- **Godot / Defold**: editores gráficos; el proyecto se lleva por código.
- **Rive / Spine / DragonBones**: editores GUI, licencias o no corren en Linux.
- **TWA**: depende de que Chrome esté instalado y actualizado — en la tablet Huawei, no.
- **React/Lit** para la UI: el DOM plano alcanza y pesa cero.

---

## 3. Arquitectura: todo entra por puertos

La regla es una sola: **el motor no sabe dónde corre**. Sabe de entidades, tiempos y
eventos. Todo lo demás entra por un contrato (`packages/puertos`):

    apps/*                 juegos y menú (conocen todo, pero no se repiten)
      │
      ├── packages/motor           escena · ticker · arrastre · timeline · juego
      │      │                     (NO importa PixiJS, ni DOM, ni Android)
      │      └── packages/puertos  ← la frontera
      │
      ├── packages/logica          eventos · reglas (si→entonces) · mundo · misiones
      │                            (tampoco conoce el render: avisa por Efectos)
      ├── packages/render-pixi     implementa AdaptadorRender
      ├── packages/adaptadores-web implementa entrada, audio, video, pantalla,
      │                            almacenamiento y plataforma
      └── packages/contenido · personajes · ui   (datos y piezas reutilizables)

Los puertos definidos hoy:

- `Reloj` — el tiempo, inyectable (los tests no esperan de verdad).
- `PuertoEntrada` — dedo/mouse hoy; mañana micrófono, giroscopio o volante.
- `PuertoVideo` — reproducir un video y saber de verdad si decodifica.
- `PuertoAudio` — tonos y sonidos.
- `PuertoPantalla` — tamaño, densidad, safe-area.
- `PuertoAlmacenamiento` — guardar progreso.
- `PuertoPlataforma` — qué sabe hacer el dispositivo (WebGL, códecs, Chromium).
- `AdaptadorRender` — dibujar la escena.

**Agregar una capacidad = escribir un adaptador.** No se toca ni el motor ni el juego.
Por eso el micrófono, el giroscopio, la cámara o un volante por USB pueden entrar
después sin refactor: ya hay dónde enchufarlos.

Dos decisiones que evitan bugs caros:

- **Ticker con pasos fijos (1/60 s) y tope de 5 por vuelta.** En una tablet lenta un
  frame puede tardar 200 ms; con delta libre la física se descontrola, y al volver
  del segundo plano se dispararía "efecto metralleta". Con pasos fijos, la lógica
  avanza igual en cualquier aparato.
- **Timeline declarativo en datos.** Para armar la escena "el Caco va al mecánico y
  se encuentra a la frutilla" no se escribe código: se escribe una lista de
  *cuándo/qué/si pasa esto*. Es lo que permite que un agente arme escenas sin editor.

---

## 4. Un repo, dos formas de mirarlo

### El combo (lo que se instala)
`dist/` queda así y **el APK es exactamente esto adentro**:

    dist/index.html           ← el menú (apps/estudio): una tarjeta por juego
    dist/juegos/autos/…       ← el juego, autocontenido

Se abre la app y aparece el menú; se toca una tarjeta y se entra al juego. Cada juego
es su propia página: si uno falla, el menú sigue vivo.

### Cada app por separado (para desarrollar)
`node tools/dev.mjs apps/juego-autos` levanta un servidor con recarga y se prueba en
el navegador del PC. Sin emulador, sin Android Studio, sin esperar un build de Gradle.

Para ver los juegos desde el celular o la tablet en la misma red:
`node tools/dev.mjs apps/juego-autos --host=0.0.0.0`.

---

## 5. El ciclo de trabajo (esto es lo importante para el desarrollo autónomo)

    bash tools/verificar.sh          # 1. tests  2. tipos  3. build  4. sin Google
    bash tools/verificar.sh --apk    # y además 5. compila el APK

Reglas del ciclo, y por qué:

1. **Primero la prueba, después el código.** Cada pieza tiene su test ANTES o junto
   con la implementación, y los tests son de comportamiento ("al soltar sobre el auto
   correcto, la persona queda resuelta"), no de implementación.
2. **Lo que se puede probar sin navegador, se prueba sin navegador.** Reglas del juego
   y reparto en pantalla son funciones puras: corren en milisegundos.
3. **La suite es el contrato de integridad.** Si algo se rompe al agregar una función,
   la suite lo dice y hay que decidir: se arregla el código o se cambia el test a
   propósito (nunca "para que pase").
4. **Verificación que no miente.** Una suite verde no prueba nada por sí sola. Ya nos
   pasó: 96 tests verdes y un `carasBrutas` inexistente que explotaba en runtime
   porque nadie ejecutaba ese catálogo. Ahora hay tests que *recorren los datos reales*.
5. **El build avisa.** esbuild marcó como warning un campo `tiempo` que pisaba al
   método `tiempo()` — un bug que TypeScript no ve. Los warnings del build se leen.

---

## 6. Contenido, arte y video

- **Sin arte, el juego ya se juega.** Las piezas sin textura salen como rectángulo de
  color y su **nombre dibujado encima**. Emiliano identifica palabras: puede jugar hoy,
  y cuando lleguen las fotos se registran como textura y el nombre se puede sacar.
- **Las fotos de los autos y las caras de la familia** entran como assets recortados
  (`.png` / `.webp`) en `apps/juego-autos/assets/`. El contenido real vive en
  `packages/contenido/data/familia.json` (hoy: papá, mamá, el Caco, la tía, el tío y
  Emiliano, cada uno con su auto y su frase de acierto).
- **Personajes articulados por datos**: plantilla de cuerpo + rasgos de cara + paleta +
  tabla de visemas (boca) → el mismo rig sirve para todos los personajes. Es el sistema
  tipo Mii / South Park que se pidió, y sale de `packages/personajes`.
- **Video**: siempre **H.264/AVC** para lo importante, con verificación de frames
  reales al abrir (`videoWidth > 0` y `currentTime` avanzando). **H.265 no es confiable**
  en la tablet: su WebView es Chromium 99 y el soporte llegó en Chromium 107.
  Medido en navegador real: H.264 decodifica; H.265 reporta "reproduce" pero entrega
  0×0 (el `<video>` del WebView **miente**, por eso se verifica).
- **Sin internet, igual.** Todo el contenido crítico viaja dentro del APK.

---

## 7. Trampas medidas (para no volver a pisarlas)

1. **El Java del sistema no sirve para Gradle.** Con Java 26, Gradle 8.14.3 muere con
   `Unsupported class file major version 70`. Hay que usar el **JDK 21** de
   `~/.hermes/tools/jdk-21` (`JAVA_HOME`). `tools/compilar-apk.sh` ya lo hace.
2. **`cap add android` antes de que exista `dist/` no deja el proyecto sano**: no genera
   `android/capacitor.settings.gradle` y Gradle falla. Solución: `npx cap sync android`
   (que es lo que se corre, no `cap copy`).
3. **Un campo de clase con el nombre de un método lo pisa**: `private tiempo = 0` +
   `tiempo()` rompía el acumulador (lo cazó esbuild, no TypeScript).
4. **Al soltar, hay que filtrar el destino.** Una pieza desvaneciéndose encima de un
   auto "robaba" el destino del arrastre siguiente. Se arregló en el motor con
   `sePuedeSoltar`, no en el juego.
5. **`new Text({text, style})` no compila** con los tipos de Pixi 8 en TS 7: se crea el
   `Text` y se asignan `.text` / `.style`.
6. **Los assets locales se sirven por `WebViewAssetLoader`** (`https://appassets…`), no
   por `file://`, o el WebView los bloquea.
7. **Un puntero sintético no se puede capturar**: `setPointerCapture` falla en pruebas
   automatizadas. Va en `try/catch` (el dedo real sí captura).

---

## 8. Verificación del APK (lo que se comprueba en cada build)

- `minSdk 24`, `targetSdk 36`, permiso único `INTERNET`.
- **Cero** librerías `gms` / `firebase` / `play` adentro (`unzip -l | grep`).
- El classpath de `google-services` se sacó del template de Capacitor: así el APK no
  puede arrastrar Google por accidente.
- Peso del combo: **~0,6 MB** de web dentro de un APK de **~4,1 MB**.

---

## 9. Próximos pasos

1. Medición en la tablet real con la sonda (`juegosemi-sonda.apk`): WebGL1/2, códecs y
   Chromium efectivos. Define si el render necesita bajar a WebGL1 y si el video va por
   `<video>` o por reproductor nativo.
2. Fotos de los autos y caras de la familia al juego de los autos.
3. ~~Taller de personajes~~ **HECHO** (mergeado y en el APK).
4. Lector de videos (H.264) con interfaz grande, sin publicidad y sin salir de la app.
5. Orquestación por timeline: la primera escena con video (llegar a la casa de la tía y
   que aparezca el video del cerro).
6. Puertos nuevos cuando hagan falta: micrófono (reconocer palabras y gatillar),
   giroscopio, cámara.
7. ~~Lógica para crear modos de juego~~ **HECHO** (`packages/logica`, ver abajo).
8. Lo que sigue del sistema de lógica: gestos tipo QTE, editor de niveles en la tablet,
   el episodio del viaje y las recompensas dinámicas — el plan está en
   `docs/DISENO-LOGICA.md`.

## La lógica de los juegos (`packages/logica`)

Arriba del motor, y sin conocer el render, un juego se describe en DATOS:

    mundo     qué recuerda (variables, contadores, interruptores)
    reglas    si <condición> → <acciones>, evaluadas cada paso y ENCADENADAS
    misiones  qué hay que lograr, con prerrequisitos (el orden manda)

Lo que toca pantalla, sonido o video se avisa por `Efectos.aplicar(...)`: por eso toda
la lógica se prueba sin navegador. El nivel de ejemplo es
`packages/logica/data/viaje-casa-tia.json` (subir las maletas → girar la manivela →
llegar a la casa → sale el video del premio) y se juega entero en `episodio.test.ts`.
El **editor de la tablet** va a escribir exactamente este mismo formato.
