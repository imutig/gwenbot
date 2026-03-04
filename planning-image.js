/**
 * Planning Image Generator
 * Uses `planning_example` as source of truth and renders it via Playwright.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_NAMES_FULL = DAY_NAMES;
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const TEMPLATE_PATH = path.join(__dirname, 'planning_example');
let browserPromise = null;
let templateCache = null;

function getCurrentWeekMonday() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function parseDayName(input) {
    const normalized = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const mapping = {
        'lundi': 0, 'lun': 0,
        'mardi': 1, 'mar': 1,
        'mercredi': 2, 'mer': 2,
        'jeudi': 3, 'jeu': 3,
        'vendredi': 4, 'ven': 4,
        'samedi': 5, 'sam': 5,
        'dimanche': 6, 'dim': 6,
    };
    return mapping[normalized] ?? -1;
}

function weekLabel(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `Semaine du ${weekStart.getDate()} au ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]} 🎀`;
}

function loadTemplateHtml() {
    if (!templateCache) {
        templateCache = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    }
    return templateCache;
}

function resolveAvatarSource() {
    const avatarUrl = process.env.PLANNING_AVATAR_URL || process.env.STREAMER_AVATAR_URL;
    if (avatarUrl) {
        return avatarUrl;
    }

    const avatarPath = process.env.PLANNING_AVATAR_PATH || process.env.STREAMER_AVATAR_PATH;
    if (avatarPath) {
        const absolutePath = path.isAbsolute(avatarPath)
            ? avatarPath
            : path.join(__dirname, avatarPath);

        if (fs.existsSync(absolutePath)) {
            const ext = path.extname(absolutePath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            const base64 = fs.readFileSync(absolutePath).toString('base64');
            return `data:${mime};base64,${base64}`;
        }
    }

    return null;
}

function normalizeStreams(streams = []) {
    const byDay = new Map();
    for (const stream of streams) {
        if (typeof stream.dayIndex === 'number' && stream.dayIndex >= 0 && stream.dayIndex <= 6) {
            byDay.set(stream.dayIndex, stream);
        }
    }
    return byDay;
}

function buildDayColumnHtml(stream, dayIndex) {
    const day = DAY_NAMES[dayIndex];

    if (!stream) {
        return `
        <div class="flex flex-col h-full transform transition duration-300 hover:-translate-y-1">
            <div class="bg-white/50 rounded-t-2xl py-3 text-center border-2 border-pastel-pink border-dashed border-b-0 shadow-sm">
                <div class="mb-1 flex items-end justify-center gap-0.5 select-none" aria-label="Repos">
                    <span class="text-base leading-none font-bold text-pastel-dark/65">z</span>
                    <span class="text-xl leading-none font-extrabold text-pastel-dark/75">Z</span>
                    <span class="text-2xl leading-none font-extrabold text-pastel-dark/90">Z</span>
                </div>
                <h2 class="font-bold text-pastel-text/60">${day}</h2>
            </div>
            <div class="bg-pastel-pink/20 rounded-b-2xl border-2 border-pastel-pink border-dashed p-2.5 flex flex-col items-center justify-center flex-1">
                <p class="font-bold text-pastel-dark text-lg mb-1">Repos</p>
                <p class="text-xs text-pastel-text/70 text-center">Je dors pour reprendre des forces !</p>
            </div>
        </div>`;
    }

    const time = stream.endTime ? `${stream.time} - ${stream.endTime}` : `${stream.time}`;
    const game = stream.game || 'Just Chatting';
    const note = stream.note || '';
    const noteHtml = note
        ? `<p class="text-[11px] text-pastel-text/80 mt-1.5 leading-tight">${note}</p>`
        : '';

    return `
    <div class="flex flex-col h-full transform transition duration-300 hover:-translate-y-1">
        <div class="bg-white rounded-t-2xl py-3 text-center border-2 border-pastel-pink border-b-0 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pastel-accent to-pink-300"></div>
            <h2 class="font-bold text-pastel-dark">${day}</h2>
        </div>
        <div class="bg-white/60 backdrop-blur-sm rounded-b-2xl border-2 border-pastel-pink p-2.5 flex flex-col gap-3 flex-1 shadow-inner">
            <div class="bg-white rounded-xl p-3 shadow-sm border border-pastel-pink/50 flex flex-col items-center text-center">
                <div class="bg-pastel-pink text-pastel-dark text-xs font-bold py-1 px-3 rounded-full mb-2">${time}</div>
                <h3 class="font-bold text-pastel-dark leading-tight">${game}</h3>
                ${noteHtml}
            </div>
        </div>
    </div>`;
}

async function getBrowser() {
    if (!browserPromise) {
        browserPromise = chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    }
    return browserPromise;
}

async function generatePlanningImage(streams = [], weekStart = null) {
    const monday = weekStart ? new Date(weekStart) : getCurrentWeekMonday();
    monday.setHours(0, 0, 0, 0);

    const streamsByDay = normalizeStreams(streams);
    const dayColumnsHtml = DAY_NAMES.map((_, index) => buildDayColumnHtml(streamsByDay.get(index), index)).join('');
    const weekText = weekLabel(monday);
    const avatarSource = resolveAvatarSource();

    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720, deviceScaleFactor: 1 } });

    try {
        const html = loadTemplateHtml();
        await page.setContent(html, { waitUntil: 'networkidle' });

        await page.evaluate(({ dayColumnsHtmlInner, weekTextInner, avatarSourceInner }) => {
            const grid = document.querySelector('div.grid.grid-cols-7.gap-4.flex-1.mb-8');
            if (!grid) throw new Error('Grille planning introuvable');
            grid.innerHTML = dayColumnsHtmlInner;

            const allPills = Array.from(document.querySelectorAll('p'));
            const weekPill = allPills.find((p) => p.textContent && p.textContent.includes('Semaine du'));
            if (weekPill) {
                weekPill.textContent = weekTextInner;
            }

            const avatarImg = document.querySelector('img[alt="Avatar"]');
            if (avatarImg && avatarSourceInner) {
                avatarImg.src = avatarSourceInner;
            }
        }, { dayColumnsHtmlInner: dayColumnsHtml, weekTextInner: weekText, avatarSourceInner: avatarSource });

        await page.waitForTimeout(220);

        const zone = await page.$('#capture-zone');
        if (!zone) {
            throw new Error('Capture zone introuvable');
        }

        return await zone.screenshot({ type: 'png' });
    } finally {
        await page.close();
    }
}

async function closePlanningRenderer() {
    if (browserPromise) {
        const browser = await browserPromise;
        browserPromise = null;
        await browser.close();
    }
}

process.on('exit', () => {
    if (browserPromise) {
        browserPromise.then((browser) => browser.close()).catch(() => {});
    }
});

module.exports = {
    generatePlanningImage,
    getCurrentWeekMonday,
    parseDayName,
    DAY_NAMES,
    DAY_NAMES_FULL,
    MONTH_NAMES,
    closePlanningRenderer,
};
