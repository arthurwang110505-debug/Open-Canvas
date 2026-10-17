import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { navigate, parseRoute, routeToHash } from './router';

describe('parseRoute', () => {
  it('maps an empty or root hash to the dashboard', () => {
    expect(parseRoute('')).toEqual({ name: 'dashboard' });
    expect(parseRoute('#')).toEqual({ name: 'dashboard' });
    expect(parseRoute('#/')).toEqual({ name: 'dashboard' });
  });

  it('maps a design hash to the editor', () => {
    expect(parseRoute('#/design/doc_1')).toEqual({ name: 'editor', projectId: 'doc_1' });
    expect(parseRoute('#/design/doc%201')).toEqual({ name: 'editor', projectId: 'doc 1' });
  });

  it('reports anything else as unknown', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'not-found', path: '/nope' });
    expect(parseRoute('#/design/')).toEqual({ name: 'not-found', path: '/design/' });
    expect(parseRoute('#/design/a/b')).toEqual({ name: 'not-found', path: '/design/a/b' });
  });
});

describe('routeToHash', () => {
  it('round-trips every route', () => {
    expect(routeToHash({ name: 'dashboard' })).toBe('#/');
    expect(routeToHash({ name: 'editor', projectId: 'doc 1' })).toBe('#/design/doc%201');
    expect(routeToHash({ name: 'not-found', path: '/x' })).toBe('#/x');
    expect(parseRoute(routeToHash({ name: 'editor', projectId: 'doc_1' }))).toEqual({
      name: 'editor',
      projectId: 'doc_1',
    });
  });
});

describe('navigate', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('updates the location hash', () => {
    navigate({ name: 'editor', projectId: 'doc_1' });
    expect(window.location.hash).toBe('#/design/doc_1');
    navigate({ name: 'dashboard' });
    expect(window.location.hash).toBe('#/');
  });
});
