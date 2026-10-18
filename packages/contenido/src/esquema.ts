/**
 * @juegosemi/contenido — validación del contenido del juego.
 *
 * Todo el contenido vive como DATOS (JSON), nunca dentro de un editor gráfico:
 * así el agente puede crear y editar contenido escribiendo texto. Este módulo
 * es el guardián de esos datos: si un JSON está mal, se dice QUÉ está mal y
 * DÓNDE, con el nombre del campo.
 *
 * Sin dependencias externas a propósito (un validador propio, chico y testeado).
 */

export interface Auto {
  id: string;
  nombre: string;
  /** Archivo de imagen del auto (relativo a assets/). */
  imagen?: string;
  color?: string;
}

export interface Persona {
  id: string;
  nombre: string;
  /** Archivo de la foto recortada de la cara (relativa a assets/). */
  cara?: string;
  /** Foto de cuerpo completo, si la hay. */
  foto?: string;
  /** Id del avatar articulado, si tiene uno armado en el taller. */
  avatar?: string;
  /** A qué auto pertenece. Tiene que existir en `autos`. */
  auto: string;
  /** Frase que se muestra/lee al acertar. */
  frase?: string;
}

export interface Familia {
  id: string;
  titulo: string;
  personas: Persona[];
  autos: Auto[];
}

export interface ResultadoValidacion<T> {
  ok: boolean;
  valor?: T;
  errores: string[];
}

function esTextoNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function textoOpcional(dato: Record<string, unknown>, campo: string, errores: string[], donde: string): string | undefined {
  const v = dato[campo];
  if (v === undefined || v === null) return undefined;
  if (!esTextoNoVacio(v)) {
    errores.push(`${donde}: el campo "${campo}" debe ser un texto no vacío`);
    return undefined;
  }
  return v;
}

/** Valida una familia completa (personas + autos) y sus reglas de negocio. */
export function validarFamilia(dato: unknown): ResultadoValidacion<Familia> {
  const errores: string[] = [];
  if (!esObjeto(dato)) return { ok: false, errores: ['la familia debe ser un objeto'] };

  const id = textoOpcional(dato, 'id', errores, 'familia');
  const titulo = textoOpcional(dato, 'titulo', errores, 'familia');

  const autosBrutos = dato['autos'];
  const autos: Auto[] = [];
  if (!Array.isArray(autosBrutos)) {
    errores.push('familia.autos debe ser una lista');
  } else {
    const vistos = new Set<string>();
    autosBrutos.forEach((a, i) => {
      const donde = `familia.autos[${i}]`;
      if (!esObjeto(a)) {
        errores.push(`${donde}: debe ser un objeto`);
        return;
      }
      const autoId = textoOpcional(a, 'id', errores, donde);
      const nombre = textoOpcional(a, 'nombre', errores, donde);
      if (autoId) {
        if (vistos.has(autoId)) errores.push(`${donde}: id repetido "${autoId}"`);
        vistos.add(autoId);
      }
      if (autoId && nombre) {
        const auto: Auto = { id: autoId, nombre };
        const imagen = textoOpcional(a, 'imagen', errores, donde);
        const color = textoOpcional(a, 'color', errores, donde);
        if (imagen) auto.imagen = imagen;
        if (color) auto.color = color;
        autos.push(auto);
      }
    });
  }

  const personasBrutas = dato['personas'];
  const personas: Persona[] = [];
  if (!Array.isArray(personasBrutas)) {
    errores.push('familia.personas debe ser una lista');
  } else {
    const vistos = new Set<string>();
    const idsAuto = new Set(autos.map((a) => a.id));
    personasBrutas.forEach((p, i) => {
      const donde = `familia.personas[${i}]`;
      if (!esObjeto(p)) {
        errores.push(`${donde}: debe ser un objeto`);
        return;
      }
      const personaId = textoOpcional(p, 'id', errores, donde);
      const nombre = textoOpcional(p, 'nombre', errores, donde);
      const auto = textoOpcional(p, 'auto', errores, donde);
      if (personaId) {
        if (vistos.has(personaId)) errores.push(`${donde}: id repetido "${personaId}"`);
        vistos.add(personaId);
      }
      // Regla de negocio: toda persona tiene que apuntar a un auto que existe.
      if (auto && !idsAuto.has(auto)) {
        errores.push(`${donde}: "${nombre ?? personaId ?? '?'}" apunta al auto "${auto}", que no existe en familia.autos`);
      }
      if (personaId && nombre && auto) {
        const persona: Persona = { id: personaId, nombre, auto };
        const cara = textoOpcional(p, 'cara', errores, donde);
        const foto = textoOpcional(p, 'foto', errores, donde);
        const avatar = textoOpcional(p, 'avatar', errores, donde);
        const frase = textoOpcional(p, 'frase', errores, donde);
        if (cara) persona.cara = cara;
        if (foto) persona.foto = foto;
        if (avatar) persona.avatar = avatar;
        if (frase) persona.frase = frase;
        personas.push(persona);
      }
    });
  }

  // Reglas de negocio del juego: sin al menos dos pares no hay juego.
  if (autos.length < 2) errores.push(`el juego necesita al menos 2 autos (hay ${autos.length})`);
  if (personas.length < 2) errores.push(`el juego necesita al menos 2 personas (hay ${personas.length})`);

  if (errores.length > 0 || !id || !titulo) return { ok: false, errores };

  return { ok: true, valor: { id, titulo, personas, autos }, errores: [] };
}

/** El auto que le corresponde a una persona (null si el contenido es inválido). */
export function autoDePersona(familia: Familia, personaId: string): Auto | null {
  const persona = familia.personas.find((p) => p.id === personaId);
  if (!persona) return null;
  return familia.autos.find((a) => a.id === persona.auto) ?? null;
}

/** Los pares correctos (persona → auto), en orden estable. Útil para los tests y el taller. */
export function paresCorrectos(familia: Familia): Array<{ persona: Persona; auto: Auto }> {
  const pares: Array<{ persona: Persona; auto: Auto }> = [];
  for (const persona of familia.personas) {
    const auto = familia.autos.find((a) => a.id === persona.auto);
    if (auto) pares.push({ persona, auto });
  }
  return pares;
}
