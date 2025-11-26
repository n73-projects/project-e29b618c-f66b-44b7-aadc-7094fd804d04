import { useState, useRef, useEffect } from 'react';
import { Button } from "./components/ui/button";

interface SelectedElement {
  element: HTMLElement;
  originalText: string;
  path: string;
}

function App() {
  const [url, setUrl] = useState('https://example.com');
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editingText, setEditingText] = useState('');
  const [tailwindClasses, setTailwindClasses] = useState('');
  const [codeChanges, setCodeChanges] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load iframe with injected script
  const loadIframe = () => {
    if (!url) return;
    setIframeKey(prev => prev + 1);
    setSelectedElement(null);
    setCodeChanges([]);
  };

  // Inject editing script into iframe
  const injectScript = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;

      // Remove any existing script
      const existingScript = doc.getElementById('edit-injector');
      if (existingScript) existingScript.remove();

      const script = doc.createElement('script');
      script.id = 'edit-injector';
      script.innerHTML = `
        (function() {
          let selectedEl = null;
          let originalOutline = '';

          function selectElement(el) {
            // Remove previous selection
            if (selectedEl) {
              selectedEl.style.outline = originalOutline;
              selectedEl.contentEditable = 'false';
            }

            selectedEl = el;
            originalOutline = el.style.outline;
            el.style.outline = '2px solid #3b82f6';
            el.contentEditable = 'true';

            // Get element path
            const path = getElementPath(el);
            const text = el.innerText || el.textContent || '';
            const classes = el.className || '';

            // Send data to parent
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              text: text,
              classes: classes,
              path: path
            }, '*');
          }

          function getElementPath(el) {
            const path = [];
            while (el && el !== document.body) {
              let selector = el.tagName.toLowerCase();
              if (el.id) selector += '#' + el.id;
              if (el.className) selector += '.' + el.className.split(' ').join('.');
              path.unshift(selector);
              el = el.parentElement;
            }
            return path.join(' > ');
          }

          // Click handler
          document.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            selectElement(e.target);
          });

          // Escape key handler
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && selectedEl) {
              selectedEl.style.outline = originalOutline;
              selectedEl.contentEditable = 'false';
              selectedEl = null;
              window.parent.postMessage({ type: 'ESCAPE_PRESSED' }, '*');
            }
          });

          // Listen for updates from parent
          window.addEventListener('message', function(e) {
            if (e.data.type === 'UPDATE_TEXT' && selectedEl) {
              selectedEl.innerText = e.data.text;
            }
            if (e.data.type === 'UPDATE_CLASSES' && selectedEl) {
              selectedEl.className = e.data.classes;
            }
          });
        })();
      `;

      doc.body.appendChild(script);
    } catch (error) {
      console.warn('Could not inject script due to CORS/CSP restrictions');
    }
  };

  // Handle iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setTimeout(() => {
        injectScript();
      }, 1000);
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [iframeKey]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ELEMENT_SELECTED') {
        setEditingText(event.data.text);
        setTailwindClasses(event.data.classes);
        setSelectedElement({
          element: null as any, // We'll manage this through postMessage
          originalText: event.data.text,
          path: event.data.path
        });
      }
      if (event.data.type === 'ESCAPE_PRESSED') {
        setSelectedElement(null);
        setEditingText('');
        setTailwindClasses('');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Update text in iframe
  const updateText = (newText: string) => {
    setEditingText(newText);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_TEXT',
        text: newText
      }, '*');

      // Log code change
      const change = `Text changed: "${selectedElement?.originalText}" → "${newText}"`;
      setCodeChanges(prev => [...prev, change]);
    }
  };

  // Update classes in iframe
  const updateClasses = (newClasses: string) => {
    setTailwindClasses(newClasses);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'UPDATE_CLASSES',
        classes: newClasses
      }, '*');

      // Log code change
      const change = `Classes updated: "${newClasses}" on ${selectedElement?.path}`;
      setCodeChanges(prev => [...prev, change]);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h1 className="text-2xl font-bold mb-4">Edit on Preview</h1>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <Button onClick={loadIframe}>
            Load Site
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Iframe */}
          <div className="flex-1 p-4">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={url}
              className="w-full h-full border rounded-md"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>

        {/* Editing Sidebar */}
        {selectedElement && (
          <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4">Edit Element</h3>

            <div className="space-y-4">
              {/* Text Editor */}
              <div>
                <label className="block text-sm font-medium mb-1">Text Content</label>
                <textarea
                  value={editingText}
                  onChange={(e) => updateText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md resize-none"
                  rows={3}
                  placeholder="Edit the text content..."
                />
              </div>

              {/* Tailwind Classes */}
              <div>
                <label className="block text-sm font-medium mb-1">Tailwind Classes</label>
                <input
                  type="text"
                  value={tailwindClasses}
                  onChange={(e) => updateClasses(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="bg-red-500 text-2xl p-8..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: bg-blue-500 text-white p-4 rounded-lg
                </p>
              </div>

              {/* Element Path */}
              <div>
                <label className="block text-sm font-medium mb-1">Element Path</label>
                <code className="block text-xs bg-gray-100 p-2 rounded border break-all">
                  {selectedElement.path}
                </code>
              </div>

              <p className="text-sm text-gray-600">
                Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Escape</kbd> to stop editing
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Code Changes Log */}
      {codeChanges.length > 0 && (
        <div className="border-t bg-gray-900 text-white p-4 max-h-48 overflow-y-auto">
          <h4 className="font-semibold mb-2">Code Changes (Copy-Paste Ready)</h4>
          <div className="space-y-1">
            {codeChanges.map((change, index) => (
              <div key={index} className="font-mono text-sm bg-gray-800 p-2 rounded">
                {change}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
