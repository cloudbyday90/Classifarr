/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

const { 
    OperationController, 
    createController,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_INITIAL_TIMEOUT_MS,
    DEFAULT_HEARTBEAT_TIMEOUT_MS,
    DEFAULT_HARD_TIMEOUT_MS
} = require('../utils/operationController');

describe('OperationController', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('constructor', () => {
        test('uses default values when no options provided', () => {
            const controller = new OperationController();
            
            expect(controller.mode).toBe('simple');
            expect(controller.timeout).toBe(DEFAULT_TIMEOUT_MS);
            expect(controller.status).toBe(OperationController.Status.IDLE);
            expect(controller.isAborted).toBe(false);
        });

        test('accepts custom options', () => {
            const controller = new OperationController({
                mode: 'streaming',
                timeout: 5000,
                initialTimeout: 60000,
                heartbeatTimeout: 30000,
                hardTimeout: 120000,
                allowPartialOnStall: false
            });
            
            expect(controller.mode).toBe('streaming');
            expect(controller.timeout).toBe(5000);
            expect(controller.initialTimeout).toBe(60000);
            expect(controller.heartbeatTimeout).toBe(30000);
            expect(controller.hardTimeout).toBe(120000);
            expect(controller.allowPartialOnStall).toBe(false);
        });

        test('provides access to AbortSignal', () => {
            const controller = new OperationController();
            expect(controller.signal).toBeDefined();
            expect(controller.signal.aborted).toBe(false);
        });
    });

    describe('recordActivity', () => {
        test('updates lastActivity timestamp', () => {
            const controller = new OperationController();
            const before = controller.lastActivity;
            
            jest.advanceTimersByTime(100);
            controller.recordActivity();
            
            expect(controller.lastActivity).toBeGreaterThan(before);
        });

        test('stores partial result', () => {
            const controller = new OperationController();
            
            controller.recordActivity('partial data');
            
            expect(controller.partialResult).toBe('partial data');
        });

        test('marks first activity received', () => {
            const controller = new OperationController();
            expect(controller.firstActivityReceived).toBe(false);
            
            controller.recordActivity();
            expect(controller.firstActivityReceived).toBe(true);
        });

        test('returns controller for chaining', () => {
            const controller = new OperationController();
            const result = controller.recordActivity();
            expect(result).toBe(controller);
        });
    });

    describe('simple mode', () => {
        test('completes successful operation', async () => {
            const controller = new OperationController({ timeout: 5000 });
            
            const result = await controller.run(
                async (signal) => 'success',
                'test-operation'
            );
            
            expect(result).toBe('success');
            expect(controller.status).toBe(OperationController.Status.COMPLETED);
        });

        test('passes signal to operation', async () => {
            const controller = new OperationController();
            let receivedSignal = null;
            
            await controller.run(async (signal) => {
                receivedSignal = signal;
            }, 'test');
            
            expect(receivedSignal).toBe(controller.signal);
        });

        test('passes controller to operation', async () => {
            const controller = new OperationController();
            let receivedController = null;
            
            await controller.run(async (signal, ctrl) => {
                receivedController = ctrl;
            }, 'test');
            
            expect(receivedController).toBe(controller);
        });

        test('times out operation after timeout ms', async () => {
            const controller = new OperationController({ timeout: 100 });
            
            let caughtError = null;
            
            controller.run(
                async (signal) => {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return 'should not reach';
                },
                'slow-operation'
            ).catch(err => {
                caughtError = err;
            });
            
            await jest.runAllTimersAsync();
            
            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toContain('timed out');
            expect(controller.status).toBe(OperationController.Status.TIMEOUT);
        });

        test('propagates operation errors', async () => {
            const controller = new OperationController();
            
            await expect(controller.run(
                async () => {
                    throw new Error('operation failed');
                },
                'failing-operation'
            )).rejects.toThrow('operation failed');
        });

        test('tracks elapsed time', async () => {
            const controller = new OperationController();
            
            const promise = controller.run(async () => {
                await new Promise(resolve => setTimeout(resolve, 500));
            }, 'test');
            
            await jest.runAllTimersAsync();
            await promise;
            
            expect(controller.elapsedMs).toBe(500);
        });

        test('throws if already in use', async () => {
            const controller = new OperationController({ timeout: 1000 });
            
            const promise = controller.run(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
            }, 'first');
            
            await expect(controller.run(async () => {}, 'second'))
                .rejects.toThrow('already in use');
            
            await jest.runAllTimersAsync();
            await promise.catch(() => {});
        });

        test('throws if operation is not a function', async () => {
            const controller = new OperationController();
            
            await expect(controller.run('not a function', 'test'))
                .rejects.toThrow('must be a function');
        });
    });

    describe('streaming mode', () => {
        test('completes streaming operation', async () => {
            const controller = new OperationController({ 
                mode: 'streaming',
                heartbeatTimeout: 1000,
                hardTimeout: 5000
            });
            
            const promise = controller.runStreaming(async (signal, ctrl) => {
                ctrl.recordActivity('chunk1');
                await new Promise(resolve => setTimeout(resolve, 500));
                ctrl.recordActivity('chunk2');
                await new Promise(resolve => setTimeout(resolve, 500));
                return 'final result';
            }, 'streaming-test');
            
            await jest.runAllTimersAsync();
            
            const result = await promise;
            expect(result).toBe('final result');
            expect(controller.status).toBe(OperationController.Status.COMPLETED);
        });

        test('detects stall and rejects when no partial result', async () => {
            const controller = new OperationController({ 
                mode: 'streaming',
                heartbeatTimeout: 50,
                hardTimeout: 5000
            });
            
            let caughtError = null;
            
            controller.runStreaming(async (signal, ctrl) => {
                ctrl.recordActivity();
                await new Promise(resolve => setTimeout(resolve, 10000));
            }, 'stalling-operation').catch(err => {
                caughtError = err;
            });
            
            await jest.runAllTimersAsync();
            
            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toContain('stalled');
            expect(controller.status).toBe(OperationController.Status.TIMEOUT);
        });

        test('resolves with partial result on stall', async () => {
            const controller = new OperationController({ 
                mode: 'streaming',
                heartbeatTimeout: 50,
                hardTimeout: 5000
            });
            
            let result = null;
            
            controller.runStreaming(async (signal, ctrl) => {
                ctrl.recordActivity('partial data here');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }, 'stall-with-partial').then(r => {
                result = r;
            });
            
            await jest.runAllTimersAsync();
            
            expect(result).toBe('partial data here');
            expect(controller.status).toBe(OperationController.Status.COMPLETED);
        });

        test('rejects on stall when partial results are disallowed', async () => {
            const controller = new OperationController({
                mode: 'streaming',
                heartbeatTimeout: 50,
                hardTimeout: 5000,
                allowPartialOnStall: false
            });

            let caughtError = null;
            controller.runStreaming(async (signal, ctrl) => {
                ctrl.recordActivity('partial data here');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }, 'stall-with-partial-blocked').catch(err => {
                caughtError = err;
            });

            await jest.runAllTimersAsync();

            expect(caughtError).not.toBeNull();
            expect(caughtError.code).toBe('ESTALL');
            expect(caughtError.message).toContain('partial response blocked');
            expect(caughtError.hasPartialResult).toBe(true);
            expect(controller.status).toBe(OperationController.Status.TIMEOUT);
        });

        test('uses initial timeout before first activity', async () => {
            const controller = new OperationController({ 
                mode: 'streaming',
                initialTimeout: 50,
                heartbeatTimeout: 10,
                hardTimeout: 5000
            });
            
            let caughtError = null;
            
            controller.runStreaming(async (signal, ctrl) => {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }, 'no-activity').catch(err => {
                caughtError = err;
            });
            
            await jest.runAllTimersAsync();
            
            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toContain('stalled');
        });

        test('uses heartbeat timeout after first activity', async () => {
            const controller = new OperationController({ 
                mode: 'streaming',
                initialTimeout: 5000,
                heartbeatTimeout: 50,
                hardTimeout: 5000
            });
            
            let caughtError = null;
            
            controller.runStreaming(async (signal, ctrl) => {
                ctrl.recordActivity();
                await new Promise(resolve => setTimeout(resolve, 10000));
            }, 'stall-after-start').catch(err => {
                caughtError = err;
            });
            
            await jest.runAllTimersAsync();
            
            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toContain('stalled');
        });

        test('enforces hard timeout even with activity', async () => {
            const controller = new OperationController({ 
                mode: 'streaming',
                heartbeatTimeout: 1000,
                hardTimeout: 50
            });
            
            let caughtError = null;
            
            controller.runStreaming(async (signal, ctrl) => {
                const keepAlive = setInterval(() => {
                    ctrl.recordActivity('still going');
                }, 10);
                
                try {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } finally {
                    clearInterval(keepAlive);
                }
            }, 'never-completes').catch(err => {
                caughtError = err;
            });
            
            await jest.runAllTimersAsync();
            
            expect(caughtError).not.toBeNull();
            expect(caughtError.message).toContain('hard timeout');
            expect(controller.status).toBe(OperationController.Status.TIMEOUT);
        });
    });

    describe('abort', () => {
        test('can be aborted externally', async () => {
            const controller = new OperationController({ timeout: 10000 });
            
            const promise = controller.run(async (signal) => {
                await new Promise(resolve => setTimeout(resolve, 50000));
            }, 'abortable-operation');
            
            await Promise.resolve().then(() => {
                controller.abort('User cancelled');
            });
            
            await expect(promise).rejects.toThrow('User cancelled');
            expect(controller.status).toBe(OperationController.Status.ABORTED);
            expect(controller.isAborted).toBe(true);
        });

        test('cleanup happens on abort', async () => {
            const controller = new OperationController({ timeout: 5000 });
            
            const promise = controller.run(async () => {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }, 'test');
            
            await Promise.resolve().then(() => {
                controller.abort();
            });
            
            await expect(promise).rejects.toThrow();
            
            expect(controller._timeoutHandle).toBeNull();
        });
    });

    describe('reset', () => {
        test('resets controller to idle state', async () => {
            const controller = new OperationController();
            
            await controller.run(async () => 'done', 'test');
            expect(controller.status).toBe(OperationController.Status.COMPLETED);
            
            controller.reset();
            
            expect(controller.status).toBe(OperationController.Status.IDLE);
            expect(controller.partialResult).toBeNull();
            expect(controller.firstActivityReceived).toBe(false);
            expect(controller.elapsedMs).toBe(0);
        });

        test('creates new AbortController if previously aborted', () => {
            const controller = new OperationController();
            
            const originalSignal = controller.signal;
            
            controller.abort('test abort');
            expect(controller.isAborted).toBe(true);
            
            controller.reset();
            
            expect(controller.isAborted).toBe(false);
            expect(controller.signal).not.toBe(originalSignal);
        });

        test('allows reuse after reset', async () => {
            const controller = new OperationController();
            
            await controller.run(async () => 'first', 'test1');
            controller.reset();
            
            const result = await controller.run(async () => 'second', 'test2');
            
            expect(result).toBe('second');
        });
    });

    describe('getStats', () => {
        test('returns current controller state', async () => {
            const controller = new OperationController({ mode: 'streaming' });
            
            const stats = controller.getStats();
            
            expect(stats.status).toBe(OperationController.Status.IDLE);
            expect(stats.mode).toBe('streaming');
            expect(stats.isAborted).toBe(false);
            expect(stats.hasPartialResult).toBe(false);
        });

        test('reflects running state', async () => {
            const controller = new OperationController();
            
            const promise = controller.run(async () => {
                const stats = controller.getStats();
                expect(stats.status).toBe(OperationController.Status.RUNNING);
                expect(stats.operation).toBe('test-op');
            }, 'test-op');
            
            await promise;
        });
    });

    describe('createController factory', () => {
        test('creates controller with options', () => {
            const controller = createController({ timeout: 5000 });
            expect(controller.timeout).toBe(5000);
            expect(controller).toBeInstanceOf(OperationController);
        });
    });
});
