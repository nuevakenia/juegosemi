import type {
  InfoPlataforma,
  PuertoAlmacenamiento,
  PuertoPantalla,
  PuertoPlataforma,
  Reloj,
} from '@juegosemi/puertos';

/** Almacenamiento local (localStorage). Sirve para guardar el progreso del niño. */
export function crearAlmacenamientoLocal(espacio = 'juegosemi'): PuertoAlmacenamiento {
  return {
    guardar(clave: string, valor: unknown): void {
      try {
        localStorage.setItem(`${espacio}:${clave}`, JSON.stringify(valor));
      } catch {
        // sin almacenamiento no se pierde el juego: sólo no se recuerda
      }
    },
    leer<T>(clave: string): T | null {
      try {
        const bruto = localStorage.getItem(`${espacio}:${clave}`);
        return bruto === null ? null : (JSON.parse(bruto) as T);
      } catch {
        return null;
      }
    },
    borrar(clave: string): void {
      try {
        localStorage.removeItem(`${espacio}:${clave}`);
      } catch {
        // nada
      }
    },
    claves(): string[] {
      const salida: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const clave = localStorage.key(i);
          if (clave && clave.startsWith(`${espacio}:`)) salida.push(clave.slice(espacio.length + 1));
        }
      } catch {
        // nada
      }
      return salida;
    },
  };
}

/** Reloj real (performance.now si existe). */
export function crearReloj(): Reloj {
  const base = typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
  return { ahora: base };
}

/** La pantalla: tamaño lógico y aviso de cambios (girar la tablet, etc.). */
export function crearPantalla(ancho: number, alto: number): PuertoPantalla {
  return {
    tamano(): { ancho: number; alto: number } {
      const elemento = document.getElementById('juego');
      if (elemento && elemento.clientWidth > 0) {
        return { ancho: elemento.clientWidth, alto: elemento.clientHeight };
      }
      return { ancho, alto };
    },
    alCambiar(callback: () => void): void {
      window.addEventListener('resize', callback);
      window.addEventListener('orientationchange', callback);
    },
  };
}

/** Info de la plataforma: es la que después se manda al reporte de la sonda. */
export function crearPlataforma(): PuertoPlataforma {
  function soporteWebgl(): { webgl1: boolean; webgl2: boolean } {
    try {
      const lienzo = document.createElement('canvas');
      return {
        webgl1: !!lienzo.getContext('webgl'),
        webgl2: !!lienzo.getContext('webgl2'),
      };
    } catch {
      return { webgl1: false, webgl2: false };
    }
  }

  return {
    info(): InfoPlataforma {
      const ua = navigator.userAgent;
      const chromium = (() => {
        const m = ua.match(/Chrome\/(\d+)/);
        return m && m[1] ? Number(m[1]) : null;
      })();
      const gl = soporteWebgl();
      return {
        nombre: /Android/i.test(ua) ? 'android' : 'web',
        userAgent: ua,
        ancho: window.innerWidth,
        alto: window.innerHeight,
        densidad: window.devicePixelRatio || 1,
        nucleos: navigator.hardwareConcurrency ?? 1,
        soporte: {
          webgl1: gl.webgl1,
          webgl2: gl.webgl2,
          chromium,
          huawei: /Huawei|HONOR|HarmonyOS/i.test(ua),
        },
      };
    },
    vibrar(milisegundos: number): void {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(milisegundos);
    },
  };
}
