import {StrictMode} from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import'leaflet/dist/leaflet.css';import'./styles.css';import'./target.css';import App from'./App';
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App/></BrowserRouter></StrictMode>);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>undefined));
