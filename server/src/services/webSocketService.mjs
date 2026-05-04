/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { Server as SocketIOServer } from 'socket.io';

const logger = createLogger('WebSocketService');

class WebSocketService {
    constructor(deps = {}) {
        this._io = deps.io || null;
        this._Server = deps.Server || null;
        this._logger = deps.logger || null;
        this.io = null;
        this.initialized = false;
    }

    get _log() {
        if (!this._logger) {
            this._logger = logger;
        }
        return this._logger;
    }

    _getServer() {
        if (!this._Server) {
            this._Server = SocketIOServer;
        }
        return this._Server;
    }

    initialize(httpServer) {
        if (this.initialized) {
            this._log.warn('WebSocket service already initialized');
            return;
        }

        const Server = this._getServer();
        this.io = new Server(httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            },
            path: '/ws'
        });

        this.io.on('connection', (socket) => {
            this._log.info('Client connected', { socketId: socket.id });

            socket.on('disconnect', () => {
                this._log.debug('Client disconnected', { socketId: socket.id });
            });

            socket.on('subscribe:task', (taskId) => {
                socket.join(`task:${taskId}`);
                this._log.debug('Client subscribed to task', { socketId: socket.id, taskId });
            });

            socket.on('unsubscribe:task', (taskId) => {
                socket.leave(`task:${taskId}`);
                this._log.debug('Client unsubscribed from task', { socketId: socket.id, taskId });
            });

            socket.on('subscribe:activity', () => {
                socket.join('activity');
                this._log.debug('Client subscribed to activity feed', { socketId: socket.id });
            });
        });

        this.initialized = true;
        this._log.info('WebSocket service initialized');
    }

    emitTaskProgress(taskId, data) {
        if (!this.io) {
            this._log.debug('WebSocket not initialized, skipping emit');
            return;
        }

        this.io.to(`task:${taskId}`).emit('classification:progress', data);
        this.io.to('activity').emit('classification:progress', data);

        this._log.debug('Emitted task progress', { taskId, phase: data.phase });
    }

    emitClassificationComplete(taskId, result) {
        if (!this.io) return;

        this.io.to(`task:${taskId}`).emit('classification:complete', { taskId, ...result });
        this.io.to('activity').emit('classification:complete', { taskId, ...result });

        this._log.debug('Emitted classification complete', { taskId });
    }

    emit(event, data) {
        if (!this.io) return;
        this.io.emit(event, data);
    }

    broadcast(event, data) {
        if (!this.io) return;
        this.io.emit(event, data);
    }

    getConnectionCount() {
        if (!this.io) return 0;
        return this.io.engine.clientsCount;
    }
}

function createWebSocketService(deps = {}) {
    return new WebSocketService(deps);
}

const webSocketService = new WebSocketService();

export default webSocketService;
export { WebSocketService, createWebSocketService };
