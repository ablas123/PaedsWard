// CoreWard - EventBus (Pub/Sub Pattern)
// Central event system for component communication

class EventBus {
  constructor() {
    this.listeners = Object.create(null); // cleaner than {}
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('EventBus.on: callback must be a function');
    }
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler to remove
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    if (!callback) {
      // Remove all listeners for this event
      delete this.listeners[event];
      return;
    }
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    if (this.listeners[event].length === 0) {
      delete this.listeners[event];
    }
  }

  /**
   * Emit an event with data
   * @param {string} event - Event name
   * @param {any} data - Data to pass to listeners
   */
  emit(event, data) {
    if (!this.listeners[event]) return;
    // Copy array to prevent mutation during iteration
    const handlers = this.listeners[event].slice();
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    });
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   */
  once(event, callback) {
    const wrapped = (data) => {
      this.off(event, wrapped);
      callback(data);
    };
    this.on(event, wrapped);
  }

  /**
   * Check if event has listeners
   * @param {string} event - Event name
   * @returns {boolean}
   */
  has(event) {
    return !!(this.listeners[event] && this.listeners[event].length > 0);
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners = Object.create(null);
  }
}

// Global singleton instance
window.EventBus = new EventBus();