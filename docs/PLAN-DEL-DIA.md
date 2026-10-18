# Plan del día — domingo 18 de octubre, 2026

Trabajo autónomo sobre **juegosemi**. La lógica (n-008) quedó cerrada a la 01:30: un
juego nuevo ya se escribe en datos (`packages/logica`) y el puente con el motor está en
`main` (108 tests verdes). Ahora se avanza sobre eso, de arriba hacia abajo.

## El orden (y por qué ese)

| # | Tarjeta | Qué | Peso |
|---|---|---|---|
| 1 | n-009 | **Gestos tipo QTE**: puerto + adaptador táctil (machacar, mantener, girar la manivela, dirección). | 5 |
| 2 | n-011 | **Episodio piloto**: el viaje a la casa de la tía (maletas → manivela → llegar → video). | 5 |
| 3 | n-005 | **Lector de videos H.264** dentro de la app (interfaz grande, sin publicidad). | 5 |
| 4 | n-012 | **Recompensas dinámicas**: cambiar el premio del día sin tocar la lógica. | 3 |
| 5 | n-010 | **Editor de niveles en la tablet** (armar juegos tocando botones). | 8 |
| 6 | n-006 | **Escena orquestada con timeline** (cierre; puede quedar absorbida por n-011). | 3 |

Por qué: los **gestos** son la pieza que hace divertido jugar y la que el episodio
necesita (manejar es un gesto); el **episodio** es lo que junta todo y se puede ver; el
**video** es lo que hace que el premio sea un premio de verdad; las **recompensas**
rematan el episodio; y el **editor** va al final, cuando el formato de datos ya está
estable (es el más grande y el que más se apoya en los demás).

## Cómo se trabaja cada una (el contrato de siempre)

- Una tarjeta del tablero con su bloque `PLAN`; los tests **primero**, sobre lógica pura
  (sin navegador) y con navegador real sólo cuando algo se ve o se toca.
- Rama por feature → `bash tools/verificar.sh` en verde → merge a `main` → push.
- Se cierra con **evidencia medida** (comando + números), nunca con un relato.
- Cada 3 features, una **verificación independiente**: re-correr la barrera completa
  sobre el árbol acumulado y comprobar una por una la evidencia de las cerradas.
- Al cerrar cada tarjeta: resumen corto por Telegram.

## Lo que espera a Papu (no se puede hacer sin él)

- **n-002** Fotos reales de los autos y las caras de la familia.
- **n-003** Correr la sonda en la tablet Huawei (WebGL, códecs, Chromium reales).
- **n-007** Probar el taller y los juegos con Emiliano y ajustar.
- Los **videos** de la familia (el lector se construye y prueba con videos de muestra
  hasta que lleguen los reales; cambiar el archivo es cambiar una línea).

## Reglas que no se negocian

- **Nunca feedback negativo** cuando Emiliano se equivoca: la pieza vuelve a su lugar, en
  silencio. El único refuerzo fuerte es el acierto.
- Sin servicios de Google, sin emulador de Android, todo probado en el navegador del PC.
- Botones grandes y claros; todo lo que decide el juego vive en el repo como texto.
