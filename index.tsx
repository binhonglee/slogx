import { render } from 'preact';
import './styles/main.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/log.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

render(<App />, rootElement);