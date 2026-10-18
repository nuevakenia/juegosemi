# Lógica para crear modos de juego (diseño)

Cómo pasar de "un juego hecho a mano" a "un sistema donde se arman juegos nuevos
—incluso desde la tablet— sin tocar el motor".

## 0. Qué existe hoy y qué falta (medido en el código, no en la cabeza)

| Ya existe | Dónde | Sirve para |
|---|---|---|
| Escena con entidades y hit test | `packages/motor/escena.ts` | qué hay en pantalla y quién está bajo el dedo |
| Arrastre con filtro de destino | `packages/motor/arrastre.ts` | el drag & drop |
| Ticker de pasos fijos (1/60) | `packages/motor/ticker.ts` | que la lógica no dependa de los FPS |
| Timeline declarativo (tiempo + condiciones NOMBRADAS) | `packages/motor/timeline.ts` | secuencias: "a los 2 s pasa esto", "mientras esté puesto esto, baila" |
| Puertos (entrada, video, audio, pantalla, almacenamiento, plataforma, render) | `packages/puertos` | todo lo de plataforma, desacoplado |
| Entrada táctil → eventos `pulsar/mover/soltar` | `packages/adaptadores-web` | el dedo |
| Personajes articulados por datos | `packages/personajes` | quien se mueve y habla |
| Contenido validado con mensajes que nombran el error | `packages/contenido` | datos sanos, sin reventar en mitad del juego |

**Lo que falta** (y es lo que pide este diseño):

1. **Estado del mundo con memoria**: hoy las condiciones del timeline son banderas
   con nombre. No hay variables (número/sí-no/texto), contadores, ni estado de los
   objetos ("la puerta está abierta", "el interruptor 80 está activo").
2. **Reglas que reaccionen a lo que pasa**: hoy se dispara por tiempo o por bandera;
   falta "si soltó la maleta sobre el auto → entonces se sube y suena".
3. **Gestos (acciones tipo QTE)**: hoy sólo hay pulsar/mover/soltar. Falta
   toque-repetido (inflar un globo), mantener, arrastrar en círculo (la manivela),
   dirección (la palanca), sacudir, y a futuro la palabra por micrófono.
4. **Misiones con prerrequisitos**: "para terminar hay que haber hecho A, B y C, en
   ese orden" — el "abecedario completo antes de llegar a la Z".
5. **Un editor en la tablet** que produzca esos datos tocando botones grandes.

## 1. La idea

Todo juego nuevo se describe como **datos** (JSON), en cuatro piezas que se pueden
combinar:

    ESCENARIO   qué se ve y qué hay (entidades, fondos, zonas)
    MUNDO       qué recuerda el juego (variables, contadores, estado de objetos)
    REGLAS      si pasa ESTO → pasa ESTO (eventos → acciones)
    MISIONES    qué hay que lograr, en qué orden, y qué se gana

Y encima, dos cosas ya resueltas en el proyecto: el **timeline** para lo temporal y
los **puertos** para lo del dispositivo.

Regla de oro del diseño: **el editor no inventa nada nuevo: escribe el mismo JSON que
se puede escribir a mano o generar por código.** Por eso "crear en la tablet" y
"extender en código" no son dos sistemas, son dos formas de tocar el mismo archivo.

## 2. Eventos: el mundo avisa

Cada cosa que pasa entra como un evento. Son pocos y todos con nombre y datos:

    entidad_soltada   { entidad, destino, x, y }     se soltó una pieza sobre otra
    entidad_tocada    { entidad, x, y }
    zona_entrada      { zona, entidad }              algo llegó a una zona
    gesto_completado  { gesto, objetivo, veces }     un QTE se completó
    variable_cambiada { variable, valor }
    objeto_activado   { objeto }                     se prendió un interruptor
    paso_completado   { secuencia, paso }
    mision_cumplida   { mision }

Los eventos los emiten las piezas que ya existen (arrastre, entrada táctil, timeline)
y los adaptadores nuevos (gestos). El motor no cambia: sólo se conecta.

## 3. Reglas: puertas lógicas legibles

Una regla es `si <condición> → <acciones>`, y se evalúa en orden una vez por paso del
ticker. El encadenamiento es la clave: lo que hace una regla puede cumplir la
condición de la siguiente, y así el juego "abre puertas" por sí solo.

```json
{
  "reglas": [
    {
      "id": "subir-maleta",
      "si": { "evento": "entidad_soltada", "destino": "auto" },
      "hacer": ["ocultar($entidad)", "sumar(maletas_en_auto, 1)", "sonar(bien)"]
    },
    {
      "id": "auto-listo",
      "si": { "y": [ { "contador": "maletas_en_auto", "es": 3 } ] },
      "hacer": ["activar(interruptor-viaje)", "decir(familia, \"¡vamos!\")"]
    },
    {
      "id": "arrancar-manivela",
      "si": { "y": [ { "activo": "interruptor-viaje" } ] },
      "hacer": ["mostrar(palanca)", "pedir_gesto(circulo, 3, palanca)"]
    },
    {
      "id": "llegamos",
      "si": { "y": [ { "gesto": "circulo", "objetivo": "palanca", "veces": 3 },
                     { "activo": "interruptor-viaje" } ] },
      "hacer": ["reproducir_video(recompensa-del-dia)", "completar(mision-llegar)"]
    }
  ]
}
```

Condiciones disponibles (todas combinables con `y` / `o` / `no`):

    { "activo": "interruptor-viaje" }             un objeto está prendido
    { "variable": "nombre", "es": 3 }             comparación (igual, distinto, mayor, menor)
    { "contador": "maletas", "al_menos": 2 }
    { "evento": "entidad_soltada", "destino": "auto" }   reacciona al evento de este paso
    { "toco": "boca", "veces": 5 }                toques repetidos
    { "gesto": "mantener", "objetivo": "globo", "segundos": 2 }
    { "zona": "casa-tia", "ocupada_por": "$entidad" }
    { "mision": "comprar-pan", "hecha": true }
    { "paso": "secuencia-1", "hecho": 2 }

Acciones disponibles (el "entonces"):

    mostrar / ocultar / mover / animar / escalar        sobre una entidad o zona
    decir(personaje, "frase")                           boca de ventrílocuo + sonido
    sonar(id) / detener_sonido(id)
    reproducir_video(id)                                por el puerto de video
    esperar(2s)                                         encadena con el timeline
    marcar(variable, valor) / sumar(contador, 1)
    activar(objeto) / desactivar(objeto)
    pedir_gesto(tipo, veces, objetivo)                  habilita un QTE
    mostrar_mensaje(texto) / celebrar()                 el único feedback fuerte
    completar(mision) / terminar_nivel()

Todas las acciones ya tienen donde vivir: son las operaciones que hoy hace el juego a
mano. Lo nuevo es que se declaren en datos.

## 4. Gestos (acciones tipo QTE)

Los gestos que pide una situación ("machacar el botón", "girar la manivela", "inflar
el globo", "pasar la palanca") son **un puerto nuevo** (`PuertoGestos`) más un
adaptador que los reconoce sobre la entrada táctil que ya existe. El juego sólo pide
`pedir_gesto(...)` y recibe `gesto_completado` cuando el niño lo logra.

    toque_repetido   5 toques en 3 s              inflar el globo / machacar
    mantener         2 s apretado                 cargar una fuerza
    circulo          arrastre circular (sentido)  la manivela / el análogo
    direccion        arrastre hacia un lado        la palanca (izq/der/arriba/abajo)
    deslizar         swipe rápido                  pasar de pantalla
    sacudir          giroscopio (adaptador aparte) agitar algo
    palabra          micrófono (adaptador aparte)  "¡vamos!" y se abre la puerta

Cada uno con tolerancias generosas y con progreso visible (una barra que se llena):
para Emiliano el gesto tiene que perdonar, no exigir precisión.

## 5. Misiones: el orden importa

Una misión es "algo que hay que lograr", con prerrequisitos y recompensa:

```json
{
  "misiones": [
    { "id": "maletas", "texto": "Subir las maletas al auto",
      "cumple": { "contador": "maletas_en_auto", "es": 3 },
      "requiere": [] },
    { "id": "manejar", "texto": "Manejar hasta la casa de la tía",
      "cumple": { "zona": "casa-tia", "ocupada_por": "$auto" },
      "requiere": ["maletas"] },
    { "id": "llegar", "texto": "¡Llegamos!",
      "cumple": { "mision": "manejar", "hecha": true },
      "requiere": ["manejar"],
      "recompensa": ["reproducir_video(recompensa-del-dia)"] }
  ],
  "nivel_terminado": { "y": [ { "mision": "llegar", "hecha": true } ] }
}
```

Así sale gratis lo que pediste: **no se puede llegar y terminar**. Si `llegar` requiere
`manejar`, y `manejar` requiere `maletas`, el orden queda garantizado por los datos.

## 6. Recompensas personalizadas y dinámicas

Los videos (y sonidos, frases) son **contenido configurable**, no parte de la lógica:

```json
{
  "recompensas": {
    "del-dia": { "tipo": "video", "archivo": "videos/casa-de-la-tia.mp4" },
    "de-la-tia": { "tipo": "video", "archivo": "videos/prima-y-abuelo.mp4" }
  }
}
```

Cambiar el premio es cambiar una línea del archivo (o tocar "Recompensa" en el editor
y elegir otro video): si en dos meses le interesa otro video, se cambia y listo, sin
tocar nada del juego.

## 7. El editor en la tablet (por plantillas, no escribiendo código)

Se toca, no se escribe. La pantalla es una lista de **situaciones** que se arman con
plantillas de opciones (así no hay que recordar sintaxis ni nombres):

    cuando  [ <elegir: toca | suelta sobre | gesto | contador | llega a una zona | misión> ]
    quién   [ <tocar el objeto en la pantalla> ]
    entonces [ <elegir: aparece | desaparece | dice | suena | video | suma | abre | termina> ]

Cada plantilla ofrece sólo lo que tiene sentido (si elegiste "gesto circular", sólo
ofrece objetivos que puedan recibirlo). Lo que se arma se ve al instante: se prueba en
el mismo dispositivo, y se guarda.

Guardar y compartir:

- **Guardar**: el nivel queda como JSON en el dispositivo (`almacenamiento`), igual
  que hoy se guarda el personaje del taller.
- **Exportar / importar**: un archivo por nivel: se pasa por USB, se manda por chat,
  se versiona en el repo.
- **Del editor al código**: el nivel exportado entra a `apps/<juego>/niveles/` y se
  puede editar a mano o generar por código. El editor y el código no compiten: el
  editor es una **vista** del dato.

## 8. Cómo se probó que esto es viable (y qué no entra)

Viabilidad: ninguna de las piezas nuevas pelea con lo que hay. Las reglas viven en un
paquete nuevo que se apoya en lo ya probado (ticker, escena, timeline, puertos), los
gestos son un adaptador más (por eso los puertos existen), y el editor consume el mismo
formato que el juego lee. Y todo se prueba sin navegador: reglas, misiones y gestos son
lógica pura.

**No entra** (para no prometer de más): editor de arte/dibujo (los assets se generan
aparte e IA o se sacan de fotos), física ni choques reales (se simulan con zonas),
scripting visual de miles de nodos (la lógica es legible: decenas de reglas por nivel),
y multijugador.

## 9. Plan por fases (cada una se prueba sola)

| Fase | Qué | Tamaño | Estado |
|---|---|---|---|
| **F1** | `packages/logica`: eventos, reglas, condiciones, acciones, misiones. Tests puros. | 8 | **HECHO** |
| **F2** | Gestos: puerto + adaptador táctil (toque repetido, mantener, círculo, dirección) + un juego corto que los use. | 5 | pendiente |
| **F3** | `apps/editor`: armar situaciones con plantillas en la tablet, guardar, exportar/importar. | 8 | pendiente |
| **F4** | Episodio piloto completo: el viaje a la casa de la tía (maletas → auto → manivela → llegar → video). | 5 | pendiente |
| **F5** | Recompensas dinámicas y refuerzo (cambiar el video/premio del día desde el editor). | 3 | pendiente |

Orden: F1 primero (todo lo demás se apoya ahí), después F2 (que hace divertido jugar),
F4 con lo que ya exista de video, y F3 cuando la lógica esté estable.

### F1 — cómo quedó (lo que hay que saber para seguir)

- El nivel de ejemplo vive en `packages/logica/data/viaje-casa-tia.json` y el test
  `episodio.test.ts` lo juega de punta a punta (subir 3 maletas → 3 vueltas de manivela
  → llegar a la zona → sale el video de la variable `$premio-del-dia` → nivel terminado).
- **Encadenamiento con tope**: las reglas se evalúan en vueltas (hasta 8) y si una
  cambió el mundo se vuelve a empezar. Es lo que hace que "subió las 3 maletas" active
  "arrancar el viaje" y eso pida la manivela, sin programar nada.
- **Los eventos no sobreviven al paso**: una regla de evento reacciona en el paso en que
  pasó, y no tres segundos después.
- **Comodines**: `$entidad`/`$destino`/`$zona` salen del evento que gatilló la regla, y
  cualquier otro `$nombre` se busca en las variables del mundo.
- **`una_vez` se rearma** (por defecto sí): una regla no se repite MIENTRAS su condición
  siga cumpliéndose, y se vuelve a armar cuando la condición se apaga. Por eso UNA regla
  de "soltar maleta sobre el auto" sirve para las tres maletas (el evento se tira al
  final del paso) y una que mira un interruptor dispara una sola vez.
- **Las reglas publican lo que hacen**: `activar`/`desactivar` avisa
  `objeto_activado`/`objeto_desactivado` y `marcar` avisa `variable_cambiada`, para que
  la regla siguiente pueda reaccionar a lo que hizo la anterior en el mismo paso.
- **Misiones por pasadas atómicas y encadenadas**: en cada pasada los prerrequisitos se
  miran como estaban al empezarla, y la lógica repite la pasada hasta que no se cumple
  ninguna nueva. Así `manejar` y `llegar` se cumplen en el mismo paso (encadenadas) pero
  `llegar` nunca se cumple saltándose `manejar`.
- **Estados de misión**: `pendiente` (le faltan prerrequisitos) → `en_curso` (están
  puestos, todavía sin cumplir) → `hecha`. La condición `{ mision, disponible }` pregunta
  por "tiene los prerrequisitos puestos", que no es "está hecha".
- **`completar(mision)`** existe y respeta el orden: si le faltan prerrequisitos no la
  completa (nadie se salta pasos por datos). **`nivel_terminado`** manda cuando está: si
  el nivel lo declara, no alcanza con cumplir todas las misiones.
- **El puente con el motor** (`src/puente.ts`): `new Puente(nivel, { escena, audio, video,
  timeline, avisos })` engancha el arrastre (`entidad_soltada`), los toques
  (`entidad_tocada` con la cuenta de machaque en una ventana de 3 s), las zonas
  (`entrarZona`), los gestos (`gestoCompletado`) y el timeline del motor (cada regla que
  corre avisa `paso_completado` y su acción se aplica igual que las demás). Aplica
  `mostrar/ocultar/mover/escalar` sobre la `Escena`, `sonar` por el puerto de audio,
  `reproducir_video` por el de video, y lo que necesita decisión del juego (`decir`,
  `animar`, `celebrar`, `mostrar_mensaje`, o algo que no está en la escena) sale por
  llamadas (`avisos`). El motor no se tocó: el `Timeline` que arma el puente se le pasa al
  `Juego` como `deps.timeline` y el `paso()` del puente va en `alPaso`.
- **Comandos**: `npx vitest run packages/logica` (98 tests) · `bash tools/verificar.sh`
  (382 tests, typecheck y build del combo).
- **Lo que le toca al juego** (siguiente tarjeta): el adaptador de gestos (F2) y la app del
  episodio (F4) que use el `Puente` con un render y los puertos reales. Acá no hay
  navegador: todo se prueba con escena de verdad y puertos de mentira.
