import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// frame-ancestors cannot be expressed in a <meta> CSP on a static host, so a
// page that handles keys refuses to render inside another origin's frame.
if (window.top !== window.self) {
  document.body.replaceChildren(
    Object.assign(document.createElement('p'), {
      textContent: 'GhostName does not run inside a frame. Open it in its own tab.',
      style: 'font-family: system-ui; padding: 2rem; color: #d7e1ea; background: #0a0e12;',
    }),
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
