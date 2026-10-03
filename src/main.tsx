import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (window.electronAPI?.platform) {
  document.documentElement.dataset.platform = window.electronAPI.platform;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
