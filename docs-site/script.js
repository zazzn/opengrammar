// ===================================
// OpenGrammar Documentation Scripts
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Initialize navigation
    initNavigation();
    
    // Initialize tabs
    initTabs();
    
    // Initialize FAQ
    initFAQ();
    
    // Initialize search
    initSearch();
    
    // Initialize mobile menu
    initMobileMenu();
    
    // Initialize code copy
    initCodeCopy();
    
    // Initialize smooth scroll
    initSmoothScroll();
});

// Theme Toggle
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
    
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
    
    // Desktop theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const isDark = document.body.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
    
    // Mobile theme toggle
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const isDark = document.body.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
}

// Navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    
    // Handle nav link clicks
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-page');
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Show target section
            showSection(targetId);
            
            // Update URL hash
            window.location.hash = targetId;
            
            // Close mobile menu if open
            closeMobileMenu();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    
    // Handle initial hash
    const hash = window.location.hash.slice(1);
    if (hash) {
        showSection(hash);
        navLinks.forEach(link => {
            if (link.getAttribute('data-page') === hash) {
                link.classList.add('active');
            }
        });
    } else {
        // Default to quick-start
        showSection('quick-start');
        const firstLink = document.querySelector('.nav-link[data-page="quick-start"]');
        if (firstLink) firstLink.classList.add('active');
    }
    
    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1);
        if (hash) {
            showSection(hash);
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-page') === hash);
            });
        }
    });
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
    
    // Update breadcrumb
    updateBreadcrumb(sectionId);
}

function updateBreadcrumb(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const navLink = document.querySelector(`.nav-link[data-page="${sectionId}"]`);
    if (!navLink) return;
    
    const sectionTitle = navLink.textContent.trim();
    const sectionGroup = navLink.closest('.nav-section');
    const groupName = sectionGroup?.querySelector('.nav-section-title')?.textContent.trim() || 'Docs';
    
    const breadcrumbs = document.querySelectorAll('.breadcrumb');
    breadcrumbs.forEach(breadcrumb => {
        const parentSection = breadcrumb.closest('.content-section');
        if (parentSection && parentSection.id === sectionId) {
            breadcrumb.innerHTML = `
                <a href="#">Docs</a>
                <span class="breadcrumb-sep">/</span>
                <span>${groupName}</span>
                <span class="breadcrumb-sep">/</span>
                <span class="current">${sectionTitle}</span>
            `;
        }
    });
}

// Tabs
function initTabs() {
    const tabContainers = document.querySelectorAll('.tabs');
    
    tabContainers.forEach(container => {
        const buttons = container.querySelectorAll('.tab-btn');
        const panes = container.querySelectorAll('.tab-pane');
        
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Update active button
                buttons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                
                // Update active pane
                panes.forEach(pane => {
                    pane.classList.toggle('active', pane.id === targetTab);
                });
            });
        });
    });
}

// FAQ
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question?.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active', !isActive);
        });
    });
}

// Search
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            return;
        }
        
        // Search in section titles
        const sections = document.querySelectorAll('.content-section');
        let foundMatch = false;
        
        sections.forEach(section => {
            const title = section.querySelector('h1')?.textContent.toLowerCase() || '';
            const description = section.querySelector('.section-description')?.textContent.toLowerCase() || '';
            
            if (title.includes(query) || description.includes(query)) {
                if (!foundMatch) {
                    showSection(section.id);
                    foundMatch = true;
                    
                    // Update nav
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.classList.toggle('active', link.getAttribute('data-page') === section.id);
                    });
                }
            }
        });
        
        if (foundMatch) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput?.focus();
        }
    });
}

// Mobile Menu
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    menuToggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
    });
    
    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (sidebar && !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
            closeMobileMenu();
        }
    });
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.remove('open');
}

// Code Copy
function initCodeCopy() {
    document.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.copy-btn');
        if (!copyBtn) return;
        
        const codeBlock = copyBtn.closest('.code-block');
        const code = codeBlock?.querySelector('code')?.textContent;
        
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                // Show success feedback
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Copied!
                `;
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });
        }
    });
}

// Copy code function (global)
window.copyCode = function(btn) {
    const codeBlock = btn.closest('.code-block');
    const code = codeBlock?.querySelector('code')?.textContent;
    
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            const originalText = btn.innerHTML;
            btn.innerHTML = `
                <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                Copied!
            `;
            
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        });
    }
};

// Smooth Scroll
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// Highlight active section on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('.content-section.active');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // This could be enhanced to update nav based on scroll position
    // for long pages with multiple subsections
});

// Add animation on section change
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && mutation.target.classList.contains('content-section')) {
                if (mutation.target.classList.contains('active')) {
                    mutation.target.style.animation = 'none';
                    mutation.target.offsetHeight; // Trigger reflow
                    mutation.target.style.animation = 'fadeIn 0.3s ease';
                }
            }
        });
    });
    
    document.querySelectorAll('.content-section').forEach(section => {
        observer.observe(section, { attributes: true });
    });
});
