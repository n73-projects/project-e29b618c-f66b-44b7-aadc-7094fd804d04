import { useState, useRef, useEffect } from 'react';
import { Button } from "./components/ui/button";

interface SelectedElement {
  element: HTMLElement;
  originalText: string;
  path: string;
}

function App() {
  const [url, setUrl] = useState(window.location.origin + '/test-page.html');
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [editingText, setEditingText] = useState('');
  const [tailwindClasses, setTailwindClasses] = useState('');
  const [codeChanges, setCodeChanges] = useState<string[]>([]);
  const [mode, setMode] = useState<'url' | 'html'>('url');
  const [htmlContent, setHtmlContent] = useState('');
  const [modifiedHtml, setModifiedHtml] = useState('');

  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 p-8">
    <div class="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 class="text-3xl font-bold text-gray-900 mb-4">Sample HTML Page</h1>
        <p class="text-gray-700 mb-4">This is a sample HTML snippet. Click on any element to edit it!</p>
        <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Sample Button</button>
        <div class="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 class="font-semibold text-yellow-800">Try editing:</h3>
            <ul class="mt-2 space-y-1 text-yellow-700">
                <li>• Change text content</li>
                <li>• Modify Tailwind classes</li>
                <li>• Copy the edited HTML</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load iframe with injected script
  const loadIframe = () => {
    if (!url && mode === 'url') return;
    setIframeKey(prev => prev + 1);
    setSelectedElement(null);
    setCodeChanges([]);
  };

  // Load HTML content directly into iframe
  const loadHtmlContent = () => {
    if (!htmlContent.trim()) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    setIframeKey(prev => prev + 1);
    setSelectedElement(null);
    setCodeChanges([]);
    setModifiedHtml(htmlContent);

    // Wait for iframe to be ready, then inject content
    setTimeout(() => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();

          // Inject script after content is loaded
          setTimeout(() => {
            injectScript();
          }, 500);
        }
      } catch (error) {
        console.warn('Could not load HTML content:', error);
      }
    }, 100);
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
          let originalBackground = '';
          let hoverEl = null;
          let originalHoverOutline = '';

          function selectElement(el) {
            // Remove previous selection
            if (selectedEl) {
              selectedEl.style.outline = originalOutline;
              selectedEl.style.backgroundColor = originalBackground;
              selectedEl.contentEditable = 'false';
            }

            selectedEl = el;
            originalOutline = el.style.outline;
            originalBackground = el.style.backgroundColor;

            // More prominent selection styling
            el.style.outline = '3px solid #2563eb';
            el.style.outlineOffset = '2px';
            el.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
            el.contentEditable = 'true';
            el.focus();

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

          // Hover effect for better UX
          document.addEventListener('mouseover', function(e) {
            if (e.target !== selectedEl && e.target !== hoverEl) {
              // Remove previous hover
              if (hoverEl && hoverEl !== selectedEl) {
                hoverEl.style.outline = originalHoverOutline;
              }

              hoverEl = e.target;
              originalHoverOutline = e.target.style.outline;
              e.target.style.outline = '2px dashed #64748b';
              e.target.style.outlineOffset = '1px';
            }
          });

          document.addEventListener('mouseout', function(e) {
            if (hoverEl && hoverEl !== selectedEl) {
              hoverEl.style.outline = originalHoverOutline;
              hoverEl = null;
            }
          });

          // Click handler
          document.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Remove hover effect when clicking
            if (hoverEl) {
              hoverEl.style.outline = originalHoverOutline;
              hoverEl = null;
            }

            selectElement(e.target);
          });

          // Escape key handler
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && selectedEl) {
              selectedEl.style.outline = originalOutline;
              selectedEl.style.backgroundColor = originalBackground;
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

          // Add visual indicator that the page is ready for editing
          const indicator = document.createElement('div');
          indicator.innerHTML = '✏️ Click any element to edit';
          indicator.style.cssText = \`
            position: fixed;
            top: 10px;
            right: 10px;
            background: #1f2937;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: fadeIn 0.5s ease-in;
          \`;

          const style = document.createElement('style');
          style.textContent = \`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          \`;
          document.head.appendChild(style);
          document.body.appendChild(indicator);

          // Auto-hide indicator after 3 seconds
          setTimeout(() => {
            indicator.style.transition = 'opacity 0.5s';
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 500);
          }, 3000);
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

      // Update modified HTML if in HTML mode
      if (mode === 'html') {
        setTimeout(() => updateModifiedHtml(), 100);
      }
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

      // Update modified HTML if in HTML mode
      if (mode === 'html') {
        setTimeout(() => updateModifiedHtml(), 100);
      }
    }
  };

  // Extract modified HTML from iframe
  const updateModifiedHtml = () => {
    try {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
      if (doc) {
        setModifiedHtml(doc.documentElement.outerHTML);
      }
    } catch (error) {
      console.warn('Could not extract modified HTML:', error);
    }
  };

  // Copy modified HTML to clipboard
  const copyModifiedHtml = async () => {
    if (modifiedHtml) {
      try {
        await navigator.clipboard.writeText(modifiedHtml);
        alert('Modified HTML copied to clipboard!');
      } catch (error) {
        console.warn('Could not copy to clipboard:', error);
        // Fallback: show modal with HTML
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <pre style="white-space: pre-wrap; font-family: monospace; padding: 20px;">
              ${modifiedHtml.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </pre>
          `);
        }
      }
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h1 className="text-2xl font-bold mb-4">Edit on Preview</h1>

        {/* Mode Switcher */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'url' ? 'default' : 'outline'}
            onClick={() => setMode('url')}
            className="px-4 py-2"
          >
            📄 URL Mode
          </Button>
          <Button
            variant={mode === 'html' ? 'default' : 'outline'}
            onClick={() => setMode('html')}
            className="px-4 py-2"
          >
            ✂️ HTML Mode
          </Button>
        </div>

        {mode === 'url' ? (
          <div className="space-y-3">
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
            <p className="text-sm text-gray-600">
              💡 <strong>URL Mode:</strong> Load any live website to edit it visually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="Paste your HTML source code here... (e.g., view source of any webpage and paste it)"
                className="flex-1 px-3 py-2 border rounded-md resize-none font-mono text-sm"
                rows={4}
              />
              <div className="flex flex-col gap-2">
                <Button onClick={loadHtmlContent} disabled={!htmlContent.trim()}>
                  Load HTML
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setHtmlContent(sampleHtml)}
                  className="text-xs"
                >
                  Load Sample
                </Button>
                <Button
                  variant="outline"
                  onClick={copyModifiedHtml}
                  disabled={!modifiedHtml}
                  className="text-xs"
                >
                  Copy Edited
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              💡 <strong>HTML Mode:</strong> Paste HTML source code, edit visually, then copy back the changes.
            </p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-500">
            <strong>How to use:</strong> Load content, then hover over elements to preview and click to select and edit them.
            Press Escape to stop editing.
          </p>
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
              src={mode === 'url' ? url : undefined}
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
      {(codeChanges.length > 0 || modifiedHtml) && (
        <div className="border-t bg-gray-900 text-white p-4 max-h-48 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">
              {mode === 'html' ? 'HTML Changes' : 'Code Changes'} (Copy-Paste Ready)
            </h4>
            {mode === 'html' && modifiedHtml && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyModifiedHtml}
                className="text-xs bg-white text-gray-900 hover:bg-gray-100"
              >
                📋 Copy Full HTML
              </Button>
            )}
          </div>

          {mode === 'html' && modifiedHtml ? (
            <div className="bg-gray-800 p-2 rounded">
              <p className="text-xs text-gray-300 mb-2">Modified HTML ready to copy:</p>
              <div className="font-mono text-xs text-green-400 max-h-20 overflow-auto">
                {modifiedHtml.substring(0, 200)}...
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {codeChanges.map((change, index) => (
                <div key={index} className="font-mono text-sm bg-gray-800 p-2 rounded">
                  {change}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
