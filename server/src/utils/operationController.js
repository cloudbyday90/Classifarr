const logger = require('./logger').createLogger('OperationController');

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_INITIAL_TIMEOUT_MS = 120000;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60000;
const DEFAULT_HARD_TIMEOUT_MS = 300000;

function calculateHeartbeatCheckInterval(heartbeatTimeout, initialTimeout) {
    const minTimeout = Math.min(heartbeatTimeout, initialTimeout);
    return Math.max(100, Math.floor(minTimeout / 10));
}

class OperationController {
    static get Status() {
        return {
            IDLE: 'idle',
            RUNNING: 'running',
            COMPLETED: 'completed',
            ABORTED: 'aborted',
            TIMEOUT: 'timeout'
        };
    }

    constructor(options = {}) {
        this.mode = options.mode || 'simple';
        this.timeout = options.timeout || DEFAULT_TIMEOUT_MS;
        this.abortController = new AbortController();
        
        this.initialTimeout = options.initialTimeout || DEFAULT_INITIAL_TIMEOUT_MS;
        this.heartbeatTimeout = options.heartbeatTimeout || DEFAULT_HEARTBEAT_TIMEOUT_MS;
        this.hardTimeout = options.hardTimeout || DEFAULT_HARD_TIMEOUT_MS;
        
        this.status = OperationController.Status.IDLE;
        this.lastActivity = Date.now();
        this.partialResult = null;
        this.firstActivityReceived = false;
        
        this._operationName = null;
        this._startTime = null;
        this._timeoutHandle = null;
        this._heartbeatInterval = null;
        this._hardTimeoutHandle = null;
        this._resolveReject = null;
    }

    get signal() {
        return this.abortController.signal;
    }

    get isAborted() {
        return this.abortController.signal.aborted;
    }

    get elapsedMs() {
        if (!this._startTime) return 0;
        return Date.now() - this._startTime;
    }

    recordActivity(partialResult = undefined) {
        this.lastActivity = Date.now();
        this.firstActivityReceived = true;
        
        if (partialResult !== undefined) {
            this.partialResult = partialResult;
        }
        
        return this;
    }

    abort(reason = 'Operation aborted') {
        if (this.status === OperationController.Status.COMPLETED ||
            this.status === OperationController.Status.ABORTED ||
            this.status === OperationController.Status.TIMEOUT) {
            return;
        }
        
        this.status = OperationController.Status.ABORTED;
        this._cleanup();
        
        const error = new Error(reason);
        error.name = 'AbortError';
        error.code = 'ABORT_ERR';
        
        this.abortController.abort(reason);
        
        if (this._resolveReject) {
            this._resolveReject.reject(error);
        }
        
        logger.debug('Operation aborted', {
            operation: this._operationName,
            elapsedMs: this.elapsedMs,
            reason
        });
    }

    async run(operation, operationName = 'unnamed') {
        if (this.status !== OperationController.Status.IDLE) {
            throw new Error(`OperationController already in use (status: ${this.status})`);
        }
        
        if (typeof operation !== 'function') {
            throw new Error('Operation must be a function');
        }
        
        this._operationName = operationName;
        this._startTime = Date.now();
        this.status = OperationController.Status.RUNNING;
        this.lastActivity = Date.now();
        
        return new Promise(async (resolve, reject) => {
            this._resolveReject = { resolve, reject };
            
            this._setupTimeouts();
            
            try {
                const result = await operation(this.signal, this);
                
                if (this.status === OperationController.Status.RUNNING) {
                    this.status = OperationController.Status.COMPLETED;
                    this._cleanup();
                    
                    logger.debug('Operation completed', {
                        operation: this._operationName,
                        elapsedMs: this.elapsedMs
                    });
                    
                    resolve(result);
                }
            } catch (error) {
                if (this.status === OperationController.Status.RUNNING) {
                    this._cleanup();
                    
                    if (error.name === 'AbortError' || this.isAborted) {
                        this.status = OperationController.Status.ABORTED;
                        logger.debug('Operation aborted via signal', {
                            operation: this._operationName,
                            elapsedMs: this.elapsedMs
                        });
                    } else {
                        this.status = OperationController.Status.COMPLETED;
                        logger.debug('Operation failed with error', {
                            operation: this._operationName,
                            elapsedMs: this.elapsedMs,
                            error: error.message
                        });
                    }
                    
                    reject(error);
                }
            }
        });
    }

    runStreaming(operation, operationName = 'unnamed') {
        if (this.mode !== 'streaming') {
            this.mode = 'streaming';
        }
        return this.run(operation, operationName);
    }

    _setupTimeouts() {
        if (this.mode === 'streaming') {
            this._setupStreamingTimeouts();
        } else {
            this._setupSimpleTimeout();
        }
    }

    _setupSimpleTimeout() {
        this._timeoutHandle = setTimeout(() => {
            if (this.status !== OperationController.Status.RUNNING) return;
            
            this.status = OperationController.Status.TIMEOUT;
            
            const error = new Error(`${this._operationName} timed out after ${this.timeout}ms`);
            error.name = 'TimeoutError';
            error.code = 'ETIMEDOUT';
            
            this.abortController.abort(error.message);
            this._cleanup();
            
            if (this._resolveReject) {
                this._resolveReject.reject(error);
            }
            
            logger.warn('Operation timed out', {
                operation: this._operationName,
                timeoutMs: this.timeout,
                elapsedMs: this.elapsedMs
            });
        }, this.timeout);
    }

    _setupStreamingTimeouts() {
        this._hardTimeoutHandle = setTimeout(() => {
            if (this.status !== OperationController.Status.RUNNING) return;
            
            this.status = OperationController.Status.TIMEOUT;
            
            const error = new Error(`${this._operationName} hard timeout - no completion after ${this.hardTimeout}ms`);
            error.name = 'TimeoutError';
            error.code = 'ETIMEDOUT';
            
            this.abortController.abort(error.message);
            this._cleanup();
            
            if (this._resolveReject) {
                this._resolveReject.reject(error);
            }
            
            logger.warn('Operation hard timeout', {
                operation: this._operationName,
                hardTimeoutMs: this.hardTimeout,
                elapsedMs: this.elapsedMs
            });
        }, this.hardTimeout);
        
        const checkInterval = calculateHeartbeatCheckInterval(this.heartbeatTimeout, this.initialTimeout);
        
        this._heartbeatInterval = setInterval(() => {
            if (this.status !== OperationController.Status.RUNNING) return;
            
            const timeSinceLastActivity = Date.now() - this.lastActivity;
            const currentTimeout = this.firstActivityReceived 
                ? this.heartbeatTimeout 
                : this.initialTimeout;
            
            if (timeSinceLastActivity > currentTimeout) {
                const waitedSeconds = Math.round(timeSinceLastActivity / 1000);
                
                if (this.partialResult !== null) {
                    this.status = OperationController.Status.COMPLETED;
                    this._cleanup();
                    
                    logger.info('Operation completed with partial result after stall', {
                        operation: this._operationName,
                        stalledForMs: timeSinceLastActivity,
                        partialResultType: typeof this.partialResult
                    });
                    
                    if (this._resolveReject) {
                        this._resolveReject.resolve(this.partialResult);
                    }
                } else {
                    this.status = OperationController.Status.TIMEOUT;
                    
                    const error = new Error(
                        `${this._operationName} stalled - no activity for ${waitedSeconds} seconds`
                    );
                    error.name = 'TimeoutError';
                    error.code = 'ESTALL';
                    
                    this.abortController.abort(error.message);
                    this._cleanup();
                    
                    if (this._resolveReject) {
                        this._resolveReject.reject(error);
                    }
                    
                    logger.warn('Operation stalled', {
                        operation: this._operationName,
                        stalledForMs: timeSinceLastActivity,
                        initialActivity: !this.firstActivityReceived
                    });
                }
            }
        }, checkInterval);
    }

    _cleanup() {
        if (this._timeoutHandle) {
            clearTimeout(this._timeoutHandle);
            this._timeoutHandle = null;
        }
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
        if (this._hardTimeoutHandle) {
            clearTimeout(this._hardTimeoutHandle);
            this._hardTimeoutHandle = null;
        }
    }

    reset() {
        this._cleanup();
        
        this.status = OperationController.Status.IDLE;
        this.lastActivity = Date.now();
        this.partialResult = null;
        this.firstActivityReceived = false;
        this._operationName = null;
        this._startTime = null;
        this._resolveReject = null;
        
        if (this.abortController.signal.aborted) {
            this.abortController = new AbortController();
        }
        
        return this;
    }

    getStats() {
        return {
            operation: this._operationName,
            status: this.status,
            mode: this.mode,
            elapsedMs: this.elapsedMs,
            isAborted: this.isAborted,
            hasPartialResult: this.partialResult !== null,
            firstActivityReceived: this.firstActivityReceived
        };
    }
}

function createController(options = {}) {
    return new OperationController(options);
}

module.exports = {
    OperationController,
    createController,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_INITIAL_TIMEOUT_MS,
    DEFAULT_HEARTBEAT_TIMEOUT_MS,
    DEFAULT_HARD_TIMEOUT_MS
};
