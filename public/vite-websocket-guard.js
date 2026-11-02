(function () {
  if (typeof window === 'undefined') return;
  var isViteWsNoise = function (val) {
    var msg = String((val && (val.message || val.reason || val)) || '');
    return (
      msg.indexOf('WebSocket closed without opened') !== -1 ||
      msg.indexOf('[vite] failed to connect to websocket') !== -1
    );
  };
  window.addEventListener(
    'unhandledrejection',
    function (event) {
      if (isViteWsNoise(event && event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
  window.addEventListener(
    'error',
    function (event) {
      if (isViteWsNoise((event && (event.error || event.message)) || '')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
  var NativeWebSocket = window.WebSocket;
  if (typeof NativeWebSocket === 'function') {
    var createInertSocket = function (url, protocols) {
      var listeners = {};
      var sock = {
        url: String(url || ''),
        readyState: 1,
        protocol: Array.isArray(protocols) ? protocols[0] || '' : String(protocols || ''),
        extensions: '',
        bufferedAmount: 0,
        binaryType: 'blob',
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        send: function () {},
        close: function () {
          sock.readyState = 3;
        },
        addEventListener: function (type, cb) {
          if (!listeners[type]) listeners[type] = [];
          listeners[type].push(cb);
        },
        removeEventListener: function (type, cb) {
          if (!listeners[type]) return;
          listeners[type] = listeners[type].filter(function (fn) {
            return fn !== cb;
          });
        },
        dispatchEvent: function () {
          return true;
        },
      };
      setTimeout(function () {
        var evt = { type: 'open', target: sock };
        if (typeof sock.onopen === 'function') {
          try {
            sock.onopen(evt);
          } catch (_) {}
        }
        var openListeners = listeners.open || [];
        for (var i = 0; i < openListeners.length; i++) {
          try {
            openListeners[i](evt);
          } catch (_) {}
        }
      }, 0);
      return sock;
    };
    var PatchedWebSocket = function (url, protocols) {
      var protoStr = Array.isArray(protocols)
        ? protocols.join(',')
        : String(protocols || '');
      var urlStr = String(url || '');
      if (
        protoStr.indexOf('vite-hmr') !== -1 ||
        protoStr.indexOf('vite-ping') !== -1 ||
        urlStr.indexOf('vite-hmr') !== -1
      ) {
        return createInertSocket(url, protocols);
      }
      return protocols !== undefined
        ? new NativeWebSocket(url, protocols)
        : new NativeWebSocket(url);
    };
    PatchedWebSocket.prototype = NativeWebSocket.prototype;
    PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
    PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket = PatchedWebSocket;
  }
})();
