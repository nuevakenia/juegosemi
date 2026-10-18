/**
 * La miniatura, probada sin navegador.
 *
 * Acá no hay DOM ni decodificador, que es justamente uno de los casos que
 * importa: la miniatura NO puede romper nada. Si no se puede sacar un cuadro,
 * no se llama a nadie y la tarjeta se queda con su pictograma.
 */
import { describe, expect, it, vi } from 'vitest';
import { sacarMiniatura } from './miniatura.ts';

describe('sacar la miniatura de un video', () => {
  it('sin DOM no explota y no llama a nadie (la tarjeta se queda con su pictograma)', () => {
    const alTenerla = vi.fn();

    const cancelar = sacarMiniatura('assets/videos/casa-de-la-tia.mp4', alTenerla);

    expect(typeof cancelar).toBe('function');
    expect(alTenerla).not.toHaveBeenCalled();
  });

  it('cancelar tampoco explota, aunque no haya nada que cancelar', () => {
    const cancelar = sacarMiniatura('assets/videos/x.mp4', vi.fn(), { tiempoMaximoMs: 10 });

    expect(() => cancelar()).not.toThrow();
    expect(() => cancelar()).not.toThrow();
  });
});
