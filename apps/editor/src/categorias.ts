/**
 * Las categorías de cosas que tiene un juego, en el orden en que se muestran.
 *
 * Son las cinco listas del nivel en construcción: lo que se ve en la pantalla, los
 * lugares a los que se llega, los números que se suman, los interruptores que se
 * prenden y las misiones que se cumplen. El editor las usa para ofrecer opciones y
 * para no repetir ids.
 */

/** Las cosas del juego, por categoría. Calzan con las listas del nivel en construcción. */
export type Categoria = 'entidades' | 'zonas' | 'contadores' | 'interruptores' | 'misiones';

/**
 * Las cosas que se listan en "Lo que tiene el juego", en el orden en que se le
 * ofrecen al grande. Las MISIONES no van acá: tienen su propia pantalla (con
 * prerrequisitos y premio), así no se ofrecen dos veces.
 */
export const CATEGORIAS: readonly Categoria[] = ['entidades', 'zonas', 'contadores', 'interruptores'];

/** Cómo se llama cada lista en pantalla. */
export const ETIQUETA_DE_CATEGORIA: Record<Categoria, string> = {
  entidades: 'De la pantalla',
  zonas: 'Zonas',
  contadores: 'Contadores',
  interruptores: 'Interruptores',
  misiones: 'Misiones',
};

/** Un pictograma para cada lista. */
export const PICTOGRAMA_DE_CATEGORIA: Record<Categoria, string> = {
  entidades: '🧸',
  zonas: '📍',
  contadores: '🔢',
  interruptores: '💡',
  misiones: '🚩',
};

/** La pregunta que se le hace al agregar una cosa ("¿Cómo se llama?"). */
export const PISTA_DE_CATEGORIA: Record<Categoria, string> = {
  entidades: 'el auto, la maleta...',
  zonas: 'la casa, el parque...',
  contadores: 'maletas, toques...',
  interruptores: 'el viaje, la puerta...',
  misiones: 'subir las maletas, llegar...',
};
