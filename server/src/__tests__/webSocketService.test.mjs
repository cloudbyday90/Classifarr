/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));
jest.unstable_mockModule('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const mockIo = {
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  engine: { clientsCount: 5 }
};

const mockServer = jest.fn(() => mockIo);

jest.mock('socket.io', () => ({
  Server: mockServer
}));
jest.unstable_mockModule('socket.io', () => ({
  Server: mockServer,
  default: { Server: mockServer }
}));

const { default: webSocketService } = await import('../services/webSocketService.mjs');

describe('WebSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    webSocketService.io = null;
    webSocketService.initialized = false;
    mockIo.on.mockImplementation((event, callback) => {
      if (event === 'connection') {
        const mockSocket = {
          id: 'test-socket-id',
          on: jest.fn(),
          join: jest.fn(),
          leave: jest.fn()
        };
        callback(mockSocket);
      }
    });
  });

  describe('initialize', () => {
    it('should initialize WebSocket server', () => {
      const mockHttpServer = {};

      webSocketService.initialize(mockHttpServer);

      expect(mockServer).toHaveBeenCalledWith(mockHttpServer, expect.objectContaining({
        cors: expect.any(Object),
        path: '/ws'
      }));
      expect(webSocketService.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      const mockHttpServer = {};

      webSocketService.initialize(mockHttpServer);
      webSocketService.initialize(mockHttpServer);

      expect(mockServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('emitTaskProgress', () => {
    it('should emit progress to task room', () => {
      const mockHttpServer = {};
      webSocketService.initialize(mockHttpServer);

      webSocketService.emitTaskProgress(123, { phase: 'analyzing', progress: 50 });

      expect(mockIo.to).toHaveBeenCalledWith('task:123');
      expect(mockIo.emit).toHaveBeenCalled();
    });

    it('should not emit if not initialized', () => {
      webSocketService.io = null;

      webSocketService.emitTaskProgress(123, { phase: 'analyzing' });

      expect(mockIo.to).not.toHaveBeenCalled();
    });
  });

  describe('emitClassificationComplete', () => {
    it('should emit completion event', () => {
      const mockHttpServer = {};
      webSocketService.initialize(mockHttpServer);

      webSocketService.emitClassificationComplete(123, { libraryId: 1, confidence: 95 });

      expect(mockIo.to).toHaveBeenCalledWith('task:123');
    });

    it('should not emit if not initialized', () => {
      webSocketService.io = null;

      webSocketService.emitClassificationComplete(123, {});

      expect(mockIo.to).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should emit event to all clients', () => {
      const mockHttpServer = {};
      webSocketService.initialize(mockHttpServer);

      webSocketService.emit('test-event', { data: 'test' });

      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should not emit if not initialized', () => {
      webSocketService.io = null;

      webSocketService.emit('test-event', {});

      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });

  describe('broadcast', () => {
    it('should broadcast event to all clients', () => {
      const mockHttpServer = {};
      webSocketService.initialize(mockHttpServer);

      webSocketService.broadcast('broadcast-event', { message: 'hello' });

      expect(mockIo.emit).toHaveBeenCalledWith('broadcast-event', { message: 'hello' });
    });

    it('should not broadcast if not initialized', () => {
      webSocketService.io = null;

      webSocketService.broadcast('test', {});

      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionCount', () => {
    it('should return connection count', () => {
      const mockHttpServer = {};
      webSocketService.initialize(mockHttpServer);

      const count = webSocketService.getConnectionCount();

      expect(count).toBe(5);
    });

    it('should return 0 if not initialized', () => {
      webSocketService.io = null;

      const count = webSocketService.getConnectionCount();

      expect(count).toBe(0);
    });
  });
});
