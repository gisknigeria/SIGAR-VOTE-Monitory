import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import './tailwind.css';
import './styles.css';
import './admin.css';
import './controls.css';
import './cameras.css';
import App from './App.jsx';
import { queryClient } from './queryClient.js';

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
