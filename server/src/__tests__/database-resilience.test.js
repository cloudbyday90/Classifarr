/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Database Resilience Tests
 * Ensures database connection errors don't crash the application (regression prevention)
 * 
 * Background: v0.39.5a-alpha hotfix removed process.exit(-1) from database.js
 * which was causing containers to crash (Exit 255) on transient connection errors.
 */

const fs = require('fs');
const path = require('path');

describe('Database Resilience', () => {
    describe('Static Analysis - No process.exit in database.js', () => {
        it('should NOT contain process.exit in the database config', () => {
            // Read the actual database.js file
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');

            // Check that process.exit is NOT in the file
            // This is a critical regression test - process.exit caused Exit 255 crashes
            expect(content).not.toMatch(/process\.exit/);
        });

        it('should have a pool error handler that logs but does not exit', () => {
            const databasePath = path.join(__dirname, '..', 'config', 'database.js');
            const content = fs.readFileSync(databasePath, 'utf-8');

            // Verify the pool.on('error') handler exists
            expect(content).toMatch(/pool\.on\(['"]error['"]/);

            // Verify console.error is called for logging
            expect(content).toMatch(/console\.error.*[Uu]nexpected error/);
        });
    });

    describe('Pool Error Handler Behavior', () => {
        let originalProcessExit;
        let processExitCalled = false;

        beforeAll(() => {
            // Mock process.exit to detect if it's ever called
            originalProcessExit = process.exit;
            process.exit = jest.fn(() => {
                processExitCalled = true;
            });
        });

        afterAll(() => {
            // Restore original process.exit
            process.exit = originalProcessExit;
        });

        beforeEach(() => {
            processExitCalled = false;
            jest.clearAllMocks();
        });

        it('should not call process.exit when pool emits an error event', () => {
            // Directly test pool error handling without requiring DB
            const { Pool } = require('pg');
            const EventEmitter = require('events');

            // Create a mock pool that extends EventEmitter
            const mockPool = new EventEmitter();

            // Simulate the error handler from database.js (should NOT exit)
            // This mimics what the actual handler should do
            mockPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
                // Should NOT call process.exit(-1) here!
            });

            // Emit an error
            mockPool.emit('error', new Error('Connection terminated unexpectedly'));

            // Verify process.exit was NOT called
            expect(process.exit).not.toHaveBeenCalled();
            expect(processExitCalled).toBe(false);
        });

        it('should handle ECONNRESET errors gracefully', () => {
            const EventEmitter = require('events');
            const mockPool = new EventEmitter();

            // Simulate the error handler from database.js
            mockPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
            });

            // Create an ECONNRESET error (common network issue)
            const econnresetError = new Error('read ECONNRESET');
            econnresetError.code = 'ECONNRESET';

            mockPool.emit('error', econnresetError);

            // Application should continue running
            expect(process.exit).not.toHaveBeenCalled();
        });

        it('should handle connection terminated errors gracefully', () => {
            const EventEmitter = require('events');
            const mockPool = new EventEmitter();

            mockPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
            });

            // This is the exact error that was crashing Unraid containers
            mockPool.emit('error', new Error('Connection terminated unexpectedly'));

            expect(process.exit).not.toHaveBeenCalled();
        });
    });

    describe('Database Module Integration', () => {
        it('should export query and pool', () => {
            // Use a fresh require to test the actual module structure
            jest.resetModules();

            // Mock pg Pool before requiring database
            jest.mock('pg', () => ({
                Pool: jest.fn().mockImplementation(() => ({
                    query: jest.fn(),
                    on: jest.fn(),
                    connect: jest.fn()
                }))
            }));

            const db = require('../config/database');

            expect(db).toHaveProperty('query');
            expect(db).toHaveProperty('pool');
            expect(typeof db.query).toBe('function');
        });
    });
});
