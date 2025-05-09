// server.js - ENHANCED VERSION
const express = require('express');
const Database = require('@replit/database');
const db = new Database();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Caching mechanism for better performance
let tasksCache = null;
let lastCacheTime = null;
const CACHE_TTL = 30000; // 30 seconds cache lifetime

// Improved API Routes with error handling
app.get('/tasks', async (req, res) => {
  try {
    // Use cached data if available and fresh
    const now = Date.now();
    if (tasksCache && lastCacheTime && (now - lastCacheTime < CACHE_TTL)) {
      return res.json(tasksCache);
    }

    // Get tasks with optional filters
    const filter = req.query.filter; // completed, active, energizing, etc.
    let tasks = await db.get('tasks') || [];

    // Apply filters if provided
    if (filter === 'completed') {
      tasks = tasks.filter(t => t.completed);
    } else if (filter === 'active') {
      tasks = tasks.filter(t => !t.completed);
    } else if (['energizing', 'neutral', 'draining'].includes(filter)) {
      tasks = tasks.filter(t => t.mood === filter);
    }

    // Sort tasks (priority first, then creation date)
    tasks.sort((a, b) => {
      // Sort by priority first
      if ((a.priority || 0) !== (b.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0);
      }
      // Then by completion status
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      // Finally by creation date (newest first for same priority)
      return b.id - a.id;
    });

    // Update cache
    tasksCache = tasks;
    lastCacheTime = now;

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const tasks = await db.get('tasks') || [];

    // Enhanced task model
    const newTask = {
      id: Date.now(),
      text: req.body.text,
      mood: req.body.mood || 'neutral',
      priority: req.body.priority || 0,
      dueDate: req.body.dueDate || null,
      tags: req.body.tags || [],
      notes: req.body.notes || '',
      createdAt: Date.now(),
      completed: false,
      completedAt: null
    };

    tasks.push(newTask);
    await db.set('tasks', tasks);

    // Invalidate cache
    tasksCache = null;

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

app.patch('/tasks/:id', async (req, res) => {
  try {
    const tasks = await db.get('tasks') || [];
    const id = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[taskIndex];
    const updatedTask = { ...task };

    // Handle all possible updates
    if (req.body.text !== undefined) updatedTask.text = req.body.text;
    if (req.body.mood !== undefined) updatedTask.mood = req.body.mood;
    if (req.body.priority !== undefined) updatedTask.priority = req.body.priority;
    if (req.body.dueDate !== undefined) updatedTask.dueDate = req.body.dueDate;
    if (req.body.tags !== undefined) updatedTask.tags = req.body.tags;
    if (req.body.notes !== undefined) updatedTask.notes = req.body.notes;

    // Special handling for completion status
    if (req.body.completed !== undefined && updatedTask.completed !== req.body.completed) {
      updatedTask.completed = req.body.completed;
      updatedTask.completedAt = req.body.completed ? Date.now() : null;
    }

    tasks[taskIndex] = updatedTask;
    await db.set('tasks', tasks);

    // Invalidate cache
    tasksCache = null;

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    let tasks = await db.get('tasks') || [];
    const id = parseInt(req.params.id);

    const filteredTasks = tasks.filter(t => t.id !== id);

    if (filteredTasks.length === tasks.length) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.set('tasks', filteredTasks);

    // Invalidate cache
    tasksCache = null;

    res.sendStatus(200);
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// New endpoints for tags and statistics
app.get('/tags', async (req, res) => {
  try {
    const tasks = await db.get('tasks') || [];
    const tagsSet = new Set();

    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => tagsSet.add(tag));
      }
    });

    res.json(Array.from(tagsSet));
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to retrieve tags' });
  }
});

app.get('/statistics', async (req, res) => {
  try {
    const tasks = await db.get('tasks') || [];

    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      active: tasks.filter(t => !t.completed).length,
      byMood: {
        energizing: tasks.filter(t => t.mood === 'energizing').length,
        neutral: tasks.filter(t => t.mood === 'neutral').length,
        draining: tasks.filter(t => t.mood === 'draining').length
      },
      byPriority: {
        high: tasks.filter(t => t.priority >= 2).length,
        medium: tasks.filter(t => t.priority === 1).length,
        low: tasks.filter(t => t.priority === 0).length
      },
      overdue: tasks.filter(t => {
        return t.dueDate && !t.completed && new Date(t.dueDate) < new Date();
      }).length,
      dueToday: tasks.filter(t => {
        if (!t.dueDate || t.completed) return false;
        const dueDate = new Date(t.dueDate);
        const today = new Date();
        return dueDate.getDate() === today.getDate() &&
               dueDate.getMonth() === today.getMonth() &&
               dueDate.getFullYear() === today.getFullYear();
      }).length,
      completedToday: tasks.filter(t => {
        if (!t.completedAt) return false;
        const completedDate = new Date(t.completedAt);
        const today = new Date();
        return completedDate.getDate() === today.getDate() &&
               completedDate.getMonth() === today.getMonth() &&
               completedDate.getFullYear() === today.getFullYear();
      }).length
    };

    res.json(stats);
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

// Start server with better logging
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TaskTonic server running on port ${PORT}`);
  console.log(`📝 API endpoints available at http://localhost:${PORT}/tasks`);
});