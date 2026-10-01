import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró #root en index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
