import { describe, it, expect } from '@jest/globals';
import { sendData, sendSuccess, sendPaginated, sendError } from '../utils/responseHelpers.mjs';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('responseHelpers', () => {
  describe('sendData', () => {
    it('sends data with default 200 status', () => {
      const res = mockRes();
      sendData(res, { id: 1, name: 'test' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ id: 1, name: 'test' });
    });

    it('sends data with custom status', () => {
      const res = mockRes();
      sendData(res, { id: 1 }, 201);
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ id: 1 });
    });

    it('sends arrays directly', () => {
      const res = mockRes();
      sendData(res, [{ id: 1 }, { id: 2 }]);
      expect(res.body).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('sendSuccess', () => {
    it('sends success envelope with data', () => {
      const res = mockRes();
      sendSuccess(res, { username: 'admin' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, username: 'admin' });
    });

    it('sends success envelope without extra data', () => {
      const res = mockRes();
      sendSuccess(res);
      expect(res.body).toEqual({ success: true });
    });

    it('sends success envelope with custom status', () => {
      const res = mockRes();
      sendSuccess(res, { id: 5 }, 201);
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ success: true, id: 5 });
    });

    it('sends success envelope with multiple fields', () => {
      const res = mockRes();
      sendSuccess(res, { deleted: true, count: 3 });
      expect(res.body).toEqual({ success: true, deleted: true, count: 3 });
    });
  });

  describe('sendPaginated', () => {
    it('sends paginated response with correct shape', () => {
      const res = mockRes();
      sendPaginated(res, [{ id: 1 }, { id: 2 }], { page: 1, limit: 10, total: 25 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        data: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
      });
    });

    it('calculates totalPages correctly', () => {
      const res = mockRes();
      sendPaginated(res, [], { page: 1, limit: 20, total: 41 });
      expect(res.body.pagination.totalPages).toBe(3);
    });

    it('handles exact page boundary', () => {
      const res = mockRes();
      sendPaginated(res, [], { page: 2, limit: 10, total: 20 });
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('defaults totalPages to 1 when total is 0', () => {
      const res = mockRes();
      sendPaginated(res, [], { page: 1, limit: 10, total: 0 });
      expect(res.body.pagination.totalPages).toBe(1);
    });

    it('sends empty data array when no items', () => {
      const res = mockRes();
      sendPaginated(res, [], { page: 1, limit: 50, total: 0 });
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  describe('sendError', () => {
    it('sends error with default 400 status', () => {
      const res = mockRes();
      sendError(res, 'Invalid input');
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid input' });
    });

    it('sends error with custom status', () => {
      const res = mockRes();
      sendError(res, 'Not found', 404);
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    it('sends error with extra fields', () => {
      const res = mockRes();
      sendError(res, 'Conflict', 409, { code: 'DUPLICATE', currentStatus: 'active' });
      expect(res.statusCode).toBe(409);
      expect(res.body).toEqual({
        error: 'Conflict',
        code: 'DUPLICATE',
        currentStatus: 'active',
      });
    });
  });
});
