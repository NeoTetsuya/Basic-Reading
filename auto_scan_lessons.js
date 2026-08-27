/**
 * Auto-Scanner & Metadata Generator for IELTS Reading Companion
 * 
 * Automatically scans all reading lesson HTML files in the folder,
 * extracts passage text, questions, question types, vocabulary terms,
 * and regenerates `js/lessons-data.js` dynamically.
 * 
 * Usage:
 *   node auto_scan_lessons.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'js', 'lessons-data.js');

// Category & Aesthetic Rules
const CATEGORY_MAP = {
    nature: {
        label: 'Nature & Zoology',
        badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        gradient: 'from-blue-600 to-indigo-700',
        icon: 'fa-solid fa-feather-pointed'
    },
    medicine: {
        label: 'Health & Medicine',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        gradient: 'from-rose-600 to-red-700',
        icon: 'fa-solid fa-notes-medical'
    },
    science: {
        label: 'Science & Psychology',
        badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        gradient: 'from-purple-600 to-violet-700',
        icon: 'fa-solid fa-brain'
    },
    history: {
        label: 'History & Archaeology',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        gradient: 'from-slate-600 to-slate-800',
        icon: 'fa-solid fa-monument'
    },
    economics: {
        label: 'Economics & Society',
        badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
        gradient: 'from-cyan-600 to-blue-700',
        icon: 'fa-solid fa-chart-line'
    },
    general: {
        label: 'Academic Reading',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        gradient: 'from-indigo-600 to-violet-700',
        icon: 'fa-solid fa-book-open'
    }
};

function detectCategory(filename, text) {
    const lower = (filename + ' ' + text).toLowerCase();
    if (lower.includes('bat') || lower.includes('butterfl') || lower.includes('kakapo') || lower.includes('manatee') || lower.includes('animal') || lower.includes('species') || lower.includes('zoology') || lower.includes('plant')) {
        return 'nature';
    }
    if (lower.includes('pain') || lower.includes('birth') || lower.includes('calorie') || lower.includes('exercise') || lower.includes('health') || lower.includes('medical') || lower.includes('patient') || lower.includes('drug')) {
        return 'medicine';
    }
    if (lower.includes('brain') || lower.includes('neuro') || lower.includes('psycholog') || lower.includes('cognit') || lower.includes('mental')) {
        return 'science';
    }
    if (lower.includes('stonehenge') || lower.includes('history') || lower.includes('archaeolog') || lower.includes('ancient') || lower.includes('megalith')) {
        return 'history';
    }
    if (lower.includes('invest') || lower.includes('seller') || lower.includes('buyer') || lower.includes('econom') || lower.includes('market') || lower.includes('finance')) {
        return 'economics';
    }
    return 'general';
}

function detectIcon(cat, filename) {
    const fn = filename.toLowerCase();
    if (fn.includes('bat')) return 'fa-solid fa-shield-cat';
    if (fn.includes('butterfl')) return 'fa-solid fa-bugs';
    if (fn.includes('kakapo')) return 'fa-solid fa-feather-pointed';
    if (fn.includes('manatee')) return 'fa-solid fa-water';
    if (fn.includes('stonehenge')) return 'fa-solid fa-monument';
    if (fn.includes('brain')) return 'fa-solid fa-brain';
    if (fn.includes('pain')) return 'fa-solid fa-notes-medical';
    if (fn.includes('birth')) return 'fa-solid fa-clock-rotate-left';
    if (fn.includes('calorie') || fn.includes('exercise')) return 'fa-solid fa-person-running';
    if (fn.includes('invest')) return 'fa-solid fa-chart-line';
    return CATEGORY_MAP[cat]?.icon || 'fa-solid fa-book-open';
}

function extractJsArray(fileContent, varName) {
    const regex = new RegExp(`const\\s+${varName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`, 'm');
    const match = fileContent.match(regex);
    if (!match) return [];
    try {
        // Use Function constructor in safe closure to evaluate literal JS array
        return new Function(`return ${match[1]};`)();
    } catch (e) {
        // Fallback: try parsing with cleaner quotes if simple structure
        return [];
    }
}

function stripHtmlTags(str) {
    return str.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
}

function parseLessonFile(filename) {
    const filePath = path.join(ROOT_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Extract Page Title
    const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim() : filename.replace(/_/g, ' ').replace(/\.html$/i, '');
    
    // Extract H1 if available
    const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const fullTitle = h1Match ? stripHtmlTags(h1Match[1]) : rawTitle;

    // Clean short title
    let shortTitle = fullTitle.split('—')[0].split('-')[0].trim();
    if (!shortTitle) shortTitle = rawTitle.split('—')[0].trim();

    // 2. Extract Data Arrays
    const passageData = extractJsArray(content, 'passageData');
    const questionsData = extractJsArray(content, 'questionsData');
    const vocabList = extractJsArray(content, 'vocabList');

    // 3. Questions Metadata
    const questionCount = questionsData.length > 0 ? questionsData.length : 10;
    const questionRange = questionsData.length > 0 
        ? `Q1–Q${questionsData.length}` 
        : 'Q1–Q10';

    const rawTypes = questionsData.map(q => q.type).filter(Boolean);
    const uniqueTypes = [...new Set(rawTypes)];
    const questionTypes = uniqueTypes.length > 0 ? uniqueTypes : ['True / False / Not Given', 'Reading Analysis'];

    // 4. Passage Word Count & Reading Time
    let totalWords = 0;
    let firstParagraph = '';
    passageData.forEach((p, idx) => {
        if (p.en) {
            const cleanEn = stripHtmlTags(p.en);
            if (idx === 0) firstParagraph = cleanEn;
            totalWords += cleanEn.split(/\s+/).filter(Boolean).length;
        }
    });

    if (totalWords === 0) totalWords = 750;
    const readingTimeMin = Math.max(8, Math.round(totalWords / 45));

    // 5. Vocabulary Metadata
    const vocabCount = vocabList.length > 0 ? vocabList.length : 15;
    const keyVocab = vocabList.slice(0, 4).map(v => ({
        word: v.word || 'Vocabulary',
        meaning: v.vi || v.enDef || 'IELTS Reading Term'
    }));

    // 6. Category & Aesthetics
    const category = detectCategory(filename, fullTitle + ' ' + firstParagraph);
    const catConfig = CATEGORY_MAP[category] || CATEGORY_MAP.general;
    const icon = detectIcon(category, filename);

    // 7. Difficulty estimation
    let difficultyScore = 7.0;
    if (questionCount >= 12) difficultyScore = 7.5;
    if (totalWords > 900) difficultyScore = 8.0;
    if (questionCount <= 5) difficultyScore = 6.5;
    const difficulty = `Band ${difficultyScore.toFixed(1)}`;

    // 8. Description summary
    let description = '';
    if (firstParagraph) {
        description = firstParagraph.length > 180 
            ? firstParagraph.substring(0, 175).trim() + '...'
            : firstParagraph;
    } else {
        description = `Comprehensive Cambridge IELTS reading module on ${shortTitle} with evidence mapping and vocabulary.`;
    }

    const id = filename.replace(/_reading_analysis_vocabulary\.html$/i, '')
                       .replace(/\.html$/i, '')
                       .replace(/[^a-zA-Z0-9_]/g, '_')
                       .toLowerCase();

    return {
        id,
        filename,
        title: shortTitle,
        fullTitle,
        subtitle: `IELTS Academic Reading Analysis & Vocabulary`,
        category,
        categoryLabel: catConfig.label,
        topic: shortTitle,
        difficulty,
        difficultyScore,
        questionCount,
        questionRange,
        readingTimeMin,
        wordCount: totalWords,
        vocabCount,
        icon,
        themeColor: catConfig.gradient,
        badgeColor: catConfig.badge,
        description,
        questionTypes,
        keyVocab
    };
}

function scanAndGenerate() {
    console.log('🔍 Scanning directory for IELTS reading lesson files...');
    const files = fs.readdirSync(ROOT_DIR).filter(file => {
        return file.endsWith('.html') && 
               file !== 'index.html' && 
               !file.includes('.bak') &&
               !file.startsWith('_') &&
               !file.startsWith('backup');
    });

    console.log(`📂 Found ${files.length} lesson files.`);

    const lessons = files.map(f => {
        try {
            console.log(`  -> Processing: ${f}`);
            return parseLessonFile(f);
        } catch (err) {
            console.error(`  ❌ Error processing ${f}:`, err.message);
            return null;
        }
    }).filter(Boolean);

    const fileContent = `/**
 * AUTO-GENERATED IELTS ACADEMIC READING LESSONS DATASET
 * Generated on: ${new Date().toISOString()}
 * Total Lessons: ${lessons.length}
 * 
 * Run 'node auto_scan_lessons.js' or double-click 'auto_scan_lessons.bat' to update.
 */
const LESSONS_DATA = ${JSON.stringify(lessons, null, 4)};

if (typeof window !== 'undefined') {
    window.LESSONS_DATA = LESSONS_DATA;
}
`;

    // Ensure js directory exists
    const jsDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(jsDir)) {
        fs.mkdirSync(jsDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf8');
    console.log(`\n✅ Successfully generated '${OUTPUT_FILE}' with ${lessons.length} lessons!`);
}

scanAndGenerate();
