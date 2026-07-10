// CoreWard - EventBus
// Pub/Sub pattern for component communication

(function() {
  'use strict';

  var listeners = {};

  var EventBus = {
    on: function(event, callback) {
      if (typeof callback !== 'function') return;
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },

    off: function(event, callback) {
      if (!listeners[event]) return;
      if (!callback) {
        delete listeners[event];
        return;
      }
      listeners[event] = listeners[event].filter(function(cb) {
        return cb !== callback;
      });
    },

    emit: function(event, data) {
      if (!listeners[event]) return;
      var handlers = listeners[event].slice();
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](data);
        } catch (err) {
          console.error('[EventBus] Error:', err);
        }
      }
    },

    once: function(event, callback) {
      var self = this;
      var wrapped = function(data) {
        self.off(event, wrapped);
        callback(data);
      };
      this.on(event, wrapped);
    }
  };

  window.EventBus = EventBus;
  console.log('[CoreWard] ✅ EventBus loaded');
})();