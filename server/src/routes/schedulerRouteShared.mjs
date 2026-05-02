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

export function createSchedulerRouter({ express, schedulerService, logger }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const tasks = await schedulerService.getAllTasks();
      return res.json(tasks);
    } catch (error) {
      logger.error('Failed to get tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const task = await schedulerService.getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.json(task);
    } catch (error) {
      logger.error('Failed to get task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { name, task_type, library_id, interval_minutes, enabled } = req.body;

      if (!name || !task_type) {
        return res.status(400).json({ error: 'name and task_type are required' });
      }

      if (!interval_minutes || interval_minutes < 5) {
        return res.status(400).json({ error: 'interval_minutes must be at least 5' });
      }

      const task = await schedulerService.createTask({
        name,
        task_type,
        library_id,
        interval_minutes,
        enabled,
      });

      return res.status(201).json(task);
    } catch (error) {
      logger.error('Failed to create task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const task = await schedulerService.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.json(task);
    } catch (error) {
      logger.error('Failed to update task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await schedulerService.deleteTask(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/run', async (req, res) => {
    try {
      const result = await schedulerService.runNow(req.params.id);
      return res.json(result);
    } catch (error) {
      logger.error('Failed to run task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}