/* ==========================================================================
   TaskPulse - Smart AI-Powered To-Do & Reminder Application Logic
   ========================================================================== */

// --- App State ---
const state = {
    tasks: [],
    currentFilter: 'all', // 'all', 'today', 'upcoming', 'overdue', 'completed', 'high-priority'
    selectedCategory: 'all',
    searchQuery: '',
    sortBy: 'dueDate-asc',
    theme: localStorage.getItem('taskpulse_theme') || 'dark',
    soundEnabled: localStorage.getItem('taskpulse_sound') !== 'false',
    notificationsEnabled: Notification && Notification.permission === 'granted',
    streak: parseInt(localStorage.getItem('taskpulse_streak') || '1', 10),
    lastActiveDate: localStorage.getItem('taskpulse_last_active') || new Date().toDateString(),
    builderSubtasks: [] // Transient subtasks during modal task creation
};

// Default Pre-populated Sample Tasks for First-Time Experience
const defaultTasks = [
    {
        id: 'task-1',
        title: 'Review weekly project milestones',
        description: 'Check team deliverables and outline priority items for the upcoming sprint.',
        category: 'Work',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16),
        reminderMinutes: 30,
        completed: false,
        subtasks: [
            { id: 'sub-1', title: 'Check Jira board', completed: true },
            { id: 'sub-2', title: 'Draft progress summary email', completed: false }
        ],
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString()
    },
    {
        id: 'task-2',
        title: 'Complete 30-minute evening walk & stretch',
        description: 'Stay active and hit daily fitness goal.',
        category: 'Health',
        priority: 'medium',
        dueDate: new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 16),
        reminderMinutes: 15,
        completed: false,
        subtasks: [],
        createdAt: new Date().toISOString()
    },
    {
        id: 'task-3',
        title: 'Read chapter 4 of Clean Code book',
        description: 'Take notes on function naming conventions and refactoring techniques.',
        category: 'Study',
        priority: 'low',
        dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
        reminderMinutes: 'none',
        completed: true,
        subtasks: [],
        createdAt: new Date(Date.now() - 86400 * 1000).toISOString()
    }
];

// --- Web Audio Synthesizer ---
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSuccessSound() {
    if (!state.soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
        osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.25); // G5

        osc2.frequency.setValueAtTime(261.63, now);
        osc2.frequency.exponentialRampToValueAtTime(392.00, now + 0.2);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
    } catch (e) {
        console.warn('Audio playback error', e);
    }
}

function playReminderSound() {
    if (!state.soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.15); // D6

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    } catch (e) {
        console.warn('Audio reminder error', e);
    }
}

// --- DOM Elements Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadState();
    setupTheme();
    setupEventListeners();
    updateStreak();
    renderCategories();
    renderTasks();
    renderSuggestions();
    updateDashboardStats();
    updateGreeting();

    // Start background reminder checking loop (every 10 seconds)
    setInterval(checkReminders, 10000);
}

// --- State Persistence ---
function loadState() {
    const saved = localStorage.getItem('taskpulse_tasks_v1');
    if (saved) {
        try {
            state.tasks = JSON.parse(saved);
        } catch (e) {
            state.tasks = [...defaultTasks];
        }
    } else {
        state.tasks = [...defaultTasks];
        saveState();
    }
}

function saveState() {
    localStorage.setItem('taskpulse_tasks_v1', JSON.stringify(state.tasks));
}

function updateStreak() {
    const today = new Date().toDateString();
    if (state.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400 * 1000).toDateString();
        if (state.lastActiveDate === yesterday) {
            state.streak += 1;
        } else {
            state.streak = 1;
        }
        state.lastActiveDate = today;
        localStorage.setItem('taskpulse_streak', state.streak);
        localStorage.setItem('taskpulse_last_active', today);
    }
    const streakEl = document.getElementById('streak-days');
    if (streakEl) streakEl.textContent = `${state.streak} Day${state.streak > 1 ? 's' : ''}`;
}

// --- Theme Setup ---
function setupTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('taskpulse_theme', state.theme);
}

// --- Dynamic Greetings ---
function updateGreeting() {
    const hour = new Date().getHours();
    let text = 'Good day! 👋';
    if (hour < 12) text = 'Good morning! ☀️';
    else if (hour < 18) text = 'Good afternoon! 🌤️';
    else text = 'Good evening! 🌙';

    const greetingEl = document.getElementById('greeting-text');
    if (greetingEl) greetingEl.textContent = text;
}

// --- Categories Engine ---
const availableCategories = [
    { name: 'Work', icon: '💼', color: '#6366f1' },
    { name: 'Personal', icon: '👤', color: '#a855f7' },
    { name: 'Health', icon: '🏋️', color: '#10b981' },
    { name: 'Study', icon: '📚', color: '#3b82f6' },
    { name: 'Finance', icon: '💳', color: '#f59e0b' },
    { name: 'Shopping', icon: '🛒', color: '#ec4899' },
    { name: 'General', icon: '📌', color: '#64748b' }
];

function renderCategories() {
    const container = document.getElementById('category-filter-list');
    if (!container) return;

    let html = `
        <button class="category-btn ${state.selectedCategory === 'all' ? 'active' : ''}" data-category="all">
            <span class="category-dot" style="background-color: var(--primary);"></span>
            <span>All Categories</span>
        </button>
    `;

    availableCategories.forEach(cat => {
        const count = state.tasks.filter(t => t.category === cat.name && !t.completed).length;
        html += `
            <button class="category-btn ${state.selectedCategory === cat.name ? 'active' : ''}" data-category="${cat.name}">
                <span class="category-dot" style="background-color: ${cat.color};"></span>
                <span>${cat.icon} ${cat.name}</span>
                <span style="margin-left:auto; font-size:0.75rem; opacity:0.7;">${count}</span>
            </button>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.selectedCategory = e.currentTarget.getAttribute('data-category');
            renderCategories();
            renderTasks();
        });
    });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.currentFilter = e.currentTarget.getAttribute('data-filter');
            renderTasks();
        });
    });

    // Filter tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const view = e.currentTarget.getAttribute('data-view');
            if (view === 'high-priority') {
                state.currentFilter = 'high-priority';
            } else if (view === 'pending') {
                state.currentFilter = 'pending';
            } else if (view === 'completed') {
                state.currentFilter = 'completed';
            } else {
                state.currentFilter = 'all';
            }
            renderTasks();
        });
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Sound toggle
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            state.soundEnabled = !state.soundEnabled;
            localStorage.setItem('taskpulse_sound', state.soundEnabled);
            showToast(state.soundEnabled ? 'Sound effects enabled 🔊' : 'Sound effects muted 🔇', 'info');
            soundBtn.querySelector('.sound-on').style.display = state.soundEnabled ? 'block' : 'none';
            soundBtn.querySelector('.sound-off').style.display = state.soundEnabled ? 'none' : 'block';
        });
    }

    // Notification toggle
    const notifyBtn = document.getElementById('notify-toggle');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', async () => {
            if (!('Notification' in window)) {
                showToast('Web notifications not supported in this browser.', 'warning');
                return;
            }
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
                state.notificationsEnabled = true;
                showToast('Desktop notifications enabled! 🔔', 'success');
            } else {
                showToast('Notification permission denied.', 'warning');
            }
        });
    }

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            renderTasks();
        });
    }

    // Sort select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            renderTasks();
        });
    }

    // Modal controls
    const openModalBtn = document.getElementById('open-task-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const emptyAddBtn = document.getElementById('empty-add-btn');

    if (openModalBtn) openModalBtn.addEventListener('click', () => openModal());
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => openModal());
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    // Modal backdrop click to close
    const modalBackdrop = document.getElementById('task-modal');
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });
    }

    // Subtask addition in Modal
    const addSubtaskBtn = document.getElementById('add-subtask-btn');
    const newSubtaskInput = document.getElementById('new-subtask-input');
    if (addSubtaskBtn && newSubtaskInput) {
        addSubtaskBtn.addEventListener('click', () => {
            const text = newSubtaskInput.value.trim();
            if (text) {
                state.builderSubtasks.push({
                    id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                    title: text,
                    completed: false
                });
                newSubtaskInput.value = '';
                renderBuilderSubtasks();
            }
        });
        newSubtaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSubtaskBtn.click();
            }
        });
    }

    // AI Breakdown Suggestion Button inside Modal
    const aiBreakdownBtn = document.getElementById('ai-breakdown-btn');
    if (aiBreakdownBtn) {
        aiBreakdownBtn.addEventListener('click', generateAIBreakdown);
    }

    // Task Form Submission
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskFormSubmit);
    }

    // Clear completed tasks button
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    if (clearCompletedBtn) {
        clearCompletedBtn.addEventListener('click', () => {
            const completedCount = state.tasks.filter(t => t.completed).length;
            if (completedCount === 0) {
                showToast('No completed tasks to clear.', 'info');
                return;
            }
            if (confirm(`Are you sure you want to clear ${completedCount} completed task(s)?`)) {
                state.tasks = state.tasks.filter(t => !t.completed);
                saveState();
                renderTasks();
                updateDashboardStats();
                renderCategories();
                showToast(`Cleared ${completedCount} completed tasks!`, 'success');
            }
        });
    }

    // Refresh Suggestions Button
    const refreshSugBtn = document.getElementById('refresh-suggestions-btn');
    if (refreshSugBtn) {
        refreshSugBtn.addEventListener('click', renderSuggestions);
    }
}

// --- Task Filter & Sorting Pipeline ---
function getFilteredTasks() {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return state.tasks.filter(task => {
        // Search Query Filter
        if (state.searchQuery) {
            const matchTitle = task.title.toLowerCase().includes(state.searchQuery);
            const matchDesc = task.description ? task.description.toLowerCase().includes(state.searchQuery) : false;
            const matchCat = task.category.toLowerCase().includes(state.searchQuery);
            if (!matchTitle && !matchDesc && !matchCat) return false;
        }

        // Category Filter
        if (state.selectedCategory !== 'all' && task.category !== state.selectedCategory) {
            return false;
        }

        // Main Navigation / View Filters
        if (state.currentFilter === 'today') {
            if (!task.dueDate) return false;
            return task.dueDate.slice(0, 10) === todayStr && !task.completed;
        }

        if (state.currentFilter === 'upcoming') {
            if (!task.dueDate) return false;
            return task.dueDate.slice(0, 10) > todayStr && !task.completed;
        }

        if (state.currentFilter === 'overdue') {
            if (!task.dueDate || task.completed) return false;
            return new Date(task.dueDate) < now;
        }

        if (state.currentFilter === 'completed') {
            return task.completed;
        }

        if (state.currentFilter === 'pending') {
            return !task.completed;
        }

        if (state.currentFilter === 'high-priority') {
            return (task.priority === 'high' || task.priority === 'urgent') && !task.completed;
        }

        return true;
    }).sort((a, b) => {
        const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

        switch (state.sortBy) {
            case 'dueDate-asc':
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate) - new Date(b.dueDate);
            case 'dueDate-desc':
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(b.dueDate) - new Date(a.dueDate);
            case 'priority-desc':
                return priorityWeight[b.priority] - priorityWeight[a.priority];
            case 'createdAt-desc':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            default:
                return 0;
        }
    });
}

// --- Render Tasks Pipeline ---
function renderTasks() {
    const container = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    if (!container) return;

    const filtered = getFilteredTasks();

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        container.innerHTML = filtered.map(task => renderTaskCard(task)).join('');

        // Attach Card Action Event Listeners
        container.querySelectorAll('.task-checkbox-input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-task-id');
                toggleTaskComplete(taskId);
            });
        });

        container.querySelectorAll('.action-icon-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.currentTarget.getAttribute('data-task-id');
                openModal(taskId);
            });
        });

        container.querySelectorAll('.action-icon-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.currentTarget.getAttribute('data-task-id');
                deleteTask(taskId);
            });
        });

        // Subtask checkbox toggles inside card
        container.querySelectorAll('.subtask-checkbox-input').forEach(scb => {
            scb.addEventListener('change', (e) => {
                const taskId = e.target.getAttribute('data-task-id');
                const subId = e.target.getAttribute('data-sub-id');
                toggleSubtaskComplete(taskId, subId);
            });
        });
    }

    updateNavCounts();
    updateDashboardStats();
}

// Render Individual Task Card Template
function renderTaskCard(task) {
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
    const isDueSoon = task.dueDate && !isOverdue && !task.completed && (new Date(task.dueDate) - new Date() < 3600 * 2 * 1000);
    
    let dueStatusClass = '';
    if (isOverdue) dueStatusClass = 'overdue';
    else if (isDueSoon) dueStatusClass = 'due-soon';

    const formattedDate = task.dueDate ? formatDueDateString(task.dueDate) : 'No due date';

    const catObj = availableCategories.find(c => c.name === task.category) || { icon: '📌', name: 'General' };

    // Subtasks summary calculation
    const totalSubtasks = task.subtasks ? task.subtasks.length : 0;
    const completedSubtasks = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;

    return `
        <div class="task-card ${task.completed ? 'completed' : ''}" id="card-${task.id}">
            <div class="task-main">
                <label class="custom-checkbox" title="Mark as ${task.completed ? 'incomplete' : 'completed'}">
                    <input type="checkbox" class="task-checkbox-input" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>

                <div class="task-content">
                    <div class="task-header-line">
                        <span class="badge badge-${task.priority}">${task.priority}</span>
                        <span class="badge badge-category">${catObj.icon} ${task.category}</span>
                        <h4 class="task-title">${escapeHtml(task.title)}</h4>
                    </div>

                    ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}

                    ${totalSubtasks > 0 ? `
                        <div class="subtasks-preview">
                            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:0.25rem;">
                                Checklists (${completedSubtasks}/${totalSubtasks}):
                            </div>
                            ${task.subtasks.map(s => `
                                <div class="subtask-item-row ${s.completed ? 'completed' : ''}">
                                    <input type="checkbox" class="subtask-checkbox-input" data-task-id="${task.id}" data-sub-id="${s.id}" ${s.completed ? 'checked' : ''}>
                                    <span>${escapeHtml(s.title)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="task-footer">
                <div class="due-badge ${dueStatusClass}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>${formattedDate} ${isOverdue ? '(Overdue!)' : ''}</span>
                </div>

                <div class="task-card-actions">
                    <button class="action-icon-btn edit" data-task-id="${task.id}" title="Edit Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-icon-btn delete" data-task-id="${task.id}" title="Delete Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Helper to format due date nicely
function formatDueDateString(dateISO) {
    const d = new Date(dateISO);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
        return `Today at ${timeStr}`;
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow at ${timeStr}`;
    }

    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

// --- Task Actions ---
function toggleTaskComplete(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    saveState();

    if (task.completed) {
        playSuccessSound();
        triggerConfetti();
        showToast(`🎉 "${task.title}" marked as completed!`, 'success');
    }

    renderTasks();
    renderCategories();
}

function toggleSubtaskComplete(taskId, subId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const sub = task.subtasks.find(s => s.id === subId);
    if (sub) {
        sub.completed = !sub.completed;
        saveState();
        renderTasks();
    }
}

function deleteTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (confirm(`Delete task "${task.title}"?`)) {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        saveState();
        renderTasks();
        renderCategories();
        showToast('Task deleted.', 'info');
    }
}

// Confetti Cannon Trigger
function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.7 }
        });
    }
}

// --- Modal & Form Logic ---
function openModal(taskId = null) {
    const modal = document.getElementById('task-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('task-form');

    form.reset();
    state.builderSubtasks = [];

    if (taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            modalTitle.textContent = 'Edit Task';
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title-input').value = task.title;
            document.getElementById('task-desc-input').value = task.description || '';
            document.getElementById('task-category-select').value = task.category;
            document.getElementById('task-priority-select').value = task.priority;
            document.getElementById('task-duedate-input').value = task.dueDate || '';
            document.getElementById('task-reminder-select').value = task.reminderMinutes || 'none';

            if (task.subtasks) {
                state.builderSubtasks = JSON.parse(JSON.stringify(task.subtasks));
            }
        }
    } else {
        modalTitle.textContent = 'Create New Task';
        document.getElementById('task-id').value = '';
        
        // Default due date: today at 6:00 PM
        const defaultDue = new Date();
        defaultDue.setHours(18, 0, 0, 0);
        document.getElementById('task-duedate-input').value = defaultDue.toISOString().slice(0, 16);
    }

    renderBuilderSubtasks();
    modal.classList.add('open');
}

function closeModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('open');
}

function renderBuilderSubtasks() {
    const list = document.getElementById('subtasks-builder-list');
    const label = document.getElementById('subtasks-count-label');
    if (!list) return;

    if (label) label.textContent = `${state.builderSubtasks.length} subtask(s)`;

    list.innerHTML = state.builderSubtasks.map((s, idx) => `
        <li class="builder-subtask-item">
            <span>${escapeHtml(s.title)}</span>
            <button type="button" class="btn-text" onclick="removeBuilderSubtask(${idx})" style="color:var(--danger); font-size:1.1rem;">&times;</button>
        </li>
    `).join('');
}

window.removeBuilderSubtask = function(idx) {
    state.builderSubtasks.splice(idx, 1);
    renderBuilderSubtasks();
};

function handleTaskFormSubmit(e) {
    e.preventDefault();

    const taskId = document.getElementById('task-id').value;
    const title = document.getElementById('task-title-input').value.trim();
    const description = document.getElementById('task-desc-input').value.trim();
    const category = document.getElementById('task-category-select').value;
    const priority = document.getElementById('task-priority-select').value;
    const dueDate = document.getElementById('task-duedate-input').value;
    const reminderMinutes = document.getElementById('task-reminder-select').value;

    if (!title) {
        showToast('Please provide a task title.', 'warning');
        return;
    }

    if (taskId) {
        // Edit existing task
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.title = title;
            task.description = description;
            task.category = category;
            task.priority = priority;
            task.dueDate = dueDate;
            task.reminderMinutes = reminderMinutes;
            task.subtasks = [...state.builderSubtasks];
            showToast('Task updated successfully! ✨', 'success');
        }
    } else {
        // Create new task
        const newTask = {
            id: 'task-' + Date.now(),
            title,
            description,
            category,
            priority,
            dueDate,
            reminderMinutes,
            completed: false,
            subtasks: [...state.builderSubtasks],
            createdAt: new Date().toISOString()
        };
        state.tasks.unshift(newTask);
        showToast('New task added to your pulse list! 🚀', 'success');
    }

    saveState();
    closeModal();
    renderTasks();
    renderCategories();
}

// --- AI Suggestions & Smart Helper Engine ---
const quickAddTemplates = [
    { title: '💧 Drink 2 Liters of Water', category: 'Health', priority: 'medium' },
    { title: '📧 Clean & Organize Inbox', category: 'Work', priority: 'low' },
    { title: '🧘 10-Min Mindfulness Meditation', category: 'Health', priority: 'low' },
    { title: '📝 Plan Tomorrow\'s Priorities', category: 'Personal', priority: 'medium' },
    { title: '📖 Read 15 Pages of a Book', category: 'Study', priority: 'low' },
    { title: '💰 Review Monthly Budget', category: 'Finance', priority: 'high' }
];

function renderSuggestions() {
    const chipContainer = document.getElementById('quick-add-chips');
    const tipText = document.getElementById('smart-tip-text');
    if (!chipContainer || !tipText) return;

    // Pick 4 random templates
    const shuffled = [...quickAddTemplates].sort(() => 0.5 - Math.random()).slice(0, 4);

    chipContainer.innerHTML = shuffled.map(t => `
        <button class="suggestion-chip" onclick="quickAddTask('${escapeHtml(t.title)}', '${t.category}', '${t.priority}')">
            <span>+ ${escapeHtml(t.title)}</span>
        </button>
    `).join('');

    // Contextual productivity advice generator
    const pendingCount = state.tasks.filter(t => !t.completed).length;
    const overdueCount = state.tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed).length;
    const highPriorityCount = state.tasks.filter(t => (t.priority === 'high' || t.priority === 'urgent') && !t.completed).length;

    let advice = '';
    if (overdueCount > 0) {
        advice = `⚠️ You have <strong>${overdueCount} overdue task(s)</strong> needing immediate attention! Tackling them first reduces stress.`;
    } else if (highPriorityCount > 0) {
        advice = `⚡ Focus Mode: You have <strong>${highPriorityCount} urgent/high priority task(s)</strong> waiting for you.`;
    } else if (pendingCount === 0) {
        advice = `🎉 Fantastic work! All your tasks are completed. Use the quick add chips below to set new goals!`;
    } else {
        advice = `💡 Smart Tip: Breakdown large goals into micro subtasks to keep your momentum high throughout the day.`;
    }

    tipText.innerHTML = advice;
}

window.quickAddTask = function(title, category, priority) {
    const defaultDue = new Date();
    defaultDue.setHours(18, 0, 0, 0);

    const newTask = {
        id: 'task-' + Date.now(),
        title,
        description: 'Added from Smart AI Suggestions',
        category,
        priority,
        dueDate: defaultDue.toISOString().slice(0, 16),
        reminderMinutes: '30',
        completed: false,
        subtasks: [],
        createdAt: new Date().toISOString()
    };

    state.tasks.unshift(newTask);
    saveState();
    renderTasks();
    renderCategories();
    showToast(`Added: "${title}"`, 'success');
};

// Heuristic AI Subtask Breakdown Generator
function generateAIBreakdown() {
    const titleInput = document.getElementById('task-title-input');
    const title = titleInput ? titleInput.value.trim().toLowerCase() : '';

    if (!title) {
        showToast('Please enter a task title first to get AI suggestions!', 'warning');
        return;
    }

    let generatedSubtasks = [];

    if (title.includes('presentation') || title.includes('deck') || title.includes('slides')) {
        generatedSubtasks = ['Outline key slide takeaways', 'Draft content & visuals', 'Practice 10-min speech timing'];
    } else if (title.includes('website') || title.includes('app') || title.includes('code')) {
        generatedSubtasks = ['Define UI component wireframe', 'Implement core HTML/CSS structure', 'Test responsiveness & fix bugs'];
    } else if (title.includes('study') || title.includes('exam') || title.includes('read')) {
        generatedSubtasks = ['Review chapter summary notes', 'Complete practice questions', 'Self-quiz on key formulas'];
    } else if (title.includes('workout') || title.includes('gym') || title.includes('fitness')) {
        generatedSubtasks = ['Warm up & light stretch (5m)', 'Main routine exercise sets', 'Cool down & hydration'];
    } else if (title.includes('trip') || title.includes('travel') || title.includes('vacation')) {
        generatedSubtasks = ['Book hotel & transit tickets', 'Pack essential clothing & tech', 'Create itinerary map'];
    } else {
        generatedSubtasks = [
            `Step 1: Prepare materials for ${titleInput.value}`,
            `Step 2: Complete primary execution phase`,
            `Step 3: Final review & sign-off`
        ];
    }

    generatedSubtasks.forEach(st => {
        if (!state.builderSubtasks.some(existing => existing.title === st)) {
            state.builderSubtasks.push({
                id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                title: st,
                completed: false
            });
        }
    });

    renderBuilderSubtasks();
    showToast('✨ AI generated subtask steps for you!', 'success');
}

// --- Reminder Checker Loop ---
const notifiedTaskMap = new Set();

function checkReminders() {
    const now = new Date();

    state.tasks.forEach(task => {
        if (task.completed || !task.dueDate || task.reminderMinutes === 'none') return;

        const dueTime = new Date(task.dueDate);
        const reminderOffset = parseInt(task.reminderMinutes, 10) * 60 * 1000;
        const triggerTime = new Date(dueTime.getTime() - reminderOffset);

        // Check if current time has passed trigger time but before due time + 1 min
        if (now >= triggerTime && now <= new Date(dueTime.getTime() + 60000)) {
            const key = `${task.id}-${task.reminderMinutes}`;
            if (!notifiedTaskMap.has(key)) {
                notifiedTaskMap.add(key);
                triggerReminderAlert(task);
            }
        }
    });
}

function triggerReminderAlert(task) {
    playReminderSound();

    const msg = `⏰ Reminder: "${task.title}" is due soon!`;
    showToast(msg, 'warning');

    if (state.notificationsEnabled && 'Notification' in window) {
        try {
            new Notification('TaskPulse Reminder ⏰', {
                body: `${task.title} (Category: ${task.category})`,
                icon: 'https://cdn-icons-png.flaticon.com/512/906/906334.png'
            });
        } catch (e) {
            console.warn('Desktop notification fail', e);
        }
    }
}

// --- UI Stats & Counts Updates ---
function updateNavCounts() {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const countAll = state.tasks.length;
    const countToday = state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === todayStr && !t.completed).length;
    const countUpcoming = state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) > todayStr && !t.completed).length;
    const countOverdue = state.tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && !t.completed).length;
    const countCompleted = state.tasks.filter(t => t.completed).length;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('count-all', countAll);
    setEl('count-today', countToday);
    setEl('count-upcoming', countUpcoming);
    setEl('count-overdue', countOverdue);
    setEl('count-completed', countCompleted);
}

function updateDashboardStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const pending = state.tasks.filter(t => !t.completed).length;
    const now = new Date();
    const overdue = state.tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && !t.completed).length;

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const fill = document.getElementById('completion-progress-fill');
    const percentText = document.getElementById('completion-percentage');

    if (fill) fill.style.width = `${percentage}%`;
    if (percentText) percentText.textContent = `${percentage}%`;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('completed-count-val', completed);
    setEl('pending-count-val', pending);
    setEl('overdue-count-val', overdue);
}

// --- Toast System ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconHtml = 'ℹ️';
    if (type === 'success') iconHtml = '✅';
    if (type === 'warning') iconHtml = '⏰';
    if (type === 'danger') iconHtml = '🚨';

    toast.innerHTML = `
        <span style="font-size:1.1rem;">${iconHtml}</span>
        <span style="font-size:0.9rem; font-weight:600;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Utility Helpers ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}
