// Navbar Component - Shared across all pages
// Injects navbar dynamically with authentication state

const NAVBAR_HTML = `
<nav class="main-nav">
    <div class="nav-container">
        <a href="/" class="nav-logo">
            <img src="https://static-cdn.jtvnw.net/jtv_user_pictures/1efe260a-d1d3-4215-9c9f-5a24aea55625-profile_image-70x70.png" alt="xsgwen">
            <span>xsgwen</span>
        </a>
        <ul class="nav-links">
            <li><a href="/"><i data-lucide="home"></i> Accueil</a></li>
            <li><a href="/cemantix"><i data-lucide="target"></i> Cemantix</a></li>
            <li><a href="/planning"><i data-lucide="calendar"></i> Planning</a></li>
            <li><a href="/clips"><i data-lucide="film"></i> Clips</a></li>
            <li><a href="/commands"><i data-lucide="scroll-text"></i> Commandes</a></li>
            <li><a href="/stats"><i data-lucide="bar-chart-3"></i> Stats</a></li>
            <li><a href="/sudoku"><i data-lucide="grid-3x3"></i> Sudoku</a></li>
            <li class="admin-link" style="display: none;"><a href="/polls"><i data-lucide="bar-chart-2"></i> Sondages</a></li>
            <li class="admin-link" style="display: none;"><a href="/admin"><i data-lucide="shield"></i> Admin</a></li>
        </ul>
        <div class="nav-right">
            <div id="authSection">
                <a href="/auth/login" class="nav-login-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                    </svg>
                    Connexion
                </a>
            </div>
        </div>
    </div>
</nav>
`;

// CSS for new navbar elements - using higher specificity to override page-specific styles
const NAVBAR_STYLES = `
<style>
/* Navbar container layout */
nav.main-nav .nav-container {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    max-width: 1200px !important;
    margin: 0 auto !important;
    gap: 1.5rem !important;
}

nav.main-nav .nav-right {
    display: flex !important;
    align-items: center !important;
    gap: 0.75rem !important;
    flex-shrink: 0 !important;
}

/* Login button */
nav.main-nav .nav-login-btn {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    padding: 0.6rem 1.25rem !important;
    background: #9146FF !important;
    color: white !important;
    border-radius: 12px !important;
    text-decoration: none !important;
    font-weight: 600 !important;
    font-size: 0.9rem !important;
    transition: all 0.2s !important;
    white-space: nowrap !important;
}

nav.main-nav .nav-login-btn svg {
    width: 18px !important;
    height: 18px !important;
    flex-shrink: 0 !important;
}

nav.main-nav .nav-login-btn:hover {
    background: #7c3aed !important;
    transform: translateY(-2px) !important;
}

/* User section when logged in */
nav.main-nav .nav-user {
    display: flex !important;
    align-items: center !important;
    gap: 0.75rem !important;
}

nav.main-nav .nav-user-avatar {
    width: 32px !important;
    height: 32px !important;
    border-radius: 50% !important;
    border: 2px solid var(--pink-accent) !important;
    flex-shrink: 0 !important;
}

nav.main-nav .nav-user-name {
    font-weight: 500 !important;
    font-size: 0.9rem !important;
    color: var(--text-primary) !important;
    white-space: nowrap !important;
}

nav.main-nav .nav-logout-btn {
    padding: 0.4rem 0.75rem !important;
    background: var(--bg-card) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: 8px !important;
    color: var(--text-muted) !important;
    text-decoration: none !important;
    font-size: 0.8rem !important;
    transition: all 0.2s !important;
    white-space: nowrap !important;
}

nav.main-nav .nav-logout-btn:hover {
    background: var(--bg-input) !important;
    color: var(--text-primary) !important;
}

/* Responsive */
@media (max-width: 1000px) {
    nav.main-nav .nav-user-name {
        display: none !important;
    }
}

@media (max-width: 800px) {
    nav.main-nav .nav-links {
        display: none !important;
    }
}
</style>
`;

// Inject navbar and check auth
async function initNavbar() {
    // Inject CSS into head for higher priority
    document.head.insertAdjacentHTML('beforeend', NAVBAR_STYLES);

    // Find placeholder or prepend to body
    const placeholder = document.getElementById('navbar-placeholder');
    if (placeholder) {
        placeholder.outerHTML = NAVBAR_HTML;
    } else {
        document.body.insertAdjacentHTML('afterbegin', NAVBAR_HTML);
    }

    // Check authentication status
    try {
        const res = await fetch('/api/auth/user');
        const data = await res.json();

        const authSection = document.getElementById('authSection');
        const adminLinks = document.querySelectorAll('.admin-link');

        if (data.authenticated) {
            // Show user info
            authSection.innerHTML = `
                <div class="nav-user">
                    <img src="${data.user.profile_image_url}" alt="${data.user.display_name}" class="nav-user-avatar">
                    <span class="nav-user-name">${data.user.display_name}</span>
                    <a href="/auth/logout" class="nav-logout-btn">Déconnexion</a>
                </div>
            `;

            // Show admin links if admin
            if (data.isAdmin) {
                adminLinks.forEach(link => link.style.display = 'list-item');
            }
        }
    } catch (e) {
        console.error('Error checking auth status:', e);
    }

    // Set active nav link
    setActiveNav();

    // Initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Set active nav link based on current path
function setActiveNav() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === path || (path === '/' && href === '/')) {
            link.classList.add('active');
        }
    });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
} else {
    initNavbar();
}
