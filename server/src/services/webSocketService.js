/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('WebSocketService');

class WebSocketService {
  constructor() {
    this.io = null;
    this.initialized = false;
  }

  /**
   * Initialize the WebSocket service with a Socket.IO instance
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    this.initialized = true;

    io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Join the classification progress room
      socket.join('classification_progress');

      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { socketId: socket.id });
      });

      // Handle subscription to specific task progress
      socket.on('subscribe_task', (taskId) => {
        socket.join(`task_${taskId}`);
        logger.debug('Client subscribed to task', { socketId: socket.id, taskId });
      });

      // Handle unsubscription from specific task progress
      socket.on('unsubscribe_task', (taskId) => {
        socket.leave(`task_${taskId}`);
        logger.debug('Client unsubscribed from task', { socketId: socket.id, taskId });
      });
    });

    logger.info('WebSocket service initialized');
  }

  /**
   * Emit an event to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    if (!this.initialized || !this.io) {
      logger.warn('WebSocket service not initialized, skipping emit', { event });
      return;
    }

    try {
      this.io.emit(event, data);
      logger.debug('WebSocket event emitted', { event, data });
    } catch (error) {
      logger.error('Failed to emit WebSocket event', { event, error: error.message });
    }
  }

  /**
   * Emit an event to a specific room
   * @param {string} room - Room name
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emitToRoom(room, event, data) {
    if (!this.initialized || !this.io) {
      logger.warn('WebSocket service not initialized, skipping emit to room', { room, event });
      return;
    }

    try {
      this.io.to(room).emit(event, data);
      logger.debug('WebSocket event emitted to room', { room, event, data });
    } catch (error) {
      logger.error('Failed to emit WebSocket event to room', { room, event, error: error.message });
    }
  }

  /**
   * Emit classification progress event
   * @param {Object} progressData - Progress data
   */
  emitClassificationProgress(progressData) {
    this.emitToRoom('classification_progress', 'classification_progress', progressData);
  }

  /**
   * Emit classification progress for a specific task
   * @param {number} taskId - Task ID
   * @param {Object} progressData - Progress data
   */
  emitTaskProgress(taskId, progressData) {
    this.emitToRoom(`task_${taskId}`, 'task_progress', progressData);
  }

  /**
   * Get connection stats
   * @returns {Object} Connection statistics
   */
  getStats() {
    if (!this.initialized || !this.io) {
      return { connected: false, clientCount: 0 };
    }

    const sockets = this.io.sockets || this.io.of('/').sockets;
    const clientCount = sockets ? sockets.size : 0;

    return {
      connected: true,
      clientCount,
      rooms: this.io.sockets ? Object.keys(this.io.sockets.adapter.rooms) : []
    };
  }
}

// Export singleton instance
module.exports = new WebSocketService();
