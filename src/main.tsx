import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Montserrat autoalojada: solo los cuatro pesos que se usan (medium, semibold, bold y
// extrabold) y solo el subconjunto latino. Antes venía de Google Fonts, lo que ponía la
// tipografía de la app en manos de un tercero y filtraba la IP de cada móvil en cada
// arranque. Al estar en el bundle, el service worker la precachea y también se ve bien
// sin cobertura. La cursiva que pedía el @import no se usa en ninguna pantalla.
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró #root en index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
