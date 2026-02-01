import { render } from 'preact';
import ReplayApp from './ReplayApp';
import './styles/main.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/log.css';
import './styles/dropzone.css';

render(<ReplayApp />, document.getElementById('app')!);
