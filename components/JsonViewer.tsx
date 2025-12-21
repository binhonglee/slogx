import { useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';

interface JsonViewerProps {
  data: any;
  initialExpanded?: boolean;
  level?: number;
}

const JsonViewer: FunctionComponent<JsonViewerProps> = ({ data, initialExpanded = false, level = 0 }) => {
  const [expanded, setExpanded] = useState(initialExpanded);

  if (data === null) return <span className="json-viewer null">null</span>;
  if (data === undefined) return <span className="json-viewer undefined">undefined</span>;

  if (typeof data === 'boolean') {
    return <span className="json-viewer boolean">{data.toString()}</span>;
  }

  if (typeof data === 'number') {
    return <span className="json-viewer number">{data}</span>;
  }

  if (typeof data === 'string') {
    return <span className="json-viewer string">"{data}"</span>;
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;

  if (isEmpty) {
    return <span className="json-viewer empty">{isArray ? '[]' : '{}'}</span>;
  }

  const toggle = () => setExpanded(!expanded);

  return (
    <div className="json-viewer">
      <span onClick={toggle} className="toggle">
        <span className="arrow">{expanded ? '▼' : '▶'}</span>
        {isArray ? `Array(${data.length})` : 'Object'}
        {!expanded && <span className="preview">...</span>}
      </span>

      {expanded && (
        <div className="children">
          {keys.map((key) => (
            <div key={key} className="property">
              <span className="key">{key}:</span>
              <JsonViewer data={data[key]} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JsonViewer;
