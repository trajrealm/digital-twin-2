// AuthorTwin Widget Loader
// Include this script on your page and call AuthorTwin.init() to embed the widget

(function() {
  // Guard against multiple initializations
  if (window.AuthorTwin && window.AuthorTwin._initialized) {
    return;
  }

  const AuthorTwin = {
    _initialized: false,
    _iframeElement: null,
    _expectedOrigin: null,

    init: function(config) {
      config = config || {};
      
      if (this._initialized) {
        console.warn('AuthorTwin already initialized');
        return;
      }

      this._initialized = true;
      this._expectedOrigin = this._getExpectedOrigin();

      const containerId = config.containerId;
      const position = config.position || 'bottom-right';
      const theme = config.theme || 'light';

      let container = null;

      if (containerId) {
        // Mount into existing element
        container = document.getElementById(containerId);
        if (!container) {
          console.error('AuthorTwin: Container element not found:', containerId);
          return;
        }
      } else {
        // Create floating widget container
        container = document.createElement('div');
        container.id = 'author-twin-widget-container';
        container.style.cssText = `
          position: fixed;
          ${position.includes('bottom') ? 'bottom' : 'top'}: 20px;
          ${position.includes('right') ? 'right' : 'left'}: 20px;
          width: 400px;
          height: 600px;
          border-radius: 8px;
          box-shadow: 0 5px 40px rgba(0,0,0,0.16);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
          z-index: 2147483647;
        `;
        document.body.appendChild(container);
      }

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'author-twin-iframe';
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        border-radius: 8px;
      `;

      const embedUrl = this._getEmbedUrl(theme);
      iframe.src = embedUrl;

      // Set up postMessage listener before appending iframe
      this._setupPostMessageListener(iframe, container);

      container.appendChild(iframe);
      this._iframeElement = iframe;
    },

    _getExpectedOrigin: function() {
      // Infer the embed app's origin from the current script URL
      // In production, this would be hardcoded or configured
      return window.location.origin.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://twin.example.com'; // Replace with actual deployment domain
    },

    _getEmbedUrl: function(theme) {
      const baseUrl = this._expectedOrigin;
      const referrer = document.referrer || window.location.href;
      const params = new URLSearchParams({
        theme: theme,
        referrer: referrer,
      });
      return `${baseUrl}/embed?${params.toString()}`;
    },

    _setupPostMessageListener: function(iframe, container) {
      const self = this;

      window.addEventListener('message', function(event) {
        // Validate origin
        if (event.origin !== self._expectedOrigin) {
          return;
        }

        const message = event.data;

        if (message.type === 'widget-ready') {
          // Widget is ready, reveal it
          container.style.opacity = '1';
          container.style.transition = 'opacity 0.3s ease-in';
        } else if (message.type === 'resize') {
          // Resize iframe to content height
          const height = message.height;
          if (height > 0) {
            iframe.style.height = height + 'px';
          }
        }
      });
    },
  };

  // Expose globally
  window.AuthorTwin = AuthorTwin;
})();
