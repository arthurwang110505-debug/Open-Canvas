import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { installBundledFonts } from './fonts/install';

// Register the bundled typefaces before the first paint so the editor and every export can use
// them; the files are served from this app, so nothing is fetched from a third party.
installBundledFonts();

const container = document.getElementById('root');
if (!container) {
  throw new Error('OpenCanvas could not start: the #root element is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
