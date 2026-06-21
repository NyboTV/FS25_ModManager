import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import App from './components/App';
import './styles/main.scss';
import { ipcRenderer } from 'electron';

// Override console methods to forward to main process logger
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

const serializeArgs = (args: any[]) => args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a, Object.getOwnPropertyNames(a)) : String(a));

console.log = (...args) => {
  originalConsoleLog(...args);
  ipcRenderer.send('renderer-log', 'info', ...serializeArgs(args));
};
console.error = (...args) => {
  originalConsoleError(...args);
  ipcRenderer.send('renderer-log', 'error', ...serializeArgs(args));
};
console.warn = (...args) => {
  originalConsoleWarn(...args);
  ipcRenderer.send('renderer-log', 'warn', ...serializeArgs(args));
};
console.debug = (...args) => {
  originalConsoleDebug(...args);
  ipcRenderer.send('renderer-log', 'debug', ...serializeArgs(args));
};

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
