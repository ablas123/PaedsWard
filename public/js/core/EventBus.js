// CoreWard - EventBus (Simplified + Fixed)
// Pub/Sub pattern for component communication

(function() {
  'use strict';

  var listeners = {};

  var EventBus = {
    on: function(event, callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('EventBus.on: callback must be a function');
      }
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      
      // Return unsubscribe function
      return function() {
        EventBus.off(event, callback);
      };
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
      if (listeners[event].length === 0) {
        delete listeners[event];
      }
    },

    emit: function(event, data) {
      if (!listeners[event]) return;
      var handlers = listeners[event].slice();
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](data);
        } catch (err) {
          console.error('[EventBus] Error in handler for "' + event + '":', err);
        }
      }
    },

    once: function(event, callback) {
      var wrapped = function(data) {
        EventBus.off(event, wrapped);
        callback(data);
      };
      EventBus.on(event, wrapped);
    },

    clear: function() {
      listeners = {};
    }
  };

  // Export to global scope
  window.EventBus = EventBus;
  
  console.log('✅ EventBus initialized successfully');
})();