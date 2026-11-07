import { describe, expect, it } from 'vitest';
import { avanzarEpisodio, cerrarEpisodio, episodioVacio, histeresis, suavizar } from './eventos';

describe('episodios', () => {
  it('no emite por frame: sólo al terminar más de cinco segundos', () => {
    let estado = episodioVacio();
    for (let i = 0; i <= 30; i++) {
      const r = avanzarEpisodio(estado, true, i / 5, 'mirada_baja');
      expect(r.evento).toBeNull(); estado = r.estado;
    }
    const eventos = [];
    for (let i = 31; i <= 40; i++) {
      const r = avanzarEpisodio(estado, false, i / 5, 'mirada_baja');
      estado = r.estado; if (r.evento) eventos.push(r.evento);
    }
    expect(eventos).toEqual([{ t: 0, tipo: 'mirada_baja', origen: 'video', detalle: '6.2 s sin contacto visual estimado' }]);
  });
  it('no penaliza cinco segundos exactos ni un giro breve', () => {
    expect(cerrarEpisodio({ inicio: 0, ultimo: 5, recuperando: null }, 'mirada_baja')).toBeNull();
    expect(cerrarEpisodio({ inicio: 0, ultimo: 0.4, recuperando: null }, 'mirada_baja')).toBeNull();
  });
  it('un parpadeo corto no termina el episodio y una pérdida larga no suma duración', () => {
    let e = { inicio: 0, ultimo: 4, recuperando: null };
    e = avanzarEpisodio(e, null, 4.2, 'mirada_baja').estado as typeof e;
    expect(avanzarEpisodio(e, true, 4.4, 'mirada_baja').estado.inicio).toBe(0);
    const r = avanzarEpisodio(e, null, 20, 'mirada_baja');
    expect(r.evento).toBeNull(); expect(r.estado.inicio).toBeNull();
  });
  it('cierra al perder señal sólo la duración realmente observada', () => {
    expect(avanzarEpisodio({ inicio: 0, ultimo: 6, recuperando: null }, null, 50, 'mirada_baja').evento?.detalle)
      .toBe('6.0 s sin contacto visual estimado');
  });
  it('la histéresis evita alternar junto al umbral y el suavizado tiene límite', () => {
    expect(histeresis(0.8, true, 1, 0.6)).toBe(true);
    expect(histeresis(0.8, false, 1, 0.6)).toBe(false);
    expect(suavizar([1, 2, 3], 4)).toEqual([2, 3, 4]);
  });
});
