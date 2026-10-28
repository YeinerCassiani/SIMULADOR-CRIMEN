// Gate de la respuesta al estudiante: la bitácora muestra la acción más reciente
// (bug: mostraba la primera de la práctica) y la tarjeta de respuesta solo enseña
// lo nuevo desde la última vez.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initState, reducer, type SimState } from '../simulator';
import { LogDrawer } from '../ui/LogDrawer';
import { ActionFeedback } from '../ui/ActionFeedback';
import { freshEntries, logKey, stripPoints } from '../ui/logic';

function played(): SimState {
  let s = initState();
  s = reducer(s, { type: 'APPLY_GLOBAL', action: 'EPP' });
  s = reducer(s, { type: 'APPLY_GLOBAL', action: 'CORDON' });
  return s;
}

describe('bitácora: la más reciente primero', () => {
  it('el reducer guarda la entrada más nueva en la posición 0', () => {
    expect(played().log[0].message).toMatch(/Acordonó la escena/);
  });

  it('plegada muestra la última acción, no la primera de la práctica', () => {
    const html = renderToStaticMarkup(createElement(LogDrawer, { state: played(), open: false, onToggle: () => {} }));
    expect(html).toMatch(/drawer-last[^>]*>[^<]*Acordonó la escena/);
    expect(html).not.toMatch(/drawer-last[^>]*>[^<]*Usó EPP/);
  });

  it('abierta lista de la más reciente a la más antigua', () => {
    const html = renderToStaticMarkup(createElement(LogDrawer, { state: played(), open: true, onToggle: () => {} }));
    expect(html.indexOf('Acordonó la escena')).toBeLessThan(html.indexOf('Usó EPP'));
  });
});

describe('freshEntries', () => {
  const log = [
    { time: 't3', message: 'c' },
    { time: 't2', message: 'b' },
    { time: 't1', message: 'a' },
  ];

  it('solo lo posterior a la entrada ya vista', () => {
    expect(freshEntries(log, logKey(log[2])).map((l) => l.message)).toEqual(['c', 'b']);
    expect(freshEntries(log, logKey(log[0]))).toEqual([]);
  });

  it('tras un reinicio (la vista ya no existe) todo es nuevo', () => {
    expect(freshEntries(log, 'x|y').map((l) => l.message)).toEqual(['c', 'b', 'a']);
  });

  it('respeta el máximo y la bitácora vacía', () => {
    expect(freshEntries(log, '', 2)).toHaveLength(2);
    expect(freshEntries([], 'x|y')).toEqual([]);
  });

  it('quita el prefijo de puntos', () => {
    expect(stripPoints('+10 pts - Usó EPP antes de intervenir.')).toBe('Usó EPP antes de intervenir.');
    expect(stripPoints('-15 pts - [Fuera de rol] x')).toBe('[Fuera de rol] x');
    expect(stripPoints('Sin prefijo')).toBe('Sin prefijo');
  });
});

describe('tarjeta de respuesta', () => {
  it('no aparece al abrir una práctica guardada (ya vista)', () => {
    expect(renderToStaticMarkup(createElement(ActionFeedback, { log: played().log }))).toBe('');
  });
});
