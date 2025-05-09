document.addEventListener('DOMContentLoaded', () => {
  // Initialize the application
  const app = new TaskTonicApp();
  app.init();
});

class TaskTonicApp {
  constructor() {
    // DOM Elements
    this.taskForm = document.getElementById('task-form');
    this.taskInput = document.getElementById('task-input');
    this.moodSelect = document.getElementById('mood-select');
    this.prioritySelect = document.getElementById('priority-select');
    this.dueDate = document.getElementById('due-date');
    this.notesInput = document.getElementById('notes-input');
    this.taskList = document.getElementById('task-list');
    this.taskBoard = document.getElementById('task-board');
    this.moodBooster = document.getElementById('mood-booster');
    this.quickTaskInput = document.getElementById('quick-task-input');
    this.quickAddBtn = document.getElementById('quick-add-btn');
    this.showTaskFormBtn = document.getElementById('show-task-form');
    this.cancelTaskBtn = document.getElementById('cancel-task');
    this.searchInput = document.getElementById('search-input');
    this.sortSelect = document.getElementById('sort-select');

    // View elements
    this.viewButtons = document.querySelectorAll('.view-options button');

    // Modal elements
    this.taskDetailModal = document.getElementById('task-detail-modal');
    this.taskEditForm = document.getElementById('task-edit-form');
    this.pomodoroModal = document.getElementById('pomodoro-modal');
    this.closeModalButtons = document.querySelectorAll('.close-modal');

    // State
    this.tasks = [];
    this.tags = [];
    this.currentFilter = 'all';
    this.currentView = 'list';
    this.currentSort = 'priority';
    this.searchQuery = '';
    this.darkMode = false;
    this.completedToday = []; // Track completed tasks

    // Pomodoro state
    this.pomodoro = {
      isRunning: false,
      isPause: false,
      currentTime: 25 * 60, // 25 minutes in seconds
      workTime: 25 * 60,
      breakTime: 5 * 60,
      longBreakTime: 15 * 60,
      sessionsCount: 4,
      currentSession: 1,
      timer: null,
      selectedTaskId: null
    };
  }

  async init() {
    // Load user preferences
    this.loadPreferences();

    // Set up event listeners
    this.setupEventListeners();

    // Load data
    await this.loadTasks();
    await this.loadTags();

    // Update UI
    this.renderTasks();
    this.renderCompletedToday(); // Render completed tasks section
    this.updateStatistics();
    this.updateMoodBooster();

    // Initialize Pomodoro
    this.initPomodoro();

    console.log('TaskTonic app initialized! 💊');
  }

  loadPreferences() {
    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
      this.toggleDarkMode();
    }

    // Load view preference
    const savedView = localStorage.getItem('currentView') || 'list';
    this.currentView = savedView;
    this.updateViewButtons();

    // Load sort preference
    const savedSort = localStorage.getItem('currentSort') || 'priority';
    this.currentSort = savedSort;
    this.sortSelect.value = this.currentSort;
  }

  setupEventListeners() {
    // Task form event listeners
    this.taskForm.addEventListener('submit', (e) => this.handleTaskSubmit(e));
    this.showTaskFormBtn.addEventListener('click', () => this.toggleTaskForm());
    this.cancelTaskBtn.addEventListener('click', () => this.toggleTaskForm());

    // Quick add task
    this.quickAddBtn.addEventListener('click', () => this.handleQuickAddTask());
    this.quickTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleQuickAddTask();
    });

    // Filter listeners
    document.querySelectorAll('.filters li').forEach(item => {
      item.addEventListener('click', () => this.handleFilterChange(item.dataset.filter));
    });

    // Search listener
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.toLowerCase();
      this.renderTasks();
    });

    // Sort listener
    this.sortSelect.addEventListener('change', () => {
      this.currentSort = this.sortSelect.value;
      localStorage.setItem('currentSort', this.currentSort);
      this.renderTasks();
    });

    // View listeners
    this.viewButtons.forEach(button => {
      button.addEventListener('click', () => this.handleViewChange(button.dataset.view));
    });

    // Task edit form listener
    this.taskEditForm.addEventListener('submit', (e) => this.handleEditTaskSubmit(e));

    // Dark mode toggle
    document.querySelector('.toggle-theme').addEventListener('click', () => this.toggleDarkMode());

    // Add tag listener
    document.getElementById('add-tag-btn').addEventListener('click', () => this.addNewTag());
    document.getElementById('new-tag-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addNewTag();
      }
    });

    // Close modals
    this.closeModalButtons.forEach(button => {
      button.addEventListener('click', () => this.closeAllModals());
    });

    // Pomodoro controls
    document.getElementById('timer-start').addEventListener('click', () => this.startPomodoro());
    document.getElementById('timer-pause').addEventListener('click', () => this.pausePomodoro());
    document.getElementById('timer-reset').addEventListener('click', () => this.resetPomodoro());

    // Pomodoro settings
    document.getElementById('work-time').addEventListener('change', (e) => {
      this.pomodoro.workTime = parseInt(e.target.value) * 60;
      this.savePomodoroSettings();
    });

    document.getElementById('break-time').addEventListener('change', (e) => {
      this.pomodoro.breakTime = parseInt(e.target.value) * 60;
      this.savePomodoroSettings();
    });

    document.getElementById('long-break-time').addEventListener('change', (e) => {
      this.pomodoro.longBreakTime = parseInt(e.target.value) * 60;
      this.savePomodoroSettings();
    });

    document.getElementById('sessions-count').addEventListener('change', (e) => {
      this.pomodoro.sessionsCount = parseInt(e.target.value);
      this.savePomodoroSettings();
      this.updateSessionIndicators();
    });

    // Delete task button in modal
    document.getElementById('delete-task-btn').addEventListener('click', () => {
      const taskId = parseInt(document.getElementById('edit-task-id').value);
      this.deleteTask(taskId);
    });
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark-theme', this.darkMode);
    localStorage.setItem('darkMode', this.darkMode);

    // Update icon
    const themeIcon = document.querySelector('.toggle-theme i');
    themeIcon.className = this.darkMode ? 'fas fa-sun' : 'fas fa-moon';
  }

  toggleTaskForm() {
    const form = this.taskForm;
    const showButton = this.showTaskFormBtn;

    if (form.classList.contains('hidden')) {
      // Show form
      form.classList.remove('hidden');
      showButton.classList.add('hidden');
      // Focus on input
      this.taskInput.focus();
    } else {
      // Hide form and reset
      form.classList.add('hidden');
      showButton.classList.remove('hidden');
      form.reset();
    }
  }

  async loadTasks() {
    try {
      const response = await fetch('/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      this.tasks = await response.json();

      // Initialize completedToday with any already completed tasks
      this.completedToday = this.tasks.filter(task => task.completed);
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.showNotification('Failed to load tasks. Please try again.', 'error');
    }
  }

  async loadTags() {
    try {
      const response = await fetch('/tags');
      if (!response.ok) {
        this.extractTagsFromTasks();
        return;
      }
      this.tags = await response.json();
      this.renderTags();
    } catch (error) {
      console.error('Error loading tags:', error);
      this.extractTagsFromTasks();
    }
  }

  extractTagsFromTasks() {
    const tagsSet = new Set();
    this.tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    this.tags = Array.from(tagsSet);
    this.renderTags();
  }

  renderTags() {
    const tagsList = document.getElementById('tags-list');
    const tagsSelect = document.getElementById('tags-select');
    const editTagsSelect = document.getElementById('edit-tags-select');

    // Clear existing tags
    tagsList.innerHTML = '';
    tagsSelect.innerHTML = '';
    editTagsSelect.innerHTML = '';

    // Render tags in sidebar
    this.tags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      tagElement.addEventListener('click', () => this.handleTagFilter(tag));
      tagsList.appendChild(tagElement);

      // Add to select options
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagsSelect.appendChild(option.cloneNode(true));
      editTagsSelect.appendChild(option);
    });
  }

  async addNewTag() {
    const input = document.getElementById('new-tag-input');
    const tag = input.value.trim();

    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.renderTags();
      input.value = '';

      try {
        await fetch('/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag })
        });
      } catch (error) {
        console.error('Error saving tag:', error);
      }
    }
  }

  handleFilterChange(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.filters li').forEach(item => {
      item.classList.toggle('active', item.dataset.filter === filter);
    });
    document.querySelectorAll('.tag').forEach(tag => {
      tag.classList.remove('active');
    });
    this.renderTasks();
  }

  handleTagFilter(tag) {
    const tagElements = document.querySelectorAll('.tag');
    let activeTag = null;

    tagElements.forEach(element => {
      if (element.textContent === tag) {
        const isActive = element.classList.toggle('active');
        if (isActive) activeTag = tag;
      } else {
        element.classList.remove('active');
      }
    });

    if (activeTag) {
      this.currentFilter = `tag:${activeTag}`;
    } else {
      this.currentFilter = 'all';
      document.querySelector('[data-filter="all"]').classList.add('active');
    }

    this.renderTasks();
  }

  handleViewChange(view) {
    this.currentView = view;
    localStorage.setItem('currentView', view);
    this.updateViewButtons();

    if (view === 'list') {
      this.taskList.classList.remove('hidden');
      this.taskBoard.classList.add('hidden');
    } else {
      this.taskList.classList.add('hidden');
      this.taskBoard.classList.remove('hidden');
      this.renderTaskBoard();
    }
  }

  updateViewButtons() {
    this.viewButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.view === this.currentView);
    });
  }

  async handleQuickAddTask() {
    const text = this.quickTaskInput.value.trim();
    if (!text) return;

    try {
      await this.addTask({
        text,
        mood: 'neutral',
        priority: 1,
        tags: []
      });
      this.quickTaskInput.value = '';
    } catch (error) {
      console.error('Error adding quick task:', error);
      this.showNotification('Failed to add task. Please try again.', 'error');
    }
  }

  async handleTaskSubmit(e) {
    e.preventDefault();

    const selectedTags = Array.from(document.getElementById('selected-tags').children).map(
      tag => tag.dataset.tag
    );

    const taskData = {
      text: this.taskInput.value.trim(),
      mood: this.moodSelect.value,
      priority: parseInt(this.prioritySelect.value),
      dueDate: this.dueDate.value || null,
      notes: this.notesInput.value.trim(),
      tags: selectedTags
    };

    try {
      await this.addTask(taskData);
      this.toggleTaskForm();
    } catch (error) {
      console.error('Error adding task:', error);
      this.showNotification('Failed to add task. Please try again.', 'error');
    }
  }

  async handleEditTaskSubmit(e) {
    e.preventDefault();

    const taskId = parseInt(document.getElementById('edit-task-id').value);
    const taskText = document.getElementById('edit-task-text').value.trim();
    const taskMood = document.getElementById('edit-mood-select').value;
    const taskPriority = parseInt(document.getElementById('edit-priority-select').value);
    const taskDueDate = document.getElementById('edit-due-date').value || null;
    const taskNotes = document.getElementById('edit-notes-input').value.trim();
    const taskStatus = document.getElementById('edit-status-select').value;

    const selectedTags = Array.from(document.getElementById('edit-selected-tags').children).map(
      tag => tag.dataset.tag
    );

    const taskData = {
      text: taskText,
      mood: taskMood,
      priority: taskPriority,
      dueDate: taskDueDate,
      notes: taskNotes,
      tags: selectedTags,
      completed: taskStatus === 'done'
    };

    try {
      await this.updateTask(taskId, taskData);
      this.closeAllModals();
    } catch (error) {
      console.error('Error updating task:', error);
      this.showNotification('Failed to update task. Please try again.', 'error');
    }
  }

  async addTask(taskData) {
    try {
      const response = await fetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error('Failed to add task');
      }

      const newTask = await response.json();
      this.tasks.push(newTask);

      this.renderTasks();
      this.updateStatistics();
      this.updateMoodBooster();

      this.showNotification('Task added successfully!', 'success');
      return newTask;
    } catch (error) {
      console.error('Error adding task:', error);
      this.showNotification('Failed to add task. Please try again.', 'error');
      throw error;
    }
  }

  async updateTask(taskId, taskData) {
    try {
      const response = await fetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const updatedTask = await response.json();
      const index = this.tasks.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.tasks[index] = updatedTask;
      }

      // Update completedToday array if completion status changed
      if (taskData.completed !== undefined) {
        if (taskData.completed) {
          // Add to completedToday if not already there
          if (!this.completedToday.some(t => t.id === taskId)) {
            this.completedToday.unshift({
              ...updatedTask,
              completedDate: new Date().toISOString()
            });
          }
        } else {
          // Remove from completedToday if being unmarked
          this.completedToday = this.completedToday.filter(t => t.id !== taskId);
        }
      }

      this.renderTasks();
      this.renderCompletedToday();
      this.updateStatistics();
      this.updateMoodBooster();

      this.showNotification('Task updated successfully!', 'success');
      return updatedTask;
    } catch (error) {
      console.error('Error updating task:', error);
      this.showNotification('Failed to update task. Please try again.', 'error');
      throw error;
    }
  }

  async deleteTask(taskId) {
    try {
      const response = await fetch(`/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Remove the task from both arrays
      this.tasks = this.tasks.filter(task => task.id !== taskId);
      this.completedToday = this.completedToday.filter(task => task.id !== taskId);

      this.renderTasks();
      this.renderCompletedToday();
      this.updateStatistics();
      this.updateMoodBooster();
      this.closeAllModals();

      this.showNotification('Task deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      this.showNotification('Failed to delete task. Please try again.', 'error');
    }
  }

  renderTasks() {
    // Filter tasks based on current filter and search query
    let filteredTasks = [...this.tasks];

    // Apply filter
    if (this.currentFilter === 'completed') {
      filteredTasks = filteredTasks.filter(task => task.completed);
    } else if (this.currentFilter === 'active') {
      filteredTasks = filteredTasks.filter(task => !task.completed);
    } else if (this.currentFilter.startsWith('tag:')) {
      const tag = this.currentFilter.split(':')[1];
      filteredTasks = filteredTasks.filter(task => task.tags && task.tags.includes(tag));
    } else if (['energizing', 'neutral', 'draining'].includes(this.currentFilter)) {
      filteredTasks = filteredTasks.filter(task => task.mood === this.currentFilter);
    }

    // Apply search
    if (this.searchQuery) {
      filteredTasks = filteredTasks.filter(task => 
        task.text.toLowerCase().includes(this.searchQuery) ||
        (task.notes && task.notes.toLowerCase().includes(this.searchQuery))
      );
    }

    // Sort tasks
    filteredTasks.sort((a, b) => {
      if (this.currentSort === 'priority') {
        return (b.priority || 0) - (a.priority || 0);
      } else if (this.currentSort === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      } else if (this.currentSort === 'created') {
        return b.id - a.id;
      }
      return 0;
    });

    // Clear the task list
    this.taskList.innerHTML = '';

    // Render each task
    filteredTasks.forEach(task => {
      const taskElement = this.createTaskElement(task);
      this.taskList.appendChild(taskElement);
    });

    // Update task count
    document.getElementById('task-count').textContent = filteredTasks.length;
  }

  createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = `task ${task.completed ? 'completed' : ''} ${task.mood || 'neutral'}`;
    taskElement.dataset.id = task.id;

    // Priority indicator
    const priorityClass = ['low', 'medium', 'high'][task.priority || 0];
    const priorityText = ['Low', 'Medium', 'High'][task.priority || 0];

    // Due date formatting
    let dueDateText = '';
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dueDate < today && !task.completed) {
        dueDateText = `<span class="due-date overdue">Overdue: ${dueDate.toLocaleDateString()}</span>`;
      } else {
        dueDateText = `<span class="due-date">Due: ${dueDate.toLocaleDateString()}</span>`;
      }
    }

    // Tags display
    let tagsHtml = '';
    if (task.tags && task.tags.length > 0) {
      tagsHtml = `<div class="task-tags">${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`;
    }

    taskElement.innerHTML = `
      <div class="task-checkbox">
        <input type="checkbox" ${task.completed ? 'checked' : ''}>
      </div>
      <div class="task-content">
        <div class="task-header">
          <h3 class="task-title">${task.text}</h3>
          <span class="priority ${priorityClass}">${priorityText}</span>
        </div>
        ${tagsHtml}
        <div class="task-footer">
          ${dueDateText}
          <div class="task-actions">
            <button class="edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            <button class="pomodoro-btn" title="Start Pomodoro"><i class="fas fa-clock"></i></button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const checkbox = taskElement.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => this.toggleTaskCompletion(task.id, checkbox.checked));

    const editBtn = taskElement.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => this.showEditModal(task.id));

    const deleteBtn = taskElement.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

    const pomodoroBtn = taskElement.querySelector('.pomodoro-btn');
    pomodoroBtn.addEventListener('click', () => this.startPomodoroForTask(task.id));

    return taskElement;
  }

  renderCompletedToday() {
    const completedContainer = document.getElementById('completed-today-container');
    if (!completedContainer) return;

    // Filter tasks completed today
    const today = new Date().toISOString().split('T')[0];
    const todayCompleted = this.completedToday.filter(task => {
      return task.completedDate && task.completedDate.startsWith(today);
    });

    if (todayCompleted.length === 0) {
      completedContainer.innerHTML = '<p>No tasks completed today yet.</p>';
      return;
    }

    completedContainer.innerHTML = `
      <h3>Completed Today (${todayCompleted.length})</h3>
      <div id="completed-today-list"></div>
    `;

    const completedList = document.getElementById('completed-today-list');
    todayCompleted.forEach(task => {
      const taskElement = document.createElement('div');
      taskElement.className = 'completed-task';
      taskElement.innerHTML = `
        <span class="completed-task-text">${task.text}</span>
        <button class="delete-completed-btn" data-id="${task.id}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      `;

      // Add delete event listener
      const deleteBtn = taskElement.querySelector('.delete-completed-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTask(task.id);
      });

      completedList.appendChild(taskElement);
    });
  }

  updateStatistics() {
    const totalTasks = this.tasks.length;
    const completedTasks = this.tasks.filter(task => task.completed).length;
    const activeTasks = totalTasks - completedTasks;

    // Calculate completion rate (percentage)
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Update stats display
    document.getElementById('total-tasks').textContent = totalTasks;
    document.getElementById('completed-tasks').textContent = completedTasks;
    document.getElementById('active-tasks').textContent = activeTasks;
    document.getElementById('completion-rate').textContent = `${completionRate}%`;

    // Update progress bar
    document.getElementById('completion-progress').style.width = `${completionRate}%`;
  }

  // ... (rest of the existing methods remain the same)
}