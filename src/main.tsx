import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';

const rootElement = '#ai_eval_web';
const rootDom = document.querySelector(rootElement);
if (!rootDom) throw new Error(`Root element ${rootElement} not found`);

createRoot(rootDom).render(<App />);
