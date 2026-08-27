/**
 * IELTS Academic Reading Master Companion — Core Application Logic
 * Implements:
 * - Smart Auto Sorter (adaptive priority based on visits, favorites, progress & question volume)
 * - Multi-criteria filtering (topics, completion status, question length)
 * - Real-time keyword search with character highlighting
 * - Dual view modes (Card Grid & Compact Table)
 * - LocalStorage state persistence (completed status, favorites, resume points)
 * - Interactive preview modal & quick details drawer
 * - Toast notification feedback & dark/light theme toggle
 */

class ReadingHubApp {
    constructor() {
        this.lessons = typeof window.LESSONS_DATA !== 'undefined' ? [...window.LESSONS_DATA] : [];
        this.userState = this.loadUserState();
        this.currentCategory = 'all';
        this.currentStatus = 'all';
        this.currentLength = 'all';
        this.currentSort = 'smart-auto';
        this.searchQuery = '';
        this.currentView = localStorage.getItem('ielts_view_mode') || 'grid';
        this.isAutoSortActive = true;
        this.selectedLesson = null;

        this.initTheme();
        this.initEventListeners();
        this.render();
        this.checkResumeBanner();
    }

    loadUserState() {
        try {
            const saved = localStorage.getItem('ielts_user_progress');
            return saved ? JSON.parse(saved) : {
                completed: {}, // id: boolean
                favorites: {}, // id: boolean
                lastVisited: null, // { id, timestamp }
                visitCounts: {} // id: number
            };
        } catch (e) {
            console.error('Error loading progress state:', e);
            return { completed: {}, favorites: {}, lastVisited: null, visitCounts: {} };
        }
    }

    saveUserState() {
        try {
            localStorage.setItem('ielts_user_progress', JSON.stringify(this.userState));
        } catch (e) {
            console.error('Error saving state:', e);
        }
    }

    initTheme() {
        const savedTheme = localStorage.getItem('ielts_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
        
        const themeIcon = document.getElementById('theme-icon');
        if (isDark) {
            document.documentElement.classList.add('dark');
            if (themeIcon) themeIcon.className = 'fa-solid fa-sun text-amber-400 text-sm';
        } else {
            document.documentElement.classList.remove('dark');
            if (themeIcon) themeIcon.className = 'fa-solid fa-moon text-slate-600 text-sm';
        }
    }

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('ielts_theme', isDark ? 'dark' : 'light');
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
            themeIcon.className = isDark 
                ? 'fa-solid fa-sun text-amber-400 text-sm' 
                : 'fa-solid fa-moon text-slate-600 text-sm';
        }
        this.showToast(isDark ? 'Dark theme enabled' : 'Light theme enabled', 'info');
    }

    recordVisit(lessonId) {
        this.userState.lastVisited = {
            id: lessonId,
            timestamp: Date.now()
        };
        this.userState.visitCounts[lessonId] = (this.userState.visitCounts[lessonId] || 0) + 1;
        this.saveUserState();
        this.checkResumeBanner();
    }

    toggleFavorite(lessonId, event) {
        if (event) event.stopPropagation();
        this.userState.favorites[lessonId] = !this.userState.favorites[lessonId];
        this.saveUserState();
        this.render();
        const isFav = this.userState.favorites[lessonId];
        this.showToast(isFav ? 'Bookmarked lesson' : 'Removed from bookmarks', 'success');
    }

    toggleStatus(lessonId, event) {
        if (event) event.stopPropagation();
        this.userState.completed[lessonId] = !this.userState.completed[lessonId];
        this.saveUserState();
        this.render();
        const isDone = this.userState.completed[lessonId];
        this.showToast(isDone ? 'Marked as completed! 🎉' : 'Marked as in-progress', 'success');
    }

    checkResumeBanner() {
        const resume = this.userState.lastVisited;
        const banner = document.getElementById('resume-banner');
        if (!banner) return;

        if (resume && resume.id) {
            const lesson = this.lessons.find(l => l.id === resume.id);
            if (lesson) {
                const titleEl = document.getElementById('resume-title');
                const linkEl = document.getElementById('resume-link');
                if (titleEl) titleEl.textContent = `${lesson.title} (${lesson.questionRange})`;
                if (linkEl) linkEl.href = lesson.filename;
                banner.classList.remove('hidden');
                return;
            }
        }
        banner.classList.add('hidden');
    }

    /**
     * Smart Auto Sorter Logic:
     * Computes dynamic priority weights for each lesson:
     * 1. If currently in progress (visited but not completed) -> High Priority (+500 / +150)
     * 2. If Bookmarked by user -> High Priority (+300)
     * 3. Non-completed full standard passages (higher question density) (+questionCount * 8)
     * 4. Difficulty weighting (+difficultyScore * 10)
     * 5. Completed passages placed gracefully at the bottom (-400)
     */
    calculateSmartScore(lesson) {
        let score = 100;
        const isCompleted = !!this.userState.completed[lesson.id];
        const isFav = !!this.userState.favorites[lesson.id];
        const visits = this.userState.visitCounts[lesson.id] || 0;
        const isLastVisited = this.userState.lastVisited && this.userState.lastVisited.id === lesson.id;

        if (isLastVisited && !isCompleted) score += 500;
        if (isFav) score += 300;
        if (visits > 0 && !isCompleted) score += 150;
        
        // Question volume bonus for full standard mock sets
        score += lesson.questionCount * 8;
        score += lesson.difficultyScore * 10;

        // Completed items gently placed down to prioritize fresh learning
        if (isCompleted) score -= 400;

        return score;
    }

    getFilteredAndSortedLessons() {
        let list = [...this.lessons];

        // 1. Search Filter
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase().trim();
            list = list.filter(item => {
                const matchTitle = item.title.toLowerCase().includes(q) || item.fullTitle.toLowerCase().includes(q);
                const matchTopic = item.topic.toLowerCase().includes(q) || item.categoryLabel.toLowerCase().includes(q);
                const matchDesc = item.description.toLowerCase().includes(q);
                const matchQtypes = item.questionTypes.some(t => t.toLowerCase().includes(q));
                const matchVocab = item.keyVocab.some(v => v.word.toLowerCase().includes(q) || v.meaning.toLowerCase().includes(q));
                return matchTitle || matchTopic || matchDesc || matchQtypes || matchVocab;
            });
        }

        // 2. Category Filter
        if (this.currentCategory !== 'all') {
            list = list.filter(item => item.category === this.currentCategory);
        }

        // 3. Status Filter
        if (this.currentStatus === 'favorite') {
            list = list.filter(item => !!this.userState.favorites[item.id]);
        } else if (this.currentStatus === 'completed') {
            list = list.filter(item => !!this.userState.completed[item.id]);
        } else if (this.currentStatus === 'in-progress') {
            list = list.filter(item => !this.userState.completed[item.id] && (this.userState.visitCounts[item.id] || 0) > 0);
        }

        // 4. Passage Length Filter
        if (this.currentLength === 'short') {
            list = list.filter(item => item.questionCount <= 5);
        } else if (this.currentLength === 'medium') {
            list = list.filter(item => item.questionCount >= 6 && item.questionCount <= 10);
        } else if (this.currentLength === 'full') {
            list = list.filter(item => item.questionCount >= 11);
        }

        // 5. Sorting Logic
        const sortMode = this.currentSort;
        if (sortMode === 'smart-auto') {
            list.sort((a, b) => this.calculateSmartScore(b) - this.calculateSmartScore(a));
        } else if (sortMode === 'questions-desc') {
            list.sort((a, b) => b.questionCount - a.questionCount);
        } else if (sortMode === 'questions-asc') {
            list.sort((a, b) => a.questionCount - b.questionCount);
        } else if (sortMode === 'title-asc') {
            list.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortMode === 'title-desc') {
            list.sort((a, b) => b.title.localeCompare(a.title));
        } else if (sortMode === 'time-asc') {
            list.sort((a, b) => a.readingTimeMin - b.readingTimeMin);
        } else if (sortMode === 'time-desc') {
            list.sort((a, b) => b.readingTimeMin - a.readingTimeMin);
        } else if (sortMode === 'difficulty-desc') {
            list.sort((a, b) => b.difficultyScore - a.difficultyScore);
        } else if (sortMode === 'difficulty-asc') {
            list.sort((a, b) => a.difficultyScore - b.difficultyScore);
        }

        return list;
    }

    render() {
        const list = this.getFilteredAndSortedLessons();
        this.updateMetrics();
        this.renderGrid(list);
        this.renderTable(list);
        this.updateUIControls(list.length);
    }

    renderGrid(list) {
        const grid = document.getElementById('lessons-grid');
        const emptyState = document.getElementById('empty-state');
        if (!grid) return;

        if (list.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

        const query = this.searchQuery.toLowerCase().trim();

        grid.innerHTML = list.map(lesson => {
            const isDone = !!this.userState.completed[lesson.id];
            const isFav = !!this.userState.favorites[lesson.id];
            const visits = this.userState.visitCounts[lesson.id] || 0;
            
            const highlightedTitle = this.highlightText(lesson.title, query);
            const highlightedTopic = this.highlightText(lesson.topic, query);

            return `
            <div class="card-hover bg-white dark:bg-slate-900 border ${isDone ? 'border-emerald-200 dark:border-emerald-900/60' : 'border-slate-200/90 dark:border-slate-800/90'} rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs hover:shadow-md relative overflow-hidden group">
                
                <!-- Top Row: Category & Badges & Favorite Star -->
                <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full border ${lesson.badgeColor}">
                                ${lesson.categoryLabel}
                            </span>
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                ${lesson.difficulty}
                            </span>
                        </div>
                        <button onclick="window.app.toggleFavorite('${lesson.id}', event)" class="w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isFav ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'}" title="Bookmark lesson">
                            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star text-sm"></i>
                        </button>
                    </div>

                    <!-- Title & Topic Header -->
                    <div class="flex items-start space-x-3.5 mb-3">
                        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br ${lesson.themeColor} text-white flex items-center justify-center text-lg shrink-0 shadow-sm mt-0.5">
                            <i class="${lesson.icon}"></i>
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                ${highlightedTitle}
                            </h2>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                ${highlightedTopic}
                            </p>
                        </div>
                    </div>

                    <!-- Description Snippet -->
                    <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mb-4 font-normal">
                        ${lesson.description}
                    </p>

                    <!-- Key Specs Pill Bar -->
                    <div class="grid grid-cols-3 gap-2 py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center mb-4 text-[11px]">
                        <div>
                            <span class="text-slate-400 block font-medium">Questions</span>
                            <span class="font-bold text-slate-800 dark:text-slate-200">${lesson.questionRange}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block font-medium">Est. Time</span>
                            <span class="font-bold text-slate-800 dark:text-slate-200">${lesson.readingTimeMin} min</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block font-medium">Band Vocab</span>
                            <span class="font-bold text-indigo-600 dark:text-indigo-400">${lesson.vocabCount} terms</span>
                        </div>
                    </div>
                </div>

                <!-- Bottom Action Buttons: Deep Links & Status -->
                <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <!-- Direct Deep-Link Buttons -->
                    <div class="grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
                        <a href="${lesson.filename}" onclick="window.app.recordVisit('${lesson.id}')" class="px-2 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition" title="Open Passage Analysis">
                            <i class="fa-solid fa-book-open mr-1"></i> Analysis
                        </a>
                        <a href="${lesson.filename}#vocabulary" onclick="window.app.recordVisit('${lesson.id}')" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Open Vocabulary Suite">
                            <i class="fa-solid fa-spell-check mr-1"></i> Vocab
                        </a>
                        <a href="${lesson.filename}#flashcards" onclick="window.app.recordVisit('${lesson.id}')" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Open Flashcards Quiz">
                            <i class="fa-solid fa-brain mr-1"></i> Quiz
                        </a>
                    </div>

                    <!-- Footer Status & Quick Preview -->
                    <div class="flex items-center justify-between pt-1">
                        <button onclick="window.app.toggleStatus('${lesson.id}', event)" class="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${isDone ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}">
                            <i class="fa-solid ${isDone ? 'fa-circle-check text-emerald-500' : 'fa-circle-notch text-slate-400'} text-xs"></i>
                            <span>${isDone ? 'Completed' : (visits > 0 ? 'In Progress' : 'Not Started')}</span>
                        </button>
                        
                        <button onclick="window.app.openPreviewModal('${lesson.id}')" class="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1">
                            <span>Details</span>
                            <i class="fa-solid fa-chevron-right text-[10px]"></i>
                        </button>
                    </div>
                </div>

            </div>
            `;
        }).join('');
    }

    renderTable(list) {
        const tbody = document.getElementById('lessons-table-body');
        if (!tbody) return;

        const query = this.searchQuery.toLowerCase().trim();

        tbody.innerHTML = list.map(lesson => {
            const isDone = !!this.userState.completed[lesson.id];
            const isFav = !!this.userState.favorites[lesson.id];
            const highlightedTitle = this.highlightText(lesson.title, query);

            return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td class="py-3 px-4 text-center">
                    <button onclick="window.app.toggleFavorite('${lesson.id}', event)" class="${isFav ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'}">
                        <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star text-sm"></i>
                    </button>
                </td>
                <td class="py-3 px-4 font-semibold">
                    <a href="${lesson.filename}" onclick="window.app.recordVisit('${lesson.id}')" class="text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                        ${highlightedTitle}
                    </a>
                    <span class="block text-xs font-normal text-slate-400">${lesson.questionRange}</span>
                </td>
                <td class="py-3 px-4 text-xs">
                    <span class="px-2 py-0.5 rounded-full font-medium ${lesson.badgeColor}">
                        ${lesson.categoryLabel}
                    </span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">${lesson.questionCount}</td>
                <td class="py-3 px-4 text-center text-slate-500 dark:text-slate-400">${lesson.readingTimeMin}m</td>
                <td class="py-3 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">${lesson.difficulty}</td>
                <td class="py-3 px-4 text-center">
                    <button onclick="window.app.toggleStatus('${lesson.id}', event)" class="px-2.5 py-1 rounded-full text-xs font-semibold ${isDone ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}">
                        ${isDone ? 'Done ✅' : 'To Do'}
                    </button>
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="inline-flex items-center space-x-1.5">
                        <button onclick="window.app.openPreviewModal('${lesson.id}')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition" title="Preview details">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <a href="${lesson.filename}" onclick="window.app.recordVisit('${lesson.id}')" class="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">
                            Open
                        </a>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    updateMetrics() {
        const total = this.lessons.length;
        const completedCount = Object.values(this.userState.completed).filter(Boolean).length;
        const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        // Header progress
        const headerBar = document.getElementById('header-progress-bar');
        const headerText = document.getElementById('header-progress-text');
        if (headerBar) headerBar.style.width = `${percentage}%`;
        if (headerText) headerText.textContent = `${completedCount}/${total}`;

        // Stats Banner
        const statsCount = document.getElementById('stats-completed-count');
        const statsSub = document.getElementById('stats-completed-sub');
        if (statsCount) statsCount.textContent = `${percentage}%`;
        if (statsSub) statsSub.textContent = `${completedCount} of ${total} finished`;
    }

    updateUIControls(resultCount) {
        // Result count text
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.textContent = resultCount;
        
        // Sort summary label
        const sortLabels = {
            'smart-auto': '✨ Smart Auto (Activity & Difficulty)',
            'questions-desc': '🔢 Questions (High to Low)',
            'questions-asc': '🔢 Questions (Low to High)',
            'title-asc': '🔤 Title (A → Z)',
            'title-desc': '🔤 Title (Z → A)',
            'time-asc': '⏱️ Reading Time (Shortest)',
            'time-desc': '⏱️ Reading Time (Longest)',
            'difficulty-desc': '📊 Difficulty (Band 8.0 → 6.5)',
            'difficulty-asc': '📊 Difficulty (Band 6.5 → 8.0)'
        };
        const summaryEl = document.getElementById('active-sort-summary');
        if (summaryEl) summaryEl.textContent = `Sorted by: ${sortLabels[this.currentSort] || this.currentSort}`;

        // Reset filter button visibility
        const hasFilters = this.searchQuery || this.currentCategory !== 'all' || this.currentStatus !== 'all' || this.currentLength !== 'all' || this.currentSort !== 'smart-auto';
        const resetBtn = document.getElementById('reset-filters-btn');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        if (resetBtn) resetBtn.classList.toggle('hidden', !hasFilters);
        if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !this.searchQuery);
    }

    highlightText(text, query) {
        if (!query) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return text.replace(regex, '<span class="highlight-match">$1</span>');
    }

    setView(mode) {
        this.currentView = mode;
        localStorage.setItem('ielts_view_mode', mode);

        const grid = document.getElementById('lessons-grid');
        const table = document.getElementById('lessons-table-container');
        const gridBtn = document.getElementById('view-grid-btn');
        const listBtn = document.getElementById('view-list-btn');

        if (!grid || !table || !gridBtn || !listBtn) return;

        if (mode === 'grid') {
            grid.classList.remove('hidden');
            table.classList.add('hidden');
            gridBtn.className = 'view-toggle-btn active p-2 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs';
            listBtn.className = 'view-toggle-btn p-2 rounded-lg text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
        } else {
            grid.classList.add('hidden');
            table.classList.remove('hidden');
            listBtn.className = 'view-toggle-btn active p-2 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs';
            gridBtn.className = 'view-toggle-btn p-2 rounded-lg text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
        }
    }

    openPreviewModal(lessonId) {
        const lesson = this.lessons.find(l => l.id === lessonId);
        if (!lesson) return;

        this.selectedLesson = lesson;
        const isDone = !!this.userState.completed[lesson.id];
        const isFav = !!this.userState.favorites[lesson.id];

        document.getElementById('modal-title').textContent = lesson.fullTitle;
        document.getElementById('modal-category').textContent = lesson.categoryLabel;
        document.getElementById('modal-band').textContent = lesson.difficulty;
        document.getElementById('modal-description').textContent = lesson.description;
        document.getElementById('modal-questions').textContent = lesson.questionRange;
        document.getElementById('modal-time').textContent = `${lesson.readingTimeMin} min`;
        document.getElementById('modal-vocab-count').textContent = `${lesson.vocabCount} terms`;
        document.getElementById('modal-icon').className = `w-12 h-12 rounded-2xl flex items-center justify-center text-xl text-white shadow-sm shrink-0 bg-gradient-to-br ${lesson.themeColor}`;
        document.getElementById('modal-icon').innerHTML = `<i class="${lesson.icon}"></i>`;

        // Question Types Badges
        const qtypesContainer = document.getElementById('modal-qtypes');
        if (qtypesContainer) {
            qtypesContainer.innerHTML = lesson.questionTypes.map(t => 
                `<span class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <i class="fa-solid fa-check mr-1 text-emerald-500"></i> ${t}
                </span>`
            ).join('');
        }

        // Sample Vocab List
        const vocabContainer = document.getElementById('modal-sample-vocab');
        if (vocabContainer) {
            vocabContainer.innerHTML = lesson.keyVocab.map(v => 
                `<div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                    <span class="font-bold text-slate-900 dark:text-white block text-xs">${v.word}</span>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 block">${v.meaning}</span>
                </div>`
            ).join('');
        }

        // Buttons
        const statusBtn = document.getElementById('modal-toggle-status-btn');
        if (statusBtn) {
            statusBtn.innerHTML = `<i class="fa-solid ${isDone ? 'fa-circle-check text-emerald-500' : 'fa-circle-notch text-slate-400'} mr-1"></i> ${isDone ? 'Completed' : 'Mark Completed'}`;
        }
        
        const favBtn = document.getElementById('modal-toggle-fav-btn');
        if (favBtn) {
            favBtn.innerHTML = `<i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star text-amber-400 mr-1"></i> ${isFav ? 'Bookmarked' : 'Bookmark'}`;
        }

        const analysisBtn = document.getElementById('modal-btn-analysis');
        if (analysisBtn) {
            analysisBtn.href = lesson.filename;
            analysisBtn.onclick = () => this.recordVisit(lesson.id);
        }

        // Open modal
        const modal = document.getElementById('preview-modal');
        const card = document.getElementById('preview-card');
        if (modal && card) {
            modal.classList.remove('pointer-events-none');
            modal.classList.remove('opacity-0');
            modal.classList.add('opacity-100');
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }
    }

    closePreviewModal() {
        const modal = document.getElementById('preview-modal');
        const card = document.getElementById('preview-card');
        if (modal && card) {
            modal.classList.add('opacity-0');
            modal.classList.remove('opacity-100');
            card.classList.add('scale-95');
            card.classList.remove('scale-100');
            setTimeout(() => {
                modal.classList.add('pointer-events-none');
            }, 200);
        }
    }

    resetFilters() {
        this.searchQuery = '';
        this.currentCategory = 'all';
        this.currentStatus = 'all';
        this.currentLength = 'all';
        this.currentSort = 'smart-auto';
        
        const searchInput = document.getElementById('search-input');
        const sortSelect = document.getElementById('sort-select');
        const lengthSelect = document.getElementById('length-filter-select');
        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'smart-auto';
        if (lengthSelect) lengthSelect.value = 'all';
        
        // Update topic pills UI
        document.querySelectorAll('.cat-pill').forEach(btn => {
            const isAll = btn.getAttribute('data-category') === 'all';
            btn.className = isAll 
                ? 'cat-pill active px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all bg-indigo-600 text-white shadow-xs'
                : 'cat-pill px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:border-indigo-400';
        });

        // Update status pills UI
        document.querySelectorAll('.status-pill').forEach(btn => {
            const isAll = btn.getAttribute('data-status') === 'all';
            btn.className = isAll
                ? 'status-pill active px-2.5 py-1 rounded-lg font-medium transition bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                : 'status-pill px-2.5 py-1 rounded-lg font-medium transition bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400';
        });

        this.render();
        this.showToast('Filters reset', 'info');
    }

    resetAllProgress() {
        if (confirm('Are you sure you want to reset all reading progress, favorites, and visit history?')) {
            localStorage.removeItem('ielts_user_progress');
            this.userState = { completed: {}, favorites: {}, lastVisited: null, visitCounts: {} };
            this.render();
            this.checkResumeBanner();
            this.showToast('All progress reset successfully', 'info');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-emerald-500/50',
            info: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-indigo-500/50'
        };
        toast.className = `${colors[type] || colors.info} px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center space-x-2 transition-all duration-300 transform translate-y-3 opacity-0 pointer-events-auto`;
        toast.innerHTML = `
            <i class="fa-solid fa-circle-check text-emerald-400 dark:text-emerald-600"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-3', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-3', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 2400);
    }

    initEventListeners() {
        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

        // Search Input with real-time response
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        const clearSearchBtn = document.getElementById('clear-search-btn');
        if (clearSearchBtn && searchInput) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                this.render();
                searchInput.focus();
            });
        }

        // Hotkey for search: '/'
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== searchInput && searchInput) {
                e.preventDefault();
                searchInput.focus();
            } else if (e.key === 'Escape') {
                this.closePreviewModal();
                if (searchInput && document.activeElement === searchInput) {
                    searchInput.blur();
                }
            }
        });

        // Sort Dropdown
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.render();
            });
        }

        // Auto Sort Toggle Button
        const toggleAutoSortBtn = document.getElementById('btn-toggle-auto-sort');
        if (toggleAutoSortBtn) {
            toggleAutoSortBtn.addEventListener('click', () => {
                if (this.currentSort === 'smart-auto') {
                    this.currentSort = 'questions-desc';
                    const label = document.getElementById('auto-sort-state-label');
                    if (label) label.textContent = 'Manual';
                    if (sortSelect) sortSelect.value = 'questions-desc';
                    this.showToast('Switched to manual sort', 'info');
                } else {
                    this.currentSort = 'smart-auto';
                    const label = document.getElementById('auto-sort-state-label');
                    if (label) label.textContent = 'Active';
                    if (sortSelect) sortSelect.value = 'smart-auto';
                    this.showToast('Smart Auto Sorter activated', 'success');
                }
                this.render();
            });
        }

        // Topic Category Filter Pills
        const catPills = document.getElementById('category-pills');
        if (catPills) {
            catPills.addEventListener('click', (e) => {
                const btn = e.target.closest('.cat-pill');
                if (!btn) return;
                
                document.querySelectorAll('.cat-pill').forEach(b => {
                    b.className = 'cat-pill px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:border-indigo-400';
                });
                btn.className = 'cat-pill active px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all bg-indigo-600 text-white shadow-xs';
                
                this.currentCategory = btn.getAttribute('data-category');
                this.render();
            });
        }

        // Status Filter Pills
        const statusPills = document.getElementById('status-pills');
        if (statusPills) {
            statusPills.addEventListener('click', (e) => {
                const btn = e.target.closest('.status-pill');
                if (!btn) return;

                document.querySelectorAll('.status-pill').forEach(b => {
                    b.className = 'status-pill px-2.5 py-1 rounded-lg font-medium transition bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400';
                });
                btn.className = 'status-pill active px-2.5 py-1 rounded-lg font-medium transition bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white';

                this.currentStatus = btn.getAttribute('data-status');
                this.render();
            });
        }

        // Length Filter Select
        const lengthSelect = document.getElementById('length-filter-select');
        if (lengthSelect) {
            lengthSelect.addEventListener('change', (e) => {
                this.currentLength = e.target.value;
                this.render();
            });
        }

        // Reset Filters Button
        const resetFiltersBtn = document.getElementById('reset-filters-btn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // View Mode Switcher
        const viewGridBtn = document.getElementById('view-grid-btn');
        const viewListBtn = document.getElementById('view-list-btn');
        if (viewGridBtn) viewGridBtn.addEventListener('click', () => this.setView('grid'));
        if (viewListBtn) viewListBtn.addEventListener('click', () => this.setView('list'));

        // Modal Close Event Listeners
        const closeModalBtn = document.getElementById('close-modal-btn');
        const previewModal = document.getElementById('preview-modal');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closePreviewModal());
        if (previewModal) {
            previewModal.addEventListener('click', (e) => {
                if (e.target.id === 'preview-modal') this.closePreviewModal();
            });
        }

        // Modal status toggle inside modal
        const modalStatusBtn = document.getElementById('modal-toggle-status-btn');
        if (modalStatusBtn) {
            modalStatusBtn.addEventListener('click', () => {
                if (this.selectedLesson) {
                    this.toggleStatus(this.selectedLesson.id);
                    this.openPreviewModal(this.selectedLesson.id);
                }
            });
        }

        const modalFavBtn = document.getElementById('modal-toggle-fav-btn');
        if (modalFavBtn) {
            modalFavBtn.addEventListener('click', () => {
                if (this.selectedLesson) {
                    this.toggleFavorite(this.selectedLesson.id);
                    this.openPreviewModal(this.selectedLesson.id);
                }
            });
        }

        // Restore saved view mode
        this.setView(this.currentView);
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ReadingHubApp();
});
