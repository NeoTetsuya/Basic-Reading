/**
 * IELTS Academic Reading Companion — Lesson Locker & Authentication Module
 * 
 * Features:
 * - Unique passwords for every reading lesson file
 * - Teacher Masterpass for universal access
 * - LocalStorage persistent unlock state
 * - Full-screen glassmorphism lock overlay for direct file access
 * - Hub integration for locked card indicators & unlock prompts
 * - Teacher Mode dashboard with password cheatsheet and bulk unlock/relock
 */

(function(window) {
    'use strict';

    const MASTER_PASSWORD = 'TEACHER2026';

    const LESSON_CONFIG = {
        'bats_to_the_rescue_reading_analysis_vocabulary.html': {
            id: 'bats_to_the_rescue',
            title: 'Bats to the rescue',
            password: 'BAT2026',
            category: 'Nature & Zoology'
        },
        'brain_activity_reading_analysis_vocabulary.html': {
            id: 'brain_activity',
            title: 'Your brain activity can be used to measure how well you understand a concept',
            password: 'BRAIN2026',
            category: 'Science & Psychology'
        },
        'butterflies_reading_analysis_vocabulary.html': {
            id: 'butterflies',
            title: 'Climate Change & Butterflies',
            password: 'BUTTERFLY2026',
            category: 'Nature & Zoology'
        },
        'exercise_calories_reading_analysis_vocabulary.html': {
            id: 'exercise_calories',
            title: 'Exercise and Calories',
            password: 'CALORIE2026',
            category: 'Health & Medicine'
        },
        'favorite_time_for_giving_birth_reading_analysis_vocabulary.html': {
            id: 'favorite_time_for_giving_birth',
            title: 'The Favourite Time for Giving Birth',
            password: 'BIRTH2026',
            category: 'Health & Medicine'
        },
        'investors_reading_analysis_vocabulary.html': {
            id: 'investors',
            title: 'Why Investors Should Follow The Crowd',
            password: 'INVESTOR2026',
            category: 'Economics & Society'
        },
        'kakapo_reading_analysis_vocabulary.html': {
            id: 'kakapo',
            title: 'The Kakapo: The Night Parrot of New Zealand',
            password: 'KAKAPO2026',
            category: 'Nature & Zoology'
        },
        'manatees_reading_analysis_vocabulary.html': {
            id: 'manatees',
            title: 'Manatees — Sirenia and Marine Conservation',
            password: 'MANATEE2026',
            category: 'Nature & Zoology'
        },
        'stonehenge_reading_analysis_vocabulary.html': {
            id: 'stonehenge',
            title: 'The Megalithic Builders of Stonehenge',
            password: 'STONEHENGE2026',
            category: 'History & Archaeology'
        },
        'women_s_pain_reading_analysis_vocabulary.html': {
            id: 'women_s_pain',
            title: 'Women’s pain is different from men’s',
            password: 'PAIN2026',
            category: 'Health & Medicine'
        },
        'Roots & Meanings.html': {
            id: 'roots_meanings',
            title: 'English Morphology & Word Roots Explorer',
            password: 'ROOTS2026',
            category: 'Academic Vocabulary'
        }
    };

    const STORAGE_KEY_UNLOCKED = 'ielts_reading_unlocked_lessons';
    const STORAGE_KEY_TEACHER = 'ielts_reading_teacher_active';

    const LessonLocker = {
        MASTER_PASSWORD,
        LESSON_CONFIG,

        normalizeKey(key) {
            if (!key) return '';
            const clean = key.trim().toLowerCase();
            // Match by exact filename or key
            for (const [fn, cfg] of Object.entries(LESSON_CONFIG)) {
                if (fn.toLowerCase() === clean || cfg.id.toLowerCase() === clean) {
                    return fn;
                }
            }
            // Match by basename without path
            const base = clean.split(/[/\\]/).pop();
            for (const [fn, cfg] of Object.entries(LESSON_CONFIG)) {
                if (fn.toLowerCase() === base || cfg.id.toLowerCase() === base) {
                    return fn;
                }
            }
            return key;
        },

        getConfig(key) {
            const fn = this.normalizeKey(key);
            return LESSON_CONFIG[fn] || null;
        },

        getUnlockedMap() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY_UNLOCKED);
                return saved ? JSON.parse(saved) : {};
            } catch (e) {
                return {};
            }
        },

        saveUnlockedMap(map) {
            try {
                localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify(map));
            } catch (e) {
                console.error('Failed to save unlocked lessons:', e);
            }
        },

        isTeacherActive() {
            return localStorage.getItem(STORAGE_KEY_TEACHER) === 'true';
        },

        setTeacherActive(active) {
            if (active) {
                localStorage.setItem(STORAGE_KEY_TEACHER, 'true');
            } else {
                localStorage.removeItem(STORAGE_KEY_TEACHER);
            }
            // Dispatch event for reactive UI updates
            window.dispatchEvent(new CustomEvent('lesson-locker-changed', {
                detail: { isTeacher: active }
            }));
        },

        isUnlocked(key) {
            if (this.isTeacherActive()) return true;
            const fn = this.normalizeKey(key);
            const map = this.getUnlockedMap();
            return !!map[fn];
        },

        verifyPassword(inputPassword, key) {
            if (!inputPassword) {
                return { success: false, message: 'Please enter a password.' };
            }
            const cleanPass = inputPassword.trim();
            
            // Check Master Password first
            if (cleanPass === MASTER_PASSWORD || cleanPass.toUpperCase() === MASTER_PASSWORD.toUpperCase()) {
                this.setTeacherActive(true);
                return {
                    success: true,
                    isMaster: true,
                    message: '👑 Teacher Masterpass Accepted! All lessons unlocked.'
                };
            }

            // If key is given, check specific lesson password
            if (key) {
                const fn = this.normalizeKey(key);
                const cfg = LESSON_CONFIG[fn];
                if (cfg && (cleanPass === cfg.password || cleanPass.toUpperCase() === cfg.password.toUpperCase())) {
                    const map = this.getUnlockedMap();
                    map[fn] = true;
                    this.saveUnlockedMap(map);
                    window.dispatchEvent(new CustomEvent('lesson-locker-changed', {
                        detail: { unlockedFile: fn }
                    }));
                    return {
                        success: true,
                        isMaster: false,
                        message: `🔓 Lesson "${cfg.title}" successfully unlocked!`
                    };
                }
            } else {
                // If no specific key provided, check if matches any lesson password
                for (const [fn, cfg] of Object.entries(LESSON_CONFIG)) {
                    if (cleanPass === cfg.password || cleanPass.toUpperCase() === cfg.password.toUpperCase()) {
                        const map = this.getUnlockedMap();
                        map[fn] = true;
                        this.saveUnlockedMap(map);
                        window.dispatchEvent(new CustomEvent('lesson-locker-changed', {
                            detail: { unlockedFile: fn }
                        }));
                        return {
                            success: true,
                            isMaster: false,
                            unlockedFile: fn,
                            message: `🔓 Lesson "${cfg.title}" unlocked!`
                        };
                    }
                }
            }

            return {
                success: false,
                message: 'Incorrect password. Please verify and try again.'
            };
        },

        lockLesson(key) {
            const fn = this.normalizeKey(key);
            const map = this.getUnlockedMap();
            delete map[fn];
            this.saveUnlockedMap(map);
            window.dispatchEvent(new CustomEvent('lesson-locker-changed', {
                detail: { lockedFile: fn }
            }));
        },

        lockAll() {
            this.saveUnlockedMap({});
            this.setTeacherActive(false);
            window.dispatchEvent(new CustomEvent('lesson-locker-changed', {
                detail: { lockedAll: true }
            }));
        },

        unlockAll() {
            const map = {};
            for (const fn of Object.keys(LESSON_CONFIG)) {
                map[fn] = true;
            }
            this.saveUnlockedMap(map);
            window.dispatchEvent(new CustomEvent('lesson-locker-changed', {
                detail: { unlockedAll: true }
            }));
        },

        getTeacherCheatSheet() {
            const isTeacher = this.isTeacherActive();
            const map = this.getUnlockedMap();
            return Object.entries(LESSON_CONFIG).map(([fn, cfg]) => {
                return {
                    filename: fn,
                    id: cfg.id,
                    title: cfg.title,
                    category: cfg.category,
                    password: cfg.password,
                    isUnlocked: isTeacher || !!map[fn]
                };
            });
        },

        /**
         * Initialize Lock Screen Protection for an Individual Lesson Page
         */
        initLessonProtection(filename, lessonTitle) {
            const fn = this.normalizeKey(filename);
            const cfg = this.getConfig(fn);
            const title = lessonTitle || (cfg ? cfg.title : 'IELTS Reading Lesson');

            // Inject CSS for locker overlay
            this.injectOverlayStyles();

            // Insert Header Locker Pill if header exists
            this.injectHeaderStatus(fn, title);

            // Check if already unlocked
            if (this.isUnlocked(fn)) {
                return;
            }

            // Render Full Screen Lock Overlay
            this.renderLockOverlay(fn, title);
        },

        injectOverlayStyles() {
            if (document.getElementById('lesson-locker-styles')) return;
            const style = document.createElement('style');
            style.id = 'lesson-locker-styles';
            style.textContent = `
                @keyframes lockerShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-8px); }
                    40%, 80% { transform: translateX(8px); }
                }
                @keyframes lockerGlow {
                    0%, 100% { box-shadow: 0 0 25px rgba(99, 102, 241, 0.25); }
                    50% { box-shadow: 0 0 45px rgba(99, 102, 241, 0.5); }
                }
                .locker-shake {
                    animation: lockerShake 0.45s ease-in-out;
                }
                .locker-glow {
                    animation: lockerGlow 3s infinite ease-in-out;
                }
                #lesson-locker-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: rgba(15, 23, 42, 0.92);
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1.25rem;
                    transition: opacity 0.35s ease, visibility 0.35s ease;
                }
                #lesson-locker-overlay.hidden-overlay {
                    opacity: 0;
                    visibility: hidden;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        },

        injectHeaderStatus(filename, title) {
            const header = document.querySelector('header');
            if (!header) return;

            let pill = document.getElementById('lesson-locker-header-pill');
            if (!pill) {
                pill = document.createElement('div');
                pill.id = 'lesson-locker-header-pill';
                pill.className = 'flex items-center space-x-2 text-xs font-semibold';
                
                // Find appropriate insertion spot
                const controlsContainer = header.querySelector('.flex.items-center.space-x-3') || header;
                controlsContainer.prepend(pill);
            }

            const isTeacher = this.isTeacherActive();
            const unlocked = this.isUnlocked(filename);

            if (isTeacher) {
                pill.innerHTML = `
                    <div class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                        <i class="fa-solid fa-crown text-xs"></i>
                        <span>Teacher Master</span>
                    </div>
                    <a href="index.html" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition" title="Reading Hub">
                        <i class="fa-solid fa-house mr-1"></i> Hub
                    </a>
                `;
            } else if (unlocked) {
                pill.innerHTML = `
                    <button onclick="window.LessonLocker.handleManualRelock('${filename}')" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 transition" title="Click to Lock Lesson">
                        <i class="fa-solid fa-lock-open text-xs"></i>
                        <span>Unlocked</span>
                    </button>
                    <a href="index.html" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition" title="Reading Hub">
                        <i class="fa-solid fa-house mr-1"></i> Hub
                    </a>
                `;
            } else {
                pill.innerHTML = `
                    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                        <i class="fa-solid fa-lock text-xs"></i>
                        <span>Locked</span>
                    </div>
                `;
            }
        },

        renderLockOverlay(filename, title) {
            let overlay = document.getElementById('lesson-locker-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'lesson-locker-overlay';
                document.body.appendChild(overlay);
            }

            overlay.classList.remove('hidden-overlay');
            document.body.style.overflow = 'hidden';

            overlay.innerHTML = `
                <div class="locker-glow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative transform transition-all duration-300">
                    
                    <!-- Padlock Graphic -->
                    <div class="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-500 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-indigo-500/30 mb-5">
                        <i id="locker-padlock-icon" class="fa-solid fa-lock"></i>
                    </div>

                    <!-- Badge & Title -->
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800 mb-2">
                        <i class="fa-solid fa-shield-halved"></i> Protected Lesson
                    </div>

                    <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug mb-2">
                        ${title}
                    </h2>

                    <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        This Cambridge IELTS reading passage is protected. Please enter the lesson password or the Teacher Masterpass to proceed.
                    </p>

                    <!-- Form -->
                    <form id="locker-form" onsubmit="window.LessonLocker.submitOverlayUnlock(event, '${filename}', '${title.replace(/'/g, "\\'")}'); return false;" class="space-y-4">
                        <div class="relative text-left">
                            <i class="fa-solid fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input 
                                type="password" 
                                id="locker-password-input" 
                                placeholder="Enter password (e.g. BAT2026)..." 
                                autocomplete="current-password"
                                class="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                autofocus
                            >
                            <button 
                                type="button" 
                                onclick="window.LessonLocker.toggleOverlayPasswordVisibility()" 
                                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                                title="Toggle visibility"
                            >
                                <i id="locker-pwd-eye" class="fa-solid fa-eye text-sm"></i>
                            </button>
                        </div>

                        <div id="locker-error-msg" class="hidden text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl p-2.5 text-center"></div>

                        <button 
                            type="submit" 
                            id="locker-submit-btn" 
                            class="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/35 transition flex items-center justify-center gap-2"
                        >
                            <span>Unlock Lesson</span>
                            <i class="fa-solid fa-arrow-right text-xs"></i>
                        </button>
                    </form>

                    <!-- Bottom Nav -->
                    <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <a href="index.html" class="hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition flex items-center gap-1.5">
                            <i class="fa-solid fa-arrow-left"></i>
                            <span>Back to Reading Hub</span>
                        </a>
                        <span class="text-[11px] text-slate-400">Teacher: use masterpass</span>
                    </div>

                </div>
            `;

            setTimeout(() => {
                const inp = document.getElementById('locker-password-input');
                if (inp) inp.focus();
            }, 100);
        },

        toggleOverlayPasswordVisibility() {
            const inp = document.getElementById('locker-password-input');
            const eye = document.getElementById('locker-pwd-eye');
            if (!inp || !eye) return;
            if (inp.type === 'password') {
                inp.type = 'text';
                eye.className = 'fa-solid fa-eye-slash text-sm';
            } else {
                inp.type = 'password';
                eye.className = 'fa-solid fa-eye text-sm';
            }
        },

        submitOverlayUnlock(event, filename, title) {
            if (event) event.preventDefault();
            const inp = document.getElementById('locker-password-input');
            const errorEl = document.getElementById('locker-error-msg');
            const overlay = document.getElementById('lesson-locker-overlay');
            const padlock = document.getElementById('locker-padlock-icon');
            const card = overlay ? overlay.querySelector('.locker-glow') : null;

            if (!inp) return;
            const res = this.verifyPassword(inp.value, filename);

            if (res.success) {
                if (errorEl) errorEl.classList.add('hidden');
                if (padlock) {
                    padlock.className = 'fa-solid fa-lock-open animate-bounce';
                }
                
                // Play subtle success animation
                if (card) {
                    card.style.transform = 'scale(0.95)';
                    card.style.opacity = '0.7';
                }

                setTimeout(() => {
                    if (overlay) {
                        overlay.classList.add('hidden-overlay');
                    }
                    document.body.style.overflow = '';
                    this.injectHeaderStatus(filename, title);
                }, 400);
            } else {
                if (errorEl) {
                    errorEl.textContent = res.message;
                    errorEl.classList.remove('hidden');
                }
                if (card) {
                    card.classList.remove('locker-shake');
                    void card.offsetWidth; // trigger reflow
                    card.classList.add('locker-shake');
                }
                inp.focus();
                inp.select();
            }
        },

        handleManualRelock(filename) {
            if (confirm('Lock this lesson again? You will need the password or masterpass to reopen it.')) {
                this.lockLesson(filename);
                const cfg = this.getConfig(filename);
                this.renderLockOverlay(filename, cfg ? cfg.title : 'Reading Lesson');
                this.injectHeaderStatus(filename, cfg ? cfg.title : 'Reading Lesson');
            }
        }
    };

    // Auto-protect lesson if opened directly
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            try {
                const path = window.location.pathname;
                const rawName = path.split(/[/\\]/).pop();
                const filename = decodeURIComponent(rawName || '');
                if (filename && filename.toLowerCase() !== 'index.html') {
                    const norm = LessonLocker.normalizeKey(filename);
                    if (LESSON_CONFIG[norm]) {
                        LessonLocker.initLessonProtection(norm);
                    }
                }
            } catch (e) {
                console.warn('Locker auto-init skipped:', e);
            }
        });
    }

    window.LessonLocker = LessonLocker;

})(typeof window !== 'undefined' ? window : this);
