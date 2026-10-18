import { crearPlataforma } from '@juegosemi/adaptadores-web';

/**
 * El estudio: la app que abre Emiliano. Es un menú, nada más: tarjetas grandes
 * con un juego/video cada una. Los juegos se compilan aparte y se copian dentro
 * de `juegos/<id>/`, así que acá sólo hay una lista de datos.
 *
 * Importante: NO es un iframe ni un motor: cada juego es su propia página. Si un
 * juego se cae, el menú sigue vivo (y volver es tan simple como atrás).
 */
interface Entrada {
  id: string;
  emoji: string;
  titulo: string;
  detalle: string;
  /** Ruta relativa dentro del paquete web. */
  ruta: string;
  disponible: boolean;
}

const ENTRADAS: Entrada[] = [
  {
    id: 'autos',
    emoji: '🚗',
    titulo: 'Los autos de la familia',
    detalle: 'Llevá a cada persona hasta su auto.',
    ruta: './juegos/autos/index.html',
    disponible: true,
  },
  {
    id: 'viaje',
    emoji: '🧳',
    titulo: 'Vamos a la casa de la tía',
    detalle: 'Subí las maletas, girá la manivela y llegá.',
    ruta: './juegos/viaje/index.html',
    disponible: true,
  },
  {
    id: 'videos',
    emoji: '🎬',
    titulo: 'Videos',
    detalle: 'Los videos de la familia, sin publicidad.',
    ruta: './videos/index.html',
    disponible: false,
  },
  {
    id: 'taller',
    emoji: '🧑‍🎨',
    titulo: 'Armá tu personaje',
    detalle: 'Elegí cara, pelo, polera y zapatos.',
    ruta: './taller/index.html',
    disponible: true,
  },
];

function pintar(): void {
  const contenedor = document.getElementById('tarjetas');
  const nota = document.getElementById('nota');
  if (!contenedor || !nota) return;
  const plataforma = crearPlataforma().info();
  for (const entrada of ENTRADAS) {
    if (entrada.disponible) {
      const enlace = document.createElement('a');
      enlace.className = 'tarra';
      enlace.href = entrada.ruta;
      enlace.innerHTML = `<span class="emoji">${entrada.emoji}</span>
        <span class="titulo">${entrada.titulo}</span>
        <span class="detalle">${entrada.detalle}</span>`;
      contenedor.appendChild(enlace);
    } else {
      const bloque = document.createElement('div');
      bloque.className = 'tarra';
      bloque.style.opacity = '0.55';
      bloque.innerHTML = `<span class="emoji">${entrada.emoji}</span>
        <span class="titulo">${entrada.titulo}</span>
        <span class="detalle">${entrada.detalle} (todavía no está listo)</span>`;
      contenedor.appendChild(bloque);
    }
  }
  nota.textContent =
    `Plataforma: ${plataforma.nombre} · WebGL1 ${plataforma.soporte.webgl1 ? 'sí' : 'no'} · ` +
    `WebGL2 ${plataforma.soporte.webgl2 ? 'sí' : 'no'} · Chromium ${plataforma.soporte.chromium ?? '?'}` +
    (plataforma.soporte.huawei ? ' · dispositivo Huawei (WebView propio)' : '');
  document.title = 'Juegos de Emiliano';
}

pintar();
