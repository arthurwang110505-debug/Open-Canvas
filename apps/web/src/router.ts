import { useMemo, useSyncExternalStore } from 'react';

/**
 * Minimal hash router. OpenCanvas is a single-page app with two views; a hash keeps deep links
 * (`#/design/<id>`) working from `file://` and any static host without server rewrites.
 */
export type Route =
  | { name: 'dashboard' }
  | { name: 'editor'; projectId: string }
  | { name: 'share'; shareId: string }
  | { name: 'not-found'; path: string };

export function parseRoute(hash: string): Route {
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  if (path === '' || path === '/') return { name: 'dashboard' };
  let match = /^\/design\/([^/?#]+)$/.exec(path);
  const projectId = match?.[1];
  if (projectId) return { name: 'editor', projectId: decodeURIComponent(projectId) };
  match = /^\/share\/([^/?#]+)$/.exec(path);
  const shareId = match?.[1];
  if (shareId) return { name: 'share', shareId: decodeURIComponent(shareId) };
  return { name: 'not-found', path };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'dashboard':
      return '#/';
    case 'editor':
      return `#/design/${encodeURIComponent(route.projectId)}`;
    case 'share':
      return `#/share/${encodeURIComponent(route.shareId)}`;
    case 'not-found':
      return `#${route.path}`;
  }
}

export function navigate(route: Route): void {
  const hash = routeToHash(route);
  if (window.location.hash !== hash) window.location.hash = hash;
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readHash(): string {
  return window.location.hash;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeToHash, readHash, () => '');
  return useMemo(() => parseRoute(hash), [hash]);
}
