/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { Server } = require('socket.io');
const { createLogger } = require('../utils/logger');

const logger = createLogger('WebSocketService');

class WebSocketService {
    constructor() {
        this.io = null;
        this.initialized = false;
    }

    /**
     * Initialize WebSocket server with existing HTTP server
     * @param {Object} httpServer - HTTP server instance from Express
     */
    initialize(httpServer) {
        if (this.initialized) {
            logger.warn('WebSocket service already initialized');
            return;
        }

        this.io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            },
            path: '/ws'
        });

        this.io.on('connection', (socket) => {
            logger.info('Client connected', { socketId: socket.id });

            socket.on('disconnect', () => {
                logger.debug('Client disconnected', { socketId: socket.id });
            });

            // Join task-specific room for targeted updates
            socket.on('subscribe:task', (taskId) => {
                socket.join(`task:${taskId}`);
                logger.debug('Client subscribed to task', { socketId: socket.id, taskId });
            });

            // Leave task room
            socket.on('unsubscribe:task', (taskId) => {
                socket.leave(`task:${taskId}`);
                logger.debug('Client unsubscribed from task', { socketId: socket.id, taskId });
            });

            // Join activity room for all classification updates
            socket.on('subscribe:activity', () => {
                socket.join('activity');
                logger.debug('Client subscribed to activity feed', { socketId: socket.id });
            });
        });

        this.initialized = true;
        logger.info('WebSocket service initialized');
    }

    /**
     * Emit task progress update
     * @param {number} taskId - Task ID
     * @param {Object} data - Progress data
     */
    emitTaskProgress(taskId, data) {
        if (!this.io) {
            logger.debug('WebSocket not initialized, skipping emit');
            return;
        }

        // Emit to specific task room
        this.io.to(`task:${taskId}`).emit('classification:progress', data);

        // Also emit to activity room for global monitoring
        this.io.to('activity').emit('classification:progress', data);

        logger.debug('Emitted task progress', { taskId, phase: data.phase });
    }

    /**
     * Emit classification completion event
     * @param {number} taskId - Task ID
     * @param {Object} result - Classification result
     */
    emitClassificationComplete(taskId, result) {
        if (!this.io) return;

        this.io.to(`task:${taskId}`).emit('classification:complete', { taskId, ...result });
        this.io.to('activity').emit('classification:complete', { taskId, ...result });

        logger.debug('Emitted classification complete', { taskId });
    }

    /**
     * Emit general activity update
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    emit(event, data) {
        if (!this.io) return;
        this.io.emit(event, data);
    }

    /**
     * Broadcast to all connected clients
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    broadcast(event, data) {
        if (!this.io) return;
        this.io.emit(event, data);
    }

    /**
     * Get connection count
     * @returns {number} Number of connected clients
     */
    getConnectionCount() {
        if (!this.io) return 0;
        return this.io.engine.clientsCount;
    }
}

// Export singleton instance
module.exports = new WebSocketService();
