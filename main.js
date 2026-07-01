import { DataManager } from './dataManager.js';

// Global State
let data = null;
let activeEditingItem = null;
let temporaryProjectImages = [];
let currentGallery = [];
let currentIndex = 0;

// Fallback Media Assets
const SVG_FALLBACK = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" style="background:%231a1a1e;"><rect width="100%25" height="100%25" fill="%231a1a1e"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23555558">Image Not Available</text></svg>';
const PROFILE_FALLBACK = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop';

// Escape HTML for security
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Show Toast message
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast glass ${type}`;
    
    let icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    else if (type === 'info') icon = 'info';
    
    toast.innerHTML = `
        <i data-lucide="${icon}" style="color: ${type === 'error' ? '#ef4444' : 'var(--accent-primary)'}; width: 20px; height: 20px;"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    
    // Slide out and remove
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// -------------------------------------------------------------
// FRONTEND RENDERING ENGINES
// -------------------------------------------------------------

function renderPortfolio() {
    if (!data) return;

    // 1. Profile Picture & Name
    const profileImg = data.about.profileImage || PROFILE_FALLBACK;
    document.querySelectorAll('.sidebar-profile img, .mobile-profile-link img, #hero-profile-preview').forEach(img => {
        img.src = profileImg;
        img.onerror = () => { img.src = PROFILE_FALLBACK; };
    });
    
    const nameSpan = document.querySelector('.sidebar-profile h2');
    if (nameSpan) {
        const parts = data.about.name.split(' ');
        const last = parts.pop() || '';
        const first = parts.join(' ');
        nameSpan.innerHTML = `${escapeHTML(first)} <span class="gradient-text">${escapeHTML(last)}</span>`;
    }

    const heroName = document.querySelector('.hero-text h1');
    if (heroName) {
        const parts = data.about.name.split(' ');
        const last = parts.pop() || '';
        const first = parts.join(' ');
        heroName.innerHTML = `${escapeHTML(first)} <span class="gradient-text">${escapeHTML(last)}</span>`;
    }

    // 2. Typing Effect (Roles)
    if (data.about.roles && data.about.roles.length > 0) {
        initTypingEffect(data.about.roles);
    }

    // 3. Stats Section
    const stats = data.about.stats || {};
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card glass">
                <i data-lucide="code-2" class="gradient-text" style="width: 32px; height: 32px; margin-bottom: 1rem;"></i>
                <span class="stat-number gradient-text">${stats.projects || 0}</span>
                <span class="stat-label">Projects</span>
            </div>
            <div class="stat-card glass">
                <i data-lucide="award" class="gradient-text" style="width: 32px; height: 32px; margin-bottom: 1rem;"></i>
                <span class="stat-number gradient-text">${stats.achievements || 0}</span>
                <span class="stat-label">Achievements</span>
            </div>
            <div class="stat-card glass">
                <i data-lucide="scroll-text" class="gradient-text" style="width: 32px; height: 32px; margin-bottom: 1rem;"></i>
                <span class="stat-number gradient-text">${stats.certificates || 0}</span>
                <span class="stat-label">Certificates</span>
            </div>
            <div class="stat-card glass">
                <i data-lucide="coffee" class="gradient-text" style="width: 32px; height: 32px; margin-bottom: 1rem;"></i>
                <span class="stat-number gradient-text">${escapeHTML(stats.custom || '∞')}</span>
                <span class="stat-label">Coffee Cups</span>
            </div>
        `;
    }

    // Resume Url
    const resumeBtn = document.getElementById('hero-resume-btn');
    if (resumeBtn && data.about.resumeUrl) {
        resumeBtn.href = data.about.resumeUrl;
        resumeBtn.target = '_blank';
        resumeBtn.style.display = 'inline-flex';
    } else if (resumeBtn) {
        resumeBtn.style.display = 'none';
    }

    // 4. About Bio
    const aboutBio = document.getElementById('about-bio');
    if (aboutBio) {
        aboutBio.textContent = data.about.bio || '';
    }

    // 5. Skills list
    renderSkills(data.skills || []);

    // 6. Projects Section
    renderProjects(data.projects || []);

    // 7. Timeline Experience & Education
    renderTimeline(data.experience || [], 'experience-timeline');
    renderTimeline(data.education || [], 'education-timeline');

    // 8. Achievements & Certificates
    renderAchievements(data.certificates || [], data.achievements || []);

    // 9. Seminars & Trainings
    renderTrainings(data.trainings || []);

    // 10. Contact Info & Socials
    renderContact(data.contact || {});

    lucide.createIcons();
}

// Typing Effect for Roles
function initTypingEffect(roles) {
    if (window.typingTimeout) clearTimeout(window.typingTimeout);
    
    const heroTextContainer = document.querySelector('.hero-text p');
    if (heroTextContainer) {
        heroTextContainer.innerHTML = '<span style="display:block; font-size:1.6rem; font-weight:600; margin-bottom:0.75rem; color:var(--text-primary);">I am a <span class="gradient-text" id="typing-role" style="font-weight: 800;"></span><span class="typing-cursor"></span>.</span> ' + escapeHTML(data.about.bio);
    }

    const targetEl = document.getElementById('typing-role');
    if (!targetEl) return;

    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let delay = 150;

    function type() {
        const typingEl = document.getElementById('typing-role');
        if (!typingEl) return; // Guard: left page

        const currentRole = roles[roleIndex] || '';
        if (isDeleting) {
            typingEl.textContent = currentRole.substring(0, charIndex - 1);
            charIndex--;
            delay = 50;
        } else {
            typingEl.textContent = currentRole.substring(0, charIndex + 1);
            charIndex++;
            delay = 150;
        }

        if (!isDeleting && charIndex === currentRole.length) {
            isDeleting = true;
            delay = 2200; // Word pause
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            delay = 500;
        }

        window.typingTimeout = setTimeout(type, delay);
    }
    
    window.typingTimeout = setTimeout(type, 500);
}

// Render Skills section
function renderSkills(skills, activeCategory = 'All') {
    const skillsTabs = document.getElementById('skills-tabs-nav');
    const skillsList = document.getElementById('skills-list');
    if (!skillsList) return;

    const visibleSkills = skills.filter(s => s.visible !== false);
    
    const categoryMap = {
        'Frontend': 'Frontend Development',
        'Backend': 'Backend Development',
        'Databases': 'Database Management',
        'Mobile Development': 'Mobile Development',
        'Tools': 'Development Tools',
        'UI/UX': 'UI/UX Design'
    };
    
    const displayCategory = (cat) => categoryMap[cat] || cat;

    const categories = ['All', ...new Set(visibleSkills.map(s => s.category).filter(Boolean))];
    
    if (skillsTabs) {
        skillsTabs.innerHTML = categories.map(cat => `
            <button class="skills-tab-btn ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">${displayCategory(cat)}</button>
        `).join('');

        skillsTabs.querySelectorAll('.skills-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                renderSkills(skills, btn.getAttribute('data-category'));
            });
        });
    }

    const filtered = activeCategory === 'All' ? visibleSkills : visibleSkills.filter(s => s.category === activeCategory);

    const getSkillIcon = (name) => {
        const n = name.toLowerCase().trim();
        if (n.includes('html')) return 'code-2';
        if (n.includes('css')) return 'layout';
        if (n.includes('javascript') || n.includes('js') || n.includes('es6')) return 'terminal';
        if (n.includes('react native')) return 'smartphone';
        if (n.includes('react') || n.includes('expo') || n.includes('native')) return 'layers';
        if (n.includes('python')) return 'terminal';
        if (n.includes('mysql') || n.includes('sqlite') || n.includes('firebase') || n.includes('database') || n.includes('sql')) return 'database';
        if (n.includes('php')) return 'server';
        if (n.includes('figma') || n.includes('design') || n.includes('photoshop') || n.includes('ui')) return 'palette';
        if (n.includes('git') || n.includes('github')) return 'git-branch';
        return 'cpu';
    };

    skillsList.className = "skills-grid-container";
    skillsList.innerHTML = filtered.map(skill => `
        <div class="skill-card glass scroll-reveal">
            <div class="skill-icon-wrapper">
                <i data-lucide="${getSkillIcon(skill.name)}" style="width: 26px; height: 26px;"></i>
            </div>
            <h4 class="skill-card-name">${escapeHTML(skill.name)}</h4>
            <span class="skill-card-cat">${escapeHTML(displayCategory(skill.category))}</span>
        </div>
    `).join('');

    lucide.createIcons();
    
    document.querySelectorAll('.skill-card').forEach(el => {
        el.classList.add('scroll-reveal');
        setTimeout(() => el.classList.add('revealed'), 50);
    });
}

// Render Projects list
function renderProjects(projects, activeCategory = 'All') {
    const projectCats = document.getElementById('project-categories');
    const projectsList = document.getElementById('projects-list');
    if (!projectsList) return;

    const visibleProjects = projects.filter(p => p.visible !== false);
    const categories = ['All', ...new Set(visibleProjects.map(p => p.category).filter(Boolean))];

    if (projectCats) {
        projectCats.innerHTML = categories.map(cat => `
            <button class="skills-tab-btn ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>
        `).join('');

        projectCats.querySelectorAll('.skills-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                renderProjects(projects, btn.getAttribute('data-category'));
            });
        });
    }

    const filtered = activeCategory === 'All' ? visibleProjects : visibleProjects.filter(p => p.category === activeCategory);

    projectsList.innerHTML = filtered.map((proj, idx) => {
        let gridClass = 'bento-item';
        if (proj.featured) {
            gridClass += ' bento-large';
        } else if (idx % 3 === 0) {
            gridClass += ' bento-wide';
        }

        const hasImages = proj.images && proj.images.length > 0;
        
        return `
            <div class="${gridClass} glass project-card-item scroll-reveal" data-id="${proj.id}" onclick="window.openProjectDetails('${proj.id}')">
                ${proj.featured ? `<div class="featured-badge"><i data-lucide="sparkles" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Featured</div>` : ''}
                <div class="slider-container" style="width: 100%; height: 100%; position: absolute; top:0; left:0; z-index:-1; opacity: 0.85;">
                    <div class="slider-track" style="height: 100%; display: flex;">
                        ${hasImages ? proj.images.map(img => `
                            <img src="${img}" class="slide" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;" onerror="this.src='${SVG_FALLBACK}';">
                        `).join('') : `
                            <img src="${SVG_FALLBACK}" class="slide" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;">
                        `}
                    </div>
                </div>
                <div class="upload-overlay">
                    <div style="margin-right: 1.5rem;"><i data-lucide="eye" style="width: 28px; height: 28px; color:#fff;"></i></div>
                    ${proj.githubUrl ? `<a href="${proj.githubUrl}" target="_blank" style="color: white; margin-right: 1.5rem;" onclick="event.stopPropagation();"><i data-lucide="github" style="width: 26px; height: 26px;"></i></a>` : ''}
                    ${proj.liveUrl ? `<a href="${proj.liveUrl}" target="_blank" style="color: white;" onclick="event.stopPropagation();"><i data-lucide="external-link" style="width: 26px; height: 26px;"></i></a>` : ''}
                </div>
                <div style="position: relative; z-index: 5; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%); padding: 1.5rem; width: 100%; border-radius: 0 0 32px 32px; margin-top: auto; text-align: left;">
                    <h4 class="gradient-text" style="font-size: 1.4rem; text-shadow: 0 2px 4px rgba(0,0,0,0.6);">${escapeHTML(proj.title)}</h4>
                    <p style="font-size: 0.85rem; margin-top: 0.4rem; color: #eee; text-shadow: 0 1px 3px rgba(0,0,0,0.6); opacity: 1; transform:none;">${escapeHTML(proj.description)}</p>
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.8rem;">
                        ${(proj.tags || []).map(t => `<span class="tag" style="background: rgba(0, 242, 255, 0.12); color: var(--accent-primary); border: 1px solid rgba(0, 242, 255, 0.2);">${escapeHTML(t)}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();

    // Setup Slider Timers
    document.querySelectorAll('.project-card-item').forEach(card => {
        const sliderContainer = card.querySelector('.slider-container');
        if (sliderContainer && card.querySelectorAll('.slide').length > 1) {
            startSlider(sliderContainer);
        }
    });
}

// Render experience or education timeline
function renderTimeline(timelineItems, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const visibleItems = timelineItems.filter(item => item.visible !== false);
    if (visibleItems.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Timeline is empty.</p>`;
        return;
    }

    container.innerHTML = visibleItems.map(item => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <span class="timeline-date">${escapeHTML(item.duration)}</span>
            <h4 class="timeline-title">${escapeHTML(item.role || item.degree)}</h4>
            <h5 class="timeline-subtitle">${escapeHTML(item.company || item.institution)}</h5>
            <p class="timeline-desc">${escapeHTML(item.description || item.details)}</p>
            ${item.skills && item.skills.length > 0 ? `
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.8rem;">
                    ${item.skills.map(s => `<span class="tag" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">${escapeHTML(s)}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Render Achievements & Certificates grid
function renderAchievements(certs, achievements) {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    const visibleCerts = certs.filter(c => c.visible !== false);
    const visibleAchievements = achievements.filter(a => a.visible !== false);

    let html = '';

    // Render Achievements
    visibleAchievements.forEach(ach => {
        html += `
            <div class="bento-item glass achieve-card-item">
                <div style="display: flex; flex-direction: column; justify-content: flex-end; height: 100%; text-align: left;">
                    <i data-lucide="award" class="gradient-text" style="width: 40px; height: 40px; margin-bottom: 1.5rem;"></i>
                    <span class="timeline-date" style="font-size: 0.8rem;">${escapeHTML(ach.date)}</span>
                    <h3 style="font-size: 1.25rem; margin-top: 0.25rem;">${escapeHTML(ach.title)}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; opacity: 1; transform: none;">${escapeHTML(ach.description)}</p>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-top: 0.4rem; font-weight: 600;">${escapeHTML(ach.organization)}</span>
                </div>
            </div>
        `;
    });

    // Render Certificates (Clickable to lightbox)
    visibleCerts.forEach(cert => {
        html += `
            <div class="bento-item glass cert-card-item" style="min-height: 220px;" onclick="window.openLightbox(this)">
                ${cert.image ? `
                    <img src="${cert.image}" class="slide" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: -1; opacity: 0.75;" onerror="this.src='${SVG_FALLBACK}';">
                ` : `
                    <img src="${SVG_FALLBACK}" class="slide" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: -1; opacity: 0.75;">
                `}
                <div class="upload-overlay">
                    <div><i data-lucide="eye" style="width: 28px; height: 28px; color: #fff;"></i></div>
                </div>
                <div style="position: relative; z-index: 5; background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%); padding: 1.5rem; width: 100%; border-radius: 0 0 32px 32px; margin-top: auto; text-align: left;">
                    <i data-lucide="scroll-text" style="color: var(--accent-primary); width: 24px; height: 24px; margin-bottom: 0.5rem;"></i>
                    <h3 style="font-size: 1.2rem; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.6);">${escapeHTML(cert.title)}</h3>
                    <p style="font-size: 0.8rem; color: #eee; text-shadow: 0 1px 3px rgba(0,0,0,0.6); opacity: 1; transform: none;">${escapeHTML(cert.organization)} • ${escapeHTML(cert.date)}</p>
                    ${cert.credentialUrl ? `<a href="${cert.credentialUrl}" target="_blank" class="tag" style="margin-top: 0.6rem; display: inline-block; background: var(--accent-primary); color: #000;" onclick="event.stopPropagation();">Verify Certificate</a>` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Render Seminars & Trainings list
function renderTrainings(trainings) {
    const container = document.getElementById('trainings-list');
    if (!container) return;

    const visible = trainings.filter(t => t.visible !== false);
    if (visible.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem; grid-column: span 4;">No seminars to display.</p>`;
        return;
    }

    container.innerHTML = visible.map(train => {
        return `
            <div class="bento-item glass">
                <div style="display: flex; flex-direction: column; justify-content: flex-end; height: 100%; text-align: left;">
                    <i data-lucide="presentation" class="gradient-text" style="width: 36px; height: 36px; margin-bottom: 1.5rem;"></i>
                    <h4 class="gradient-text" style="font-size: 1.2rem; opacity: 1; transform: none;">${escapeHTML(train.title)}</h4>
                    <p style="font-size: 0.85rem; margin-top: 0.4rem; color: var(--text-secondary); opacity: 1; transform: none;">${escapeHTML(train.organization)} • ${escapeHTML(train.date)}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Render Contact
function renderContact(contact) {
    const form = document.getElementById('contact-form');
    if (form && contact.email) {
        form.action = `https://formsubmit.co/${contact.email}`;
        const nextInput = form.querySelector('input[name="_next"]');
        if (nextInput) {
            nextInput.value = window.location.origin + window.location.pathname;
        }
    }

    // Render footer social links
    const footerSocials = document.getElementById('footer-social-links');
    if (footerSocials) {
        const links = contact.socialLinks || {};
        let html = '';
        if (links.facebook) html += `<a href="${links.facebook}" target="_blank" title="Facebook"><i data-lucide="facebook"></i></a>`;
        if (links.github) html += `<a href="${links.github}" target="_blank" title="GitHub"><i data-lucide="github"></i></a>`;
        if (links.instagram) html += `<a href="${links.instagram}" target="_blank" title="Instagram"><i data-lucide="instagram"></i></a>`;
        if (links.linkedin) html += `<a href="${links.linkedin}" target="_blank" title="LinkedIn"><i data-lucide="linkedin"></i></a>`;
        footerSocials.innerHTML = html;
    }

    // Set contact labels if present in sidebar or footers
    const phoneInfo = document.getElementById('contact-phone');
    if (phoneInfo) phoneInfo.textContent = contact.phone || '';
}

// -------------------------------------------------------------
// ADMIN INTERFACE CONTROLLERS
// -------------------------------------------------------------

// Routing
async function handleRoute() {
    const hash = window.location.hash;
    const adminSection = document.getElementById('admin');
    
    if (hash === '#admin') {
        document.body.classList.add('admin-mode');
        if (adminSection) adminSection.style.display = 'flex';
        
        // Ensure data loaded
        if (!data) {
            data = await DataManager.init();
        }
        
        if (!data.setup) {
            renderAdminSetup();
        } else if (!DataManager.isLoggedIn()) {
            renderAdminLogin();
        } else {
            renderAdminDashboard();
        }
    } else {
        document.body.classList.remove('admin-mode');
        if (adminSection) adminSection.style.display = 'none';
        
        // Update active nav-link highlighting
        document.querySelectorAll('.nav-links a, .mobile-link').forEach(link => {
            if (link.getAttribute('href') === hash) {
                link.classList.add('active-link');
            } else {
                link.classList.remove('active-link');
            }
        });

        // Ensure page is rendered on returning from admin panel
        if (!data) {
            data = await DataManager.init();
        }
        renderPortfolio();
    }
}

// Setup Admin Screen (First time run)
function renderAdminSetup() {
    const card = document.getElementById('admin-login-card');
    card.innerHTML = `
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;" class="gradient-text">Setup Admin Account</h2>
        <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.9rem;">Configure your secure administrator login credentials.</p>
        <form id="setup-form" style="display: grid; gap: 1.5rem;">
            <div style="display: grid; gap: 0.5rem;">
                <label style="font-weight: 600; font-size: 0.9rem;">Email Address</label>
                <input type="email" id="setup-email" required class="form-control" placeholder="admin@example.com">
            </div>
            <div style="display: grid; gap: 0.5rem;">
                <label style="font-weight: 600; font-size: 0.9rem;">Password</label>
                <input type="password" id="setup-password" required class="form-control" placeholder="••••••••" minlength="8">
            </div>
            <div style="display: grid; gap: 0.5rem;">
                <label style="font-weight: 600; font-size: 0.9rem;">Confirm Password</label>
                <input type="password" id="setup-confirm" required class="form-control" placeholder="••••••••" minlength="8">
            </div>
            <button type="submit" class="btn btn-primary" style="justify-content: center;">Initialize Admin & Login <i data-lucide="check-circle"></i></button>
        </form>
    `;
    lucide.createIcons();

    document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('setup-email').value;
        const password = document.getElementById('setup-password').value;
        const confirm = document.getElementById('setup-confirm').value;

        if (password !== confirm) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        try {
            await DataManager.setupAdmin(email, password);
            showToast('Admin profile configured successfully!');
            handleRoute();
        } catch (err) {
            showToast('Setup failed: ' + err.message, 'error');
        }
    });
}

// Login Screen
function renderAdminLogin() {
    const card = document.getElementById('admin-login-card');
    card.innerHTML = `
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;" class="gradient-text">Admin Login</h2>
        <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.9rem;">Enter credentials to access the content management system.</p>
        <form id="login-form" style="display: grid; gap: 1.5rem;">
            <div style="display: grid; gap: 0.5rem;">
                <label style="font-weight: 600; font-size: 0.9rem;">Email Address</label>
                <input type="email" id="login-email" required class="form-control" placeholder="admin@example.com">
            </div>
            <div style="display: grid; gap: 0.5rem;">
                <label style="font-weight: 600; font-size: 0.9rem;">Password</label>
                <input type="password" id="login-password" required class="form-control" placeholder="••••••••">
            </div>
            <button type="submit" class="btn btn-primary" style="justify-content: center;">Log In <i data-lucide="log-in"></i></button>
            <a href="#" style="text-align: center; font-size: 0.85rem; color: var(--text-secondary);">← Return to Website</a>
        </form>
    `;
    lucide.createIcons();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const res = await DataManager.login(email, password);
        if (res.success) {
            showToast('Welcome back, Admin!');
            handleRoute();
        } else {
            showToast(res.message, 'error');
        }
    });
}

// Load Tab Content dynamically
function loadAdminTab(tabName) {
    const container = document.getElementById(tabName);
    if (!container) return;

    if (tabName === 'about-tab') {
        const stats = data.about.stats || {};
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                <h3 style="font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem;">Profile Details & Bio</h3>
                
                <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
                    <div style="position: relative;">
                        <img src="${data.about.profileImage || PROFILE_FALLBACK}" id="admin-profile-preview" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-primary);" onerror="this.src='${PROFILE_FALLBACK}'">
                        <button class="action-btn" style="position: absolute; bottom: 0; right: 0; padding: 0.4rem; border-radius: 50%; width: 32px; height: 32px;" onclick="document.getElementById('admin-profile-file').click()">
                            <i data-lucide="camera" style="width: 14px; height: 14px;"></i>
                        </button>
                        <input type="file" id="admin-profile-file" style="display:none;" accept="image/*">
                    </div>
                    <div>
                        <h4 style="font-size: 1.1rem; margin-bottom: 0.3rem;">Profile Photo</h4>
                        <p style="color: var(--text-secondary); font-size: 0.85rem;">Format limit: JPG, PNG, WEBP. Max 5MB.</p>
                    </div>
                </div>

                <form id="about-form" style="display: grid; gap: 1.5rem; margin-top: 1rem;">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" id="about-name" class="form-control" value="${data.about.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Roles (comma separated)</label>
                            <input type="text" id="about-roles" class="form-control" value="${(data.about.roles || []).join(', ')}" required>
                        </div>
                        <div class="form-group full-width">
                            <label>About Biography</label>
                            <textarea id="about-bio-text" class="form-control" rows="4" required>${data.about.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Resume Download URL</label>
                            <input type="text" id="about-resume" class="form-control" value="${data.about.resumeUrl || ''}" placeholder="https://drive.google.com/resume.pdf">
                        </div>
                    </div>

                    <h3 style="font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem; margin-top: 1.5rem;">Stats Counter</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Projects Completed</label>
                            <input type="number" id="stat-projects" class="form-control" value="${stats.projects || 0}" required>
                        </div>
                        <div class="form-group">
                            <label>Achievements</label>
                            <input type="number" id="stat-achievements" class="form-control" value="${stats.achievements || 0}" required>
                        </div>
                        <div class="form-group">
                            <label>Certificates</label>
                            <input type="number" id="stat-certificates" class="form-control" value="${stats.certificates || 0}" required>
                        </div>
                        <div class="form-group">
                            <label>Custom Stat (e.g. ∞)</label>
                            <input type="text" id="stat-custom" class="form-control" value="${stats.custom || '∞'}" required>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem; width: fit-content;">Save Profile Settings <i data-lucide="check"></i></button>
                </form>
            </div>
        `;
        lucide.createIcons();

        // Profile Photo file listener
        document.getElementById('admin-profile-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                showToast('Uploading profile image...', 'info');
                const url = await DataManager.uploadImage(file);
                data.about.profileImage = url;
                document.getElementById('admin-profile-preview').src = url;
                showToast('Profile image uploaded!');
                renderPortfolio();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        // About Form submission
        document.getElementById('about-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updated = {
                about: {
                    ...data.about,
                    name: document.getElementById('about-name').value,
                    roles: document.getElementById('about-roles').value.split(',').map(r => r.trim()).filter(Boolean),
                    bio: document.getElementById('about-bio-text').value,
                    resumeUrl: document.getElementById('about-resume').value,
                    stats: {
                        projects: parseInt(document.getElementById('stat-projects').value) || 0,
                        achievements: parseInt(document.getElementById('stat-achievements').value) || 0,
                        certificates: parseInt(document.getElementById('stat-certificates').value) || 0,
                        custom: document.getElementById('stat-custom').value
                    }
                }
            };
            data.about = updated.about; // Optimistic update
            await DataManager.save(updated);
            showToast('Profile settings saved successfully!');
            renderPortfolio();
        });
    }

    if (tabName === 'projects-tab') {
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1.5rem;">Manage Portfolio Projects</h3>
                    <button class="btn btn-primary btn-sm" id="btn-add-project"><i data-lucide="plus"></i> Add Project</button>
                </div>

                <div style="overflow-x: auto;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Thumbnail</th>
                                <th>Project Title</th>
                                <th>Category</th>
                                <th>Featured</th>
                                <th>Public Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="admin-projects-tbody">
                            ${(data.projects || []).map(p => {
                                const hasImg = p.images && p.images.length > 0;
                                const thumb = hasImg ? p.images[0] : SVG_FALLBACK;
                                return `
                                    <tr>
                                        <td><img src="${thumb}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);" onerror="this.src='${SVG_FALLBACK}';"></td>
                                        <td style="font-weight:600;">${escapeHTML(p.title)}</td>
                                        <td>${escapeHTML(p.category)}</td>
                                        <td>${p.featured ? '<span class="tag" style="background:rgba(0, 242, 255, 0.15)">Featured</span>' : '<span style="color:var(--text-secondary);">No</span>'}</td>
                                        <td>${p.visible !== false ? '<span style="color:#22c55e; font-weight:600;">Visible</span>' : '<span style="color:var(--text-secondary)">Hidden</span>'}</td>
                                        <td>
                                            <button class="action-btn action-btn-primary edit-project-btn" data-id="${p.id}"><i data-lucide="edit"></i></button>
                                            <button class="action-btn action-btn-danger delete-project-btn" data-id="${p.id}"><i data-lucide="trash-2"></i></button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        lucide.createIcons();

        // Project Buttons Hook
        document.getElementById('btn-add-project').addEventListener('click', () => openProjectModal(null));
        
        container.querySelectorAll('.edit-project-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const projId = btn.getAttribute('data-id');
                const project = data.projects.find(p => p.id === projId);
                openProjectModal(project);
            });
        });

        container.querySelectorAll('.delete-project-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this project?')) {
                    const id = btn.getAttribute('data-id');
                    const filtered = data.projects.filter(p => p.id !== id);
                    
                    data.projects = filtered; // Optimistic State Sync
                    renderPortfolio(); // Live UI Render instantly
                    
                    await DataManager.save({ projects: filtered });
                    showToast('Project deleted successfully.');
                    loadAdminTab('projects-tab'); // Sync Dashboard Table
                }
            });
        });
    }

    if (tabName === 'skills-tab') {
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1.5rem;">Manage Technical Skills</h3>
                    <button class="btn btn-primary btn-sm" id="btn-add-skill"><i data-lucide="plus"></i> Add Skill</button>
                </div>

                <div style="overflow-x: auto;">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Skill Name</th>
                                <th>Category</th>
                                <th>Proficiency Level</th>
                                <th>Visibility</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.skills || []).map(s => `
                                <tr>
                                    <td style="font-weight:600;">${escapeHTML(s.name)}</td>
                                    <td>${escapeHTML(s.category)}</td>
                                    <td>
                                        <div style="display:flex; align-items:center; gap: 0.8rem;">
                                            <span style="font-weight:600; width:35px;">${s.level}%</span>
                                            <div class="skill-bar-container" style="margin: 0; width: 120px;">
                                                <div class="skill-bar-fill" style="width: ${s.level}%"></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${s.visible !== false ? '<span style="color:#22c55e;">Visible</span>' : '<span style="color:var(--text-secondary)">Hidden</span>'}</td>
                                    <td>
                                        <button class="action-btn action-btn-primary edit-skill-btn" data-id="${s.id}"><i data-lucide="edit"></i></button>
                                        <button class="action-btn action-btn-danger delete-skill-btn" data-id="${s.id}"><i data-lucide="trash-2"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('btn-add-skill').addEventListener('click', () => openSkillModal(null));
        
        container.querySelectorAll('.edit-skill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sId = btn.getAttribute('data-id');
                const skill = data.skills.find(s => s.id === sId);
                openSkillModal(skill);
            });
        });

        container.querySelectorAll('.delete-skill-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this skill?')) {
                    const id = btn.getAttribute('data-id');
                    const filtered = data.skills.filter(s => s.id !== id);
                    
                    data.skills = filtered; // State Sync
                    renderPortfolio();
                    
                    await DataManager.save({ skills: filtered });
                    showToast('Skill deleted.');
                    loadAdminTab('skills-tab');
                }
            });
        });
    }

    if (tabName === 'timeline-tab') {
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem; display: flex; flex-direction: column; gap: 2rem;">
                <!-- Experience -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="briefcase" style="color: var(--accent-primary)"></i> Work Experience Timeline</h3>
                        <button class="btn btn-primary btn-sm" id="btn-add-exp"><i data-lucide="plus"></i> Add Experience</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <th>Role / Title</th>
                                <th>Company</th>
                                <th>Duration</th>
                                <th>Visibility</th>
                                <th>Actions</th>
                            </thead>
                            <tbody>
                                ${(data.experience || []).map(e => `
                                    <tr>
                                        <td style="font-weight:600;">${escapeHTML(e.role)}</td>
                                        <td>${escapeHTML(e.company)}</td>
                                        <td>${escapeHTML(e.duration)}</td>
                                        <td>${e.visible !== false ? '<span style="color:#22c55e">Visible</span>' : '<span style="color:var(--text-secondary)">Hidden</span>'}</td>
                                        <td>
                                            <button class="action-btn action-btn-primary edit-exp-btn" data-id="${e.id}"><i data-lucide="edit"></i></button>
                                            <button class="action-btn action-btn-danger delete-exp-btn" data-id="${e.id}"><i data-lucide="trash-2"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Education -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="graduation-cap" style="color: var(--accent-primary)"></i> Education Timeline</h3>
                        <button class="btn btn-primary btn-sm" id="btn-add-edu"><i data-lucide="plus"></i> Add Education</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <th>Degree / Title</th>
                                <th>Institution</th>
                                <th>Duration</th>
                                <th>Visibility</th>
                                <th>Actions</th>
                            </thead>
                            <tbody>
                                ${(data.education || []).map(ed => `
                                    <tr>
                                        <td style="font-weight:600;">${escapeHTML(ed.degree)}</td>
                                        <td>${escapeHTML(ed.institution)}</td>
                                        <td>${escapeHTML(ed.duration)}</td>
                                        <td>${ed.visible !== false ? '<span style="color:#22c55e">Visible</span>' : '<span style="color:var(--text-secondary)">Hidden</span>'}</td>
                                        <td>
                                            <button class="action-btn action-btn-primary edit-edu-btn" data-id="${ed.id}"><i data-lucide="edit"></i></button>
                                            <button class="action-btn action-btn-danger delete-edu-btn" data-id="${ed.id}"><i data-lucide="trash-2"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('btn-add-exp').addEventListener('click', () => openTimelineModal(null, 'experience'));
        document.getElementById('btn-add-edu').addEventListener('click', () => openTimelineModal(null, 'education'));

        container.querySelectorAll('.edit-exp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const exp = data.experience.find(e => e.id === id);
                openTimelineModal(exp, 'experience');
            });
        });

        container.querySelectorAll('.edit-edu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const edu = data.education.find(e => e.id === id);
                openTimelineModal(edu, 'education');
            });
        });

        container.querySelectorAll('.delete-exp-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this experience?')) {
                    const filtered = data.experience.filter(e => e.id !== btn.getAttribute('data-id'));
                    
                    data.experience = filtered; // State Sync
                    renderPortfolio();
                    
                    await DataManager.save({ experience: filtered });
                    showToast('Experience deleted.');
                    loadAdminTab('timeline-tab');
                }
            });
        });

        container.querySelectorAll('.delete-edu-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this education entry?')) {
                    const filtered = data.education.filter(e => e.id !== btn.getAttribute('data-id'));
                    
                    data.education = filtered; // State Sync
                    renderPortfolio();
                    
                    await DataManager.save({ education: filtered });
                    showToast('Education entry deleted.');
                    loadAdminTab('timeline-tab');
                }
            });
        });
    }

    if (tabName === 'certs-tab') {
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem; display: flex; flex-direction: column; gap: 2rem;">
                <!-- Certificates -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="scroll-text" style="color: var(--accent-primary)"></i> Certificates</h3>
                        <button class="btn btn-primary btn-sm" id="btn-add-cert"><i data-lucide="plus"></i> Add Certificate</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <th>Thumbnail</th>
                                <th>Certificate Title</th>
                                <th>Issuing Org</th>
                                <th>Date</th>
                                <th>Visibility</th>
                                <th>Actions</th>
                            </thead>
                            <tbody>
                                ${(data.certificates || []).map(c => `
                                    <tr>
                                        <td><img src="${c.image || SVG_FALLBACK}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;" onerror="this.src='${SVG_FALLBACK}';"></td>
                                        <td style="font-weight:600;">${escapeHTML(c.title)}</td>
                                        <td>${escapeHTML(c.organization)}</td>
                                        <td>${escapeHTML(c.date)}</td>
                                        <td>${c.visible !== false ? '<span style="color:#22c55e">Visible</span>' : '<span style="color:var(--text-secondary)">Hidden</span>'}</td>
                                        <td>
                                            <button class="action-btn action-btn-primary edit-cert-btn" data-id="${c.id}"><i data-lucide="edit"></i></button>
                                            <button class="action-btn action-btn-danger delete-cert-btn" data-id="${c.id}"><i data-lucide="trash-2"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Achievements -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="award" style="color: var(--accent-primary)"></i> Achievements & Awards</h3>
                        <button class="btn btn-primary btn-sm" id="btn-add-ach"><i data-lucide="plus"></i> Add Achievement</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="admin-table">
                            <thead>
                                <th>Award Title</th>
                                <th>Organization</th>
                                <th>Date</th>
                                <th>Visibility</th>
                                <th>Actions</th>
                            </thead>
                            <tbody>
                                ${(data.achievements || []).map(a => `
                                    <tr>
                                        <td style="font-weight:600;">${escapeHTML(a.title)}</td>
                                        <td>${escapeHTML(a.organization)}</td>
                                        <td>${escapeHTML(a.date)}</td>
                                        <td>${a.visible !== false ? '<span style="color:#22c55e">Visible</span>' : '<span style="color:var(--text-secondary)">Hidden</span>'}</td>
                                        <td>
                                            <button class="action-btn action-btn-primary edit-ach-btn" data-id="${a.id}"><i data-lucide="edit"></i></button>
                                            <button class="action-btn action-btn-danger delete-ach-btn" data-id="${a.id}"><i data-lucide="trash-2"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('btn-add-cert').addEventListener('click', () => openCertModal(null));
        document.getElementById('btn-add-ach').addEventListener('click', () => openAchievementModal(null));

        container.querySelectorAll('.edit-cert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const cert = data.certificates.find(c => c.id === id);
                openCertModal(cert);
            });
        });

        container.querySelectorAll('.edit-ach-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const ach = data.achievements.find(a => a.id === id);
                openAchievementModal(ach);
            });
        });

        container.querySelectorAll('.delete-cert-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this certificate?')) {
                    const filtered = data.certificates.filter(c => c.id !== btn.getAttribute('data-id'));
                    
                    data.certificates = filtered; // State Sync
                    renderPortfolio();
                    
                    await DataManager.save({ certificates: filtered });
                    showToast('Certificate deleted.');
                    loadAdminTab('certs-tab');
                }
            });
        });

        container.querySelectorAll('.delete-ach-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this achievement?')) {
                    const filtered = data.achievements.filter(a => a.id !== btn.getAttribute('data-id'));
                    
                    data.achievements = filtered; // State Sync
                    renderPortfolio();
                    
                    await DataManager.save({ achievements: filtered });
                    showToast('Achievement deleted.');
                    loadAdminTab('certs-tab');
                }
            });
        });
    }

    if (tabName === 'contact-tab') {
        const contact = data.contact || {};
        const socials = contact.socialLinks || {};
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem;">
                <h3 style="font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem; margin-bottom: 1.5rem;">Contact Information</h3>
                
                <form id="contact-info-form" style="display: grid; gap: 1.5rem;">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Inquiry Email (Recipients of FormSubmit)</label>
                            <input type="email" id="contact-email-input" class="form-control" value="${contact.email || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Contact Phone Number</label>
                            <input type="text" id="contact-phone-input" class="form-control" value="${contact.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label>Location / Address</label>
                            <input type="text" id="contact-address-input" class="form-control" value="${contact.address || ''}">
                        </div>
                        <div class="form-group">
                            <label>Google Maps Embed Src URL</label>
                            <input type="text" id="contact-map-input" class="form-control" value="${contact.mapUrl || ''}" placeholder="https://www.google.com/maps/embed?...">
                        </div>
                    </div>

                    <h3 style="font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem; margin-top: 1.5rem; margin-bottom: 1.5rem;">Social Media Handles</h3>
                    
                    <div class="form-grid">
                        <div class="form-group">
                            <label><i data-lucide="github" style="width:14px;"></i> GitHub Profile Link</label>
                            <input type="text" id="social-github" class="form-control" value="${socials.github || ''}">
                        </div>
                        <div class="form-group">
                            <label><i data-lucide="linkedin" style="width:14px;"></i> LinkedIn Profile Link</label>
                            <input type="text" id="social-linkedin" class="form-control" value="${socials.linkedin || ''}">
                        </div>
                        <div class="form-group">
                            <label><i data-lucide="facebook" style="width:14px;"></i> Facebook Link</label>
                            <input type="text" id="social-facebook" class="form-control" value="${socials.facebook || ''}">
                        </div>
                        <div class="form-group">
                            <label><i data-lucide="instagram" style="width:14px;"></i> Instagram Link</label>
                            <input type="text" id="social-instagram" class="form-control" value="${socials.instagram || ''}">
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:fit-content;">Save Contacts <i data-lucide="check"></i></button>
                </form>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('contact-info-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updated = {
                contact: {
                    email: document.getElementById('contact-email-input').value,
                    phone: document.getElementById('contact-phone-input').value,
                    address: document.getElementById('contact-address-input').value,
                    mapUrl: document.getElementById('contact-map-input').value,
                    socialLinks: {
                        github: document.getElementById('social-github').value,
                        linkedin: document.getElementById('social-linkedin').value,
                        facebook: document.getElementById('social-facebook').value,
                        instagram: document.getElementById('social-instagram').value
                    }
                }
            };
            data.contact = updated.contact; // State Sync
            await DataManager.save(updated);
            showToast('Contact information saved successfully!');
            renderPortfolio();
        });
    }

    if (tabName === 'config-tab') {
        const conf = data.config || {};
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem; display: grid; gap: 2.5rem; grid-template-columns: 1fr 1fr; align-items: start;">
                <!-- Cloud Storage Config -->
                <div>
                    <h3 style="font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem; margin-bottom: 1.5rem;">Cloud Integration Settings</h3>
                    <form id="cloud-storage-form" style="display: grid; gap: 1.2rem;">
                        <div class="form-group">
                            <label>Image Upload Solution</label>
                            <select id="config-img-solution" class="form-control" style="background:#000;">
                                <option value="local" ${conf.imageStorage === 'local' ? 'selected' : ''}>Local Server (Dev mode) / Base64 fallback (Prod)</option>
                                <option value="imgbb" ${conf.imageStorage === 'imgbb' ? 'selected' : ''}>ImgBB (Free cloud storage)</option>
                                <option value="cloudinary" ${conf.imageStorage === 'cloudinary' ? 'selected' : ''}>Cloudinary (Custom cloud storage)</option>
                            </select>
                        </div>

                        <!-- ImgBB settings -->
                        <div class="form-group config-solution-group" id="group-imgbb" style="display: ${conf.imageStorage === 'imgbb' ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem;">
                            <label>ImgBB API Key</label>
                            <input type="text" id="config-imgbb-key" class="form-control" value="${conf.imgbbApiKey || ''}" placeholder="Get key from api.imgbb.com">
                        </div>

                        <!-- Cloudinary settings -->
                        <div class="config-solution-group" id="group-cloudinary" style="display: ${conf.imageStorage === 'cloudinary' ? 'block' : 'none'};">
                            <div class="form-group">
                                <label>Cloudinary Cloud Name</label>
                                <input type="text" id="config-cloud-name" class="form-control" value="${conf.cloudinaryCloudName || ''}">
                            </div>
                            <div class="form-group" style="margin-top:1rem;">
                                <label>Cloudinary Unsigned Upload Preset</label>
                                <input type="text" id="config-upload-preset" class="form-control" value="${conf.cloudinaryUploadPreset || ''}">
                            </div>
                        </div>

                        <h3 style="font-size: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.4rem; margin-top: 1rem;">Cloud Database Synchronizer</h3>
                        
                        <div class="form-group">
                            <label>Supabase URL</label>
                            <input type="text" id="config-supabase-url" class="form-control" value="${conf.supabaseUrl || ''}" placeholder="https://xxxx.supabase.co">
                        </div>
                        <div class="form-group">
                            <label>Supabase Anon Key</label>
                            <input type="text" id="config-supabase-key" class="form-control" value="${conf.supabaseKey || ''}" placeholder="eyJhbGciOi...">
                        </div>
                        <div class="form-group">
                            <label>Firebase Database URL (Alternative REST DB)</label>
                            <input type="text" id="config-firebase-url" class="form-control" value="${conf.firebaseUrl || ''}" placeholder="https://xxxx.firebaseio.com">
                        </div>

                        <button type="submit" class="btn btn-primary" style="margin-top:1rem; width:fit-content;">Save Cloud Configs <i data-lucide="check"></i></button>
                    </form>
                </div>

                <!-- Admin Password Change -->
                <div class="glass" style="padding: 2rem;">
                    <h3 style="font-size: 1.3rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem; margin-bottom: 1.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="lock" style="color:var(--accent-primary)"></i> Change Admin Password</h3>
                    <form id="password-change-form" style="display: grid; gap: 1.2rem;">
                        <div style="display:grid; gap:0.4rem;">
                            <label style="font-weight:600; font-size:0.85rem;">Admin Email Username</label>
                            <input type="email" id="change-email" class="form-control" value="${data.admin.username}" required>
                        </div>
                        <div style="display:grid; gap:0.4rem;">
                            <label style="font-weight:600; font-size:0.85rem;">Current Password</label>
                            <input type="password" id="change-current-pass" class="form-control" required placeholder="••••••••">
                        </div>
                        <div style="display:grid; gap:0.4rem;">
                            <label style="font-weight:600; font-size:0.85rem;">New Password</label>
                            <input type="password" id="change-new-pass" class="form-control" required placeholder="••••••••" minlength="8">
                        </div>
                        <div style="display:grid; gap:0.4rem;">
                            <label style="font-weight:600; font-size:0.85rem;">Confirm New Password</label>
                            <input type="password" id="change-new-confirm" class="form-control" required placeholder="••••••••" minlength="8">
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:0.8rem; justify-content:center;">Update Password <i data-lucide="key"></i></button>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();

        // Dropdown toggle
        const select = document.getElementById('config-img-solution');
        select.addEventListener('change', () => {
            document.querySelectorAll('.config-solution-group').forEach(el => el.style.display = 'none');
            const val = select.value;
            if (val === 'imgbb') document.getElementById('group-imgbb').style.display = 'flex';
            if (val === 'cloudinary') document.getElementById('group-cloudinary').style.display = 'block';
        });

        // Cloud Submit
        document.getElementById('cloud-storage-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updated = {
                config: {
                    imageStorage: document.getElementById('config-img-solution').value,
                    imgbbApiKey: document.getElementById('config-imgbb-key').value,
                    cloudinaryCloudName: document.getElementById('config-cloud-name').value,
                    cloudinaryUploadPreset: document.getElementById('config-upload-preset').value,
                    supabaseUrl: document.getElementById('config-supabase-url').value,
                    supabaseKey: document.getElementById('config-supabase-key').value,
                    firebaseUrl: document.getElementById('config-firebase-url').value
                }
            };
            data.config = updated.config;
            await DataManager.save(updated);
            showToast('Integration configs saved successfully!');
        });

        // Password Change Submit
        document.getElementById('password-change-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('change-email').value;
            const curPass = document.getElementById('change-current-pass').value;
            const newPass = document.getElementById('change-new-pass').value;
            const confirm = document.getElementById('change-new-confirm').value;

            if (newPass !== confirm) {
                showToast('New passwords do not match.', 'error');
                return;
            }

            try {
                await DataManager.changeAdminCredentials(email, curPass, newPass);
                showToast('Password changed successfully.');
                document.getElementById('password-change-form').reset();
                document.getElementById('change-email').value = email;
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    if (tabName === 'backup-tab') {
        container.innerHTML = `
            <div class="glass" style="padding: 2.5rem; display: flex; flex-direction: column; gap: 2rem;">
                <h3 style="font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.8rem;">Database Backup & Portability</h3>
                <p style="color: var(--text-secondary); font-size: 0.95rem;">You can download your portfolio content database as a <code class="tag">data.json</code> file. Stashing this inside your <code class="tag">public/</code> directory and redeploying it makes your updates permanent for static visitors.</p>

                <div style="display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:1rem;">
                    <button class="btn btn-primary" id="btn-export-db"><i data-lucide="download"></i> Export Data (data.json)</button>
                    
                    <div style="position:relative; display:inline-block;">
                        <button class="btn" style="border: 1px solid var(--border-color);" onclick="document.getElementById('import-db-file').click()"><i data-lucide="upload"></i> Restore / Import Database</button>
                        <input type="file" id="import-db-file" style="display:none;" accept=".json">
                    </div>
                </div>

                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem; text-align:left;">
                    <h4 style="color: #ef4444; font-size: 1.1rem; margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;"><i data-lucide="alert-triangle"></i> Dangerous Action Zone</h4>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">Performing a factory reset resets all data back to the default original template database.</p>
                    <button class="btn" style="background:#ef4444; color:white;" id="btn-reset-factory"><i data-lucide="refresh-cw"></i> Factory Reset Portfolio</button>
                </div>
            </div>
        `;
        lucide.createIcons();

        // Export DB
        document.getElementById('btn-export-db').addEventListener('click', () => {
            const cleanData = { ...data };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "data.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast('Database exported successfully!');
        });

        // Import DB
        document.getElementById('import-db-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    // Basic validation
                    if (!parsed.about || !parsed.projects || !parsed.skills) {
                        throw new Error('JSON is not in correct portfolio database schema format.');
                    }
                    if (confirm('Importing this file will overwrite all existing portfolio settings and content. Continue?')) {
                        data = parsed;
                        await DataManager.save(parsed);
                        showToast('Database restored successfully!');
                        loadAdminTab('backup-tab');
                        renderPortfolio();
                    }
                } catch (err) {
                    showToast('Failed to parse file: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        });

        // Factory Reset
        document.getElementById('btn-reset-factory').addEventListener('click', async () => {
            if (confirm('Are you absolutely sure you want to perform a factory reset? This deletes all your work, projects, and settings.')) {
                try {
                    const res = await fetch(`./data.json?t=${Date.now()}`);
                    if (res.ok) {
                        const original = await res.json();
                        original.setup = false;
                        original.admin = { username: "admin", passwordHash: "", salt: "" };
                        data = original;
                        await DataManager.save(original);
                        DataManager.logout();
                        showToast('System reset complete. Setting up admin...', 'info');
                        setTimeout(() => window.location.reload(), 1000);
                    }
                } catch (e) {
                    showToast('Failed to factory reset: ' + e.message, 'error');
                }
            }
        });
    }
}

// -------------------------------------------------------------
// EDITORS MODALS TRIGGERS
// -------------------------------------------------------------

function openAdminModal(title, fieldsHTML, onSubmit) {
    const modal = document.getElementById('admin-modal');
    document.getElementById('modal-title').textContent = title;
    
    const formFields = document.getElementById('modal-form-fields');
    formFields.innerHTML = fieldsHTML;
    lucide.createIcons();

    modal.classList.add('active');

    const form = document.getElementById('modal-form');
    // Clear previous submit handlers
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Re-hook cancel/close
    newForm.querySelector('#modal-cancel-btn').addEventListener('click', closeAdminModal);
    
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await onSubmit(newForm);
            closeAdminModal();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.remove('active');
    activeEditingItem = null;
}

// Project Modal Creator/Editor
function openProjectModal(project = null) {
    activeEditingItem = { type: 'project', id: project ? project.id : null };
    temporaryProjectImages = project ? [...(project.images || [])] : [];

    const fieldsHTML = `
        <div class="form-grid">
            <div class="form-group">
                <label>Project Title</label>
                <input type="text" id="proj-title" class="form-control" value="${project ? escapeHTML(project.title) : ''}" required>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="proj-category" class="form-control" style="background:#000;">
                    <option value="Frontend" ${project && project.category === 'Frontend' ? 'selected' : ''}>Frontend</option>
                    <option value="Backend" ${project && project.category === 'Backend' ? 'selected' : ''}>Backend</option>
                    <option value="Mobile Development" ${project && project.category === 'Mobile Development' ? 'selected' : ''}>Mobile Development</option>
                    <option value="Databases" ${project && project.category === 'Databases' ? 'selected' : ''}>Databases</option>
                    <option value="Tools" ${project && project.category === 'Tools' ? 'selected' : ''}>Tools</option>
                </select>
            </div>
            <div class="form-group full-width">
                <label>Description</label>
                <textarea id="proj-desc" class="form-control" rows="3" required>${project ? escapeHTML(project.description) : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Technologies Used (comma separated)</label>
                <input type="text" id="proj-tags" class="form-control" value="${project ? escapeHTML(project.tags.join(', ')) : ''}" placeholder="React, Python, Firebase">
            </div>
            <div class="form-group">
                <label>Live Demo URL</label>
                <input type="text" id="proj-live" class="form-control" value="${project ? escapeHTML(project.liveUrl || '') : ''}">
            </div>
            <div class="form-group">
                <label>GitHub Repository URL</label>
                <input type="text" id="proj-github" class="form-control" value="${project ? escapeHTML(project.githubUrl || '') : ''}">
            </div>
            
            <div class="form-group full-width" style="margin-top:0.5rem;">
                <label>Project Images Solution (Upload multiple)</label>
                <div class="image-uploader" id="proj-uploader-drop">
                    <i data-lucide="upload-cloud" style="width: 32px; height: 32px; margin-bottom:0.5rem; color:var(--accent-primary)"></i>
                    <p style="font-size:0.85rem; color:var(--text-secondary)">Click to browse or drop an image file here.</p>
                    <input type="file" id="proj-image-file" style="display:none" accept="image/*" multiple>
                </div>
                <div class="uploaded-images-preview" id="proj-images-preview-box">
                    <!-- Image chips populated dynamically -->
                </div>
            </div>

            <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem; margin:0;">
                <label class="form-checkbox">
                    <input type="checkbox" id="proj-featured" ${project && project.featured ? 'checked' : ''}>
                    Featured Project (takes larger space in grid)
                </label>
            </div>
            <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem; margin:0;">
                <label class="form-checkbox">
                    <input type="checkbox" id="proj-visible" ${!project || project.visible !== false ? 'checked' : ''}>
                    Make Visibly Public
                </label>
            </div>
        </div>
    `;

    openAdminModal(project ? 'Edit Project Details' : 'Add New Project', fieldsHTML, async (form) => {
        const title = document.getElementById('proj-title').value;
        const category = document.getElementById('proj-category').value;
        const description = document.getElementById('proj-desc').value;
        const tags = document.getElementById('proj-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const liveUrl = document.getElementById('proj-live').value;
        const githubUrl = document.getElementById('proj-github').value;
        const featured = document.getElementById('proj-featured').checked;
        const visible = document.getElementById('proj-visible').checked;

        const updatedProj = {
            id: project ? project.id : `project-${Date.now()}`,
            title,
            category,
            description,
            tags,
            images: temporaryProjectImages,
            liveUrl,
            githubUrl,
            featured,
            visible
        };

        let updatedProjectsList = [...(data.projects || [])];
        if (project) {
            updatedProjectsList = updatedProjectsList.map(p => p.id === project.id ? updatedProj : p);
        } else {
            updatedProjectsList.push(updatedProj);
        }

        data.projects = updatedProjectsList; // Optimistic State update
        renderPortfolio(); // Re-render frontend immediately
        
        await DataManager.save({ projects: updatedProjectsList });
        showToast(project ? 'Project updated!' : 'New project added successfully.');
        loadAdminTab('projects-tab'); // Sync Dashboard Table
    });

    // Populate Image Chips
    const updateImageChips = () => {
        const box = document.getElementById('proj-images-preview-box');
        if (!box) return;
        box.innerHTML = temporaryProjectImages.map((img, index) => `
            <div class="uploaded-image-card">
                <img src="${img}" onerror="this.src='${SVG_FALLBACK}';">
                <button type="button" class="btn-delete-chip" data-index="${index}">&times;</button>
            </div>
        `).join('');

        box.querySelectorAll('.btn-delete-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                temporaryProjectImages.splice(idx, 1);
                updateImageChips();
            });
        });
    };

    updateImageChips();

    // Image Upload triggers
    const drop = document.getElementById('proj-uploader-drop');
    const fileInput = document.getElementById('proj-image-file');

    drop.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            try {
                showToast(`Uploading ${file.name}...`, 'info');
                const url = await DataManager.uploadImage(file);
                temporaryProjectImages.push(url);
                updateImageChips();
                showToast(`${file.name} uploaded successfully.`);
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    });
}

// Skills Modal Creator/Editor
function openSkillModal(skill = null) {
    activeEditingItem = { type: 'skill', id: skill ? skill.id : null };

    const fieldsHTML = `
        <div style="display:grid; gap:1.25rem;">
            <div class="form-group">
                <label>Skill Name</label>
                <input type="text" id="skill-name-input" class="form-control" value="${skill ? escapeHTML(skill.name) : ''}" required placeholder="Python, React, Figma">
            </div>
            <div class="form-group">
                <label>Proficiency Level</label>
                <div style="display:flex; align-items:center; gap: 1rem;">
                    <input type="range" id="skill-level-input" class="form-control" min="0" max="100" style="flex:1; padding:0;" value="${skill ? skill.level : 80}">
                    <span style="font-weight:600; width:40px;" id="skill-level-label">${skill ? skill.level : 80}%</span>
                </div>
            </div>
            <div class="form-group">
                <label>Skill Category</label>
                <select id="skill-cat-input" class="form-control" style="background:#000;">
                    <option value="Frontend" ${skill && skill.category === 'Frontend' ? 'selected' : ''}>Frontend</option>
                    <option value="Backend" ${skill && skill.category === 'Backend' ? 'selected' : ''}>Backend</option>
                    <option value="Mobile Development" ${skill && skill.category === 'Mobile Development' ? 'selected' : ''}>Mobile Development</option>
                    <option value="Databases" ${skill && skill.category === 'Databases' ? 'selected' : ''}>Databases</option>
                    <option value="Tools" ${skill && skill.category === 'Tools' ? 'selected' : ''}>Tools</option>
                </select>
            </div>
            <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem; margin:0;">
                <label class="form-checkbox">
                    <input type="checkbox" id="skill-visible" ${!skill || skill.visible !== false ? 'checked' : ''}>
                    Make Visibly Public
                </label>
            </div>
        </div>
    `;

    openAdminModal(skill ? 'Edit Technical Skill' : 'Add Technical Skill', fieldsHTML, async (form) => {
        const name = document.getElementById('skill-name-input').value;
        const level = parseInt(document.getElementById('skill-level-input').value);
        const category = document.getElementById('skill-cat-input').value;
        const visible = document.getElementById('skill-visible').checked;

        const updatedSkill = {
            id: skill ? skill.id : `skill-${Date.now()}`,
            name,
            level,
            category,
            visible
        };

        let list = [...(data.skills || [])];
        if (skill) {
            list = list.map(s => s.id === skill.id ? updatedSkill : s);
        } else {
            list.push(updatedSkill);
        }

        data.skills = list; // State Sync
        renderPortfolio();
        
        await DataManager.save({ skills: list });
        showToast(skill ? 'Skill details updated!' : 'Skill added successfully!');
        loadAdminTab('skills-tab');
    });

    const range = document.getElementById('skill-level-input');
    const label = document.getElementById('skill-level-label');
    range.addEventListener('input', () => label.textContent = range.value + '%');
}

// Timeline Experience/Education Modal Creator/Editor
function openTimelineModal(item = null, forceType = 'experience') {
    activeEditingItem = { type: 'timeline', id: item ? item.id : null };
    const isExp = forceType === 'experience';

    const fieldsHTML = `
        <div class="form-grid">
            <div class="form-group full-width">
                <label>Timeline Entry Category</label>
                <select id="time-category" class="form-control" style="background:#000;" ${item ? 'disabled' : ''}>
                    <option value="experience" ${isExp ? 'selected' : ''}>Work Experience</option>
                    <option value="education" ${!isExp ? 'selected' : ''}>Educational Background</option>
                </select>
            </div>
            <div class="form-group">
                <label id="time-title-label">${isExp ? 'Role / Job Title' : 'Degree / Certificate Title'}</label>
                <input type="text" id="time-title" class="form-control" value="${item ? escapeHTML(item.role || item.degree) : ''}" required placeholder="${isExp ? 'Software Engineer' : 'BS in Information Technology'}">
            </div>
            <div class="form-group">
                <label id="time-subtitle-label">${isExp ? 'Company Name' : 'School / Institution Name'}</label>
                <input type="text" id="time-subtitle" class="form-control" value="${item ? escapeHTML(item.company || item.institution) : ''}" required placeholder="${isExp ? 'Tech Corp' : 'State University'}">
            </div>
            <div class="form-group">
                <label>Duration</label>
                <input type="text" id="time-duration" class="form-control" value="${item ? escapeHTML(item.duration) : ''}" required placeholder="2022 - 2026 or Dec 2025 - Mar 2026">
            </div>
            <div class="form-group">
                <label id="time-skills-label">${isExp ? 'Key Skills Used (comma separated)' : 'Focus Subjects (comma separated)'}</label>
                <input type="text" id="time-skills" class="form-control" value="${item && item.skills ? escapeHTML(item.skills.join(', ')) : ''}" placeholder="Python, React Native, SQL">
            </div>
            <div class="form-group full-width">
                <label>Description Details</label>
                <textarea id="time-desc" class="form-control" rows="4" required>${item ? escapeHTML(item.description || item.details) : ''}</textarea>
            </div>
            <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem; margin:0;">
                <label class="form-checkbox">
                    <input type="checkbox" id="time-visible" ${!item || item.visible !== false ? 'checked' : ''}>
                    Make Visibly Public
                </label>
            </div>
        </div>
    `;

    openAdminModal(item ? `Edit Timeline Entry` : `Add Timeline Entry`, fieldsHTML, async (form) => {
        const type = document.getElementById('time-category').value;
        const title = document.getElementById('time-title').value;
        const sub = document.getElementById('time-subtitle').value;
        const duration = document.getElementById('time-duration').value;
        const skills = document.getElementById('time-skills').value.split(',').map(s => s.trim()).filter(Boolean);
        const desc = document.getElementById('time-desc').value;
        const visible = document.getElementById('time-visible').checked;

        if (type === 'experience') {
            const updatedExp = {
                id: item ? item.id : `exp-${Date.now()}`,
                role: title,
                company: sub,
                duration,
                description: desc,
                skills,
                visible
            };
            let list = [...(data.experience || [])];
            if (item) list = list.map(e => e.id === item.id ? updatedExp : e);
            else list.push(updatedExp);
            
            data.experience = list; // State Sync
            renderPortfolio();
            await DataManager.save({ experience: list });
        } else {
            const updatedEdu = {
                id: item ? item.id : `edu-${Date.now()}`,
                degree: title,
                institution: sub,
                duration,
                details: desc,
                skills,
                visible
            };
            let list = [...(data.education || [])];
            if (item) list = list.map(e => e.id === item.id ? updatedEdu : e);
            else list.push(updatedEdu);
            
            data.education = list; // State Sync
            renderPortfolio();
            await DataManager.save({ education: list });
        }

        showToast('Timeline entry saved successfully!');
        loadAdminTab('timeline-tab');
    });

    // Handle dynamic label changes based on type select
    const select = document.getElementById('time-category');
    if (select) {
        select.addEventListener('change', () => {
            const val = select.value;
            document.getElementById('time-title-label').textContent = val === 'experience' ? 'Role / Job Title' : 'Degree / Certificate Title';
            document.getElementById('time-subtitle-label').textContent = val === 'experience' ? 'Company Name' : 'School / Institution Name';
            document.getElementById('time-skills-label').textContent = val === 'experience' ? 'Key Skills Used (comma separated)' : 'Focus Subjects (comma separated)';
        });
    }
}

// Certificates modal Editor
function openCertModal(cert = null) {
    activeEditingItem = { type: 'cert', id: cert ? cert.id : null };
    let tempCertImage = cert ? cert.image : '';

    const fieldsHTML = `
        <div class="form-grid">
            <div class="form-group full-width">
                <label>Certificate Title</label>
                <input type="text" id="cert-title" class="form-control" value="${cert ? escapeHTML(cert.title) : ''}" required placeholder="Full Stack Web Developer">
            </div>
            <div class="form-group">
                <label>Issuing Organization</label>
                <input type="text" id="cert-org" class="form-control" value="${cert ? escapeHTML(cert.organization) : ''}" required placeholder="Udemy, Google, Cisco">
            </div>
            <div class="form-group">
                <label>Completion Date</label>
                <input type="text" id="cert-date" class="form-control" value="${cert ? escapeHTML(cert.date) : ''}" required placeholder="January 2026">
            </div>
            <div class="form-group full-width">
                <label>Credential Verification URL</label>
                <input type="text" id="cert-url" class="form-control" value="${cert ? escapeHTML(cert.credentialUrl || '') : ''}" placeholder="https://verify.udemy.com/xxx">
            </div>
            
            <div class="form-group full-width" style="margin-top:0.5rem;">
                <label>Certificate Image / Badge Preview</label>
                <div style="display:flex; gap:1.5rem; align-items:center;">
                    <div style="width:100px; height:100px; border-radius:10px; overflow:hidden; border:1px solid var(--border-color); background:rgba(0,0,0,0.2);">
                        <img src="${tempCertImage || SVG_FALLBACK}" id="cert-img-preview" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${SVG_FALLBACK}';">
                    </div>
                    <div>
                        <button type="button" class="btn" style="border:1px solid var(--border-color); font-size:0.85rem;" onclick="document.getElementById('cert-file-input').click()"><i data-lucide="upload"></i> Upload Image</button>
                        <input type="file" id="cert-file-input" style="display:none;" accept="image/*">
                        <p style="color:var(--text-secondary); font-size:0.75rem; margin-top:0.4rem;">Upload image file. Max size 5MB.</p>
                    </div>
                </div>
            </div>

            <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem; margin:0;">
                <label class="form-checkbox">
                    <input type="checkbox" id="cert-visible" ${!cert || cert.visible !== false ? 'checked' : ''}>
                    Make Visibly Public
                </label>
            </div>
        </div>
    `;

    openAdminModal(cert ? 'Edit Certificate Details' : 'Add New Certificate', fieldsHTML, async (form) => {
        const title = document.getElementById('cert-title').value;
        const organization = document.getElementById('cert-org').value;
        const date = document.getElementById('cert-date').value;
        const credentialUrl = document.getElementById('cert-url').value;
        const visible = document.getElementById('cert-visible').checked;

        const updatedCert = {
            id: cert ? cert.id : `cert-${Date.now()}`,
            title,
            organization,
            date,
            image: tempCertImage,
            credentialUrl,
            visible
        };

        let list = [...(data.certificates || [])];
        if (cert) list = list.map(c => c.id === cert.id ? updatedCert : c);
        else list.push(updatedCert);

        data.certificates = list; // State Sync
        renderPortfolio();
        
        await DataManager.save({ certificates: list });
        showToast('Certificate saved.');
        loadAdminTab('certs-tab');
    });

    document.getElementById('cert-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            showToast('Uploading certificate image...', 'info');
            const url = await DataManager.uploadImage(file);
            tempCertImage = url;
            document.getElementById('cert-img-preview').src = url;
            showToast('Certificate image uploaded!');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Achievements modal Editor
function openAchievementModal(ach = null) {
    activeEditingItem = { type: 'achieve', id: ach ? ach.id : null };

    const fieldsHTML = `
        <div class="form-grid">
            <div class="form-group full-width">
                <label>Achievement / Award Title</label>
                <input type="text" id="ach-title" class="form-control" value="${ach ? escapeHTML(ach.title) : ''}" required placeholder="Best Capstone Project">
            </div>
            <div class="form-group">
                <label>Organization / Presenter</label>
                <input type="text" id="ach-org" class="form-control" value="${ach ? escapeHTML(ach.organization) : ''}" required placeholder="University Tech Expo">
            </div>
            <div class="form-group">
                <label>Date Awarded</label>
                <input type="text" id="ach-date" class="form-control" value="${ach ? escapeHTML(ach.date) : ''}" required placeholder="March 2026">
            </div>
            <div class="form-group full-width">
                <label>Short Description</label>
                <textarea id="ach-desc" class="form-control" rows="3" required>${ach ? escapeHTML(ach.description) : ''}</textarea>
            </div>
            <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem; margin:0;">
                <label class="form-checkbox">
                    <input type="checkbox" id="ach-visible" ${!ach || ach.visible !== false ? 'checked' : ''}>
                    Make Visibly Public
                </label>
            </div>
        </div>
    `;

    openAdminModal(ach ? 'Edit Achievement Award' : 'Add New Achievement', fieldsHTML, async (form) => {
        const title = document.getElementById('ach-title').value;
        const organization = document.getElementById('ach-org').value;
        const date = document.getElementById('ach-date').value;
        const description = document.getElementById('ach-desc').value;
        const visible = document.getElementById('ach-visible').checked;

        const updated = {
            id: ach ? ach.id : `achieve-${Date.now()}`,
            title,
            organization,
            date,
            description,
            visible
        };

        let list = [...(data.achievements || [])];
        if (ach) list = list.map(a => a.id === ach.id ? updated : a);
        else list.push(updated);

        data.achievements = list; // State Sync
        renderPortfolio();
        
        await DataManager.save({ achievements: list });
        showToast('Achievement saved successfully.');
        loadAdminTab('certs-tab');
    });
}

// Render Admin Dashboard
function renderAdminDashboard() {
    document.getElementById('admin-login-container').style.display = 'none';
    
    const dash = document.getElementById('admin-dashboard-container');
    dash.style.display = 'block';

    // Tabs Nav Hook
    const tabs = document.getElementById('admin-tabs');
    tabs.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const contentId = btn.getAttribute('data-tab');
            document.getElementById(contentId).classList.add('active');
            
            loadAdminTab(contentId);
        });
    });

    // Initial Active Tab Load
    const activeBtn = tabs.querySelector('.admin-tab-btn.active');
    if (activeBtn) {
        loadAdminTab(activeBtn.getAttribute('data-tab'));
    }

    // Logout trigger
    const logoutBtn = document.getElementById('admin-logout-btn');
    const newLogout = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogout, logoutBtn);

    newLogout.addEventListener('click', () => {
        DataManager.logout();
        showToast('Logged out successfully.');
        dash.style.display = 'none';
        document.getElementById('admin-login-container').style.display = 'flex';
        handleRoute();
    });
}

// -------------------------------------------------------------
// TIMED SLIDER LOGIC
// -------------------------------------------------------------

function startSlider(container) {
    if (!container) return;

    // Clear old slider interval
    let oldTimer = container.getAttribute('data-timer-id');
    if (oldTimer) clearInterval(parseInt(oldTimer));

    const track = container.querySelector('.slider-track');
    const slides = container.querySelectorAll('.slide');

    if (!track || slides.length <= 1) return;

    let current = 0;
    const interval = setInterval(() => {
        if (!document.body.contains(container)) {
            clearInterval(interval);
            return;
        }
        current = (current + 1) % slides.length;
        track.style.transform = `translateX(-${current * 100}%)`;
    }, 4500);

    container.setAttribute('data-timer-id', interval);
}

// -------------------------------------------------------------
// LIGHTBOX / DYNAMIC GALLERY VIEWER
// -------------------------------------------------------------

window.openLightbox = (parent) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    // Grab all slide images inside the parent element
    const imgs = parent.querySelectorAll('.slide, img:not(#profile-preview)');
    
    currentGallery = Array.from(imgs)
        .map(img => img.src)
        .filter(src => src && !src.includes('lucide') && src !== SVG_FALLBACK && !src.includes('Image Not Available') && !src.includes('Image%20Not%20Available'));

    // Deduplicate
    currentGallery = [...new Set(currentGallery)];

    if (currentGallery.length > 0) {
        currentIndex = 0;
        updateLightboxContent();
        lightbox.classList.add('active');
    }
};

window.changeLightboxImg = (dir) => {
    if (currentGallery.length <= 1) return;

    const lightboxImg = document.getElementById('lightbox-img');
    lightboxImg.classList.add('changing');

    setTimeout(() => {
        currentIndex = (currentIndex + dir + currentGallery.length) % currentGallery.length;
        updateLightboxContent();
        lightboxImg.classList.remove('changing');
    }, 150);
};

function updateLightboxContent() {
    const lightboxImg = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');

    if (currentGallery.length > 0) {
        lightboxImg.src = currentGallery[currentIndex];
        counter.innerText = `${currentIndex + 1} / ${currentGallery.length}`;
    }

    if (currentGallery.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        counter.style.display = 'none';
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        counter.style.display = 'block';
    }
}

window.closeLightbox = (e) => {
    if (e && e.target !== e.currentTarget && !e.target.closest('.lightbox-close')) return;
    document.getElementById('lightbox').classList.remove('active');
};

// Keyboard listener for lightbox
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || !lightbox.classList.contains('active')) return;

    if (e.key === 'Escape') window.closeLightbox();
    if (e.key === 'ArrowRight') window.changeLightboxImg(1);
    if (e.key === 'ArrowLeft') window.changeLightboxImg(-1);
});

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // Attach Lightbox Error handler
    const lightboxImg = document.getElementById('lightbox-img');
    if (lightboxImg) {
        lightboxImg.onerror = () => {
            lightboxImg.src = SVG_FALLBACK;
        };
    }

    // 1. Load Data Manager
    data = await DataManager.init();

    // 2. Render Frontend Layout
    renderPortfolio();

    // 3. Routing Handler
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // 4. Contact Form submit listener with AJAX submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !message) {
                showToast('Please fill out all fields in the contact form.', 'error');
                return;
            }

            showToast('Sending message...', 'info');

            const actionUrl = contactForm.getAttribute('action') || '';
            const ajaxUrl = actionUrl.replace('https://formsubmit.co/', 'https://formsubmit.co/ajax/');

            try {
                const response = await fetch(ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        message: message
                    })
                });

                if (response.ok) {
                    showToast('Thank you! Your message has been sent successfully.', 'success');
                    contactForm.reset();
                } else {
                    throw new Error('FormSubmit AJAX failed');
                }
            } catch (err) {
                console.error('AJAX form submission failed, falling back to direct POST', err);
                contactForm.submit();
            }
        });
    }

    // 5. Initialize Background & Extra Premium Layout Logic
    new CanvasBackground();
    initScrollReveals();
    initBackToTop();
    initScrollSpy();
    
    // 6. Fade-out Preloader Screen
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => preloader.style.display = 'none', 600);
    }
});

// Safety timeout for preloader
setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader && !preloader.classList.contains('fade-out')) {
        preloader.classList.add('fade-out');
        setTimeout(() => preloader.style.display = 'none', 600);
    }
}, 1500);

// Theme switcher hooks
const themeToggles = document.querySelectorAll('#theme-toggle, #theme-toggle-mobile');
themeToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', nextTheme);
        localStorage.setItem('theme', nextTheme);
        
        themeToggles.forEach(t => {
            const icon = t.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', nextTheme === 'dark' ? 'sun' : 'moon');
            }
        });
        lucide.createIcons();
    });
});

function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a, .mobile-link');

    window.addEventListener('scroll', () => {
        let currentSectionId = '';
        const scrollPosition = window.scrollY + 200; // Offset for active triggers

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute('id');
            }
        });

        if (currentSectionId) {
            navLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href === `#${currentSectionId}`) {
                    link.classList.add('active-link');
                } else {
                    link.classList.remove('active-link');
                }
            });
        }
    });
}

// ==========================================================================
// PREMIUM LAYOUT HELPER MODULES & BACKGROUND
// ==========================================================================

class CanvasBackground {
    constructor() {
        this.canvas = document.getElementById('bg-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.shapes = [];
        this.mouse = { x: null, y: null, radius: 130 };
        this.scrollOffset = 0;
        
        this.init();
        this.animate();
        this.bindEvents();
    }
    
    init() {
        this.resize();
        
        const particleCount = Math.min(65, Math.floor((this.canvas.width * this.canvas.height) / 24000));
        this.particles = [];
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                size: Math.random() * 2 + 1,
                color: Math.random() > 0.5 ? 'rgba(0, 242, 255, 0.15)' : 'rgba(112, 0, 255, 0.15)'
            });
        }
        
        this.shapes = [];
        const shapeCount = 8;
        for (let i = 0; i < shapeCount; i++) {
            this.shapes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 20 + 15,
                type: ['circle', 'triangle', 'square'][Math.floor(Math.random() * 3)],
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.003,
                vx: (Math.random() - 0.5) * 0.12,
                vy: (Math.random() - 0.5) * 0.12,
                parallaxFactor: Math.random() * 0.25 + 0.08
            });
        }
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    bindEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.init();
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
        
        window.addEventListener('scroll', () => {
            this.scrollOffset = window.scrollY;
        });
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.shapes.forEach(shape => {
            shape.x += shape.vx;
            shape.y += shape.vy;
            shape.rotation += shape.rotSpeed;
            
            if (shape.x < -shape.size) shape.x = this.canvas.width + shape.size;
            if (shape.x > this.canvas.width + shape.size) shape.x = -shape.size;
            if (shape.y < -shape.size) shape.y = this.canvas.height + shape.size;
            if (shape.y > this.canvas.height + shape.size) shape.y = -shape.size;
            
            const finalY = shape.y - (this.scrollOffset * shape.parallaxFactor);
            
            this.ctx.save();
            this.ctx.translate(shape.x, (finalY + this.canvas.height * 2) % this.canvas.height);
            this.ctx.rotate(shape.rotation);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            this.ctx.lineWidth = 1.2;
            this.ctx.beginPath();
            
            if (shape.type === 'circle') {
                this.ctx.arc(0, 0, shape.size / 2, 0, Math.PI * 2);
            } else if (shape.type === 'square') {
                this.ctx.rect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
            } else if (shape.type === 'triangle') {
                this.ctx.moveTo(0, -shape.size / 2);
                this.ctx.lineTo(shape.size / 2, shape.size / 2);
                this.ctx.lineTo(-shape.size / 2, shape.size / 2);
                this.ctx.closePath();
            }
            
            this.ctx.stroke();
            this.ctx.restore();
        });
        
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const force = (this.mouse.radius - dist) / this.mouse.radius;
                    p.x -= dx / dist * force * 0.45;
                    p.y -= dy / dist * force * 0.45;
                }
            }
            
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        });
        
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 110) {
                    const alpha = (110 - dist) / 110 * 0.055;
                    this.ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
                    this.ctx.lineWidth = 0.8;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

window.openProjectDetails = (projId) => {
    const project = data.projects.find(p => p.id === projId);
    if (!project) return;

    const modal = document.getElementById('project-details-modal');
    if (!modal) return;

    const content = modal.querySelector('.project-details-content');
    if (!content) return;

    const hasImages = project.images && project.images.length > 0;
    let detailsSlideIndex = 0;

    content.innerHTML = `
        <div class="project-details-media">
            <div class="slider-track" style="height: 100%; display: flex; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);" id="details-slider-track">
                ${hasImages ? project.images.map(img => `
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;" onerror="this.src='${SVG_FALLBACK}';">
                `).join('') : `
                    <img src="${SVG_FALLBACK}" style="width: 100%; height: 100%; object-fit: cover; flex-shrink: 0;">
                `}
            </div>
            ${hasImages && project.images.length > 1 ? `
                <button class="project-details-carousel-nav project-details-carousel-prev" id="details-prev-btn"><i data-lucide="chevron-left"></i></button>
                <button class="project-details-carousel-nav project-details-carousel-next" id="details-next-btn"><i data-lucide="chevron-right"></i></button>
            ` : ''}
        </div>
        <div class="project-details-meta">
            <div>
                <h3 class="project-details-title">${escapeHTML(project.title)}</h3>
                <span class="tag" style="background: rgba(0, 242, 255, 0.1); color: var(--accent-primary); border: 1px solid rgba(0, 242, 255, 0.2); font-family: var(--font-mono);">${escapeHTML(project.category)}</span>
            </div>
            <div class="project-details-actions">
                ${project.liveUrl ? `<a href="${project.liveUrl}" target="_blank" class="btn btn-primary"><i data-lucide="external-link"></i> Live Demo</a>` : ''}
                ${project.githubUrl ? `<a href="${project.githubUrl}" target="_blank" class="btn btn-secondary" style="border: 1px solid var(--border-color);"><i data-lucide="github"></i> GitHub Code</a>` : ''}
            </div>
        </div>
        <p class="project-details-desc">${escapeHTML(project.description)}</p>
        <div>
            <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.1em; margin-bottom: 0.75rem; font-weight: 700;">Technologies Used</h4>
            <div class="project-details-tags">
                ${(project.tags || []).map(t => `<span class="tag" style="background: rgba(255, 255, 255, 0.03); color: var(--text-primary); border: 1px solid var(--border-color);">${escapeHTML(t)}</span>`).join('')}
            </div>
        </div>
    `;

    lucide.createIcons();
    modal.classList.add('active');

    if (hasImages && project.images.length > 1) {
        const track = document.getElementById('details-slider-track');
        const prev = document.getElementById('details-prev-btn');
        const next = document.getElementById('details-next-btn');

        const updateDetailsSlider = () => {
            track.style.transform = `translateX(-${detailsSlideIndex * 100}%)`;
        };

        prev.addEventListener('click', (e) => {
            e.stopPropagation();
            detailsSlideIndex = (detailsSlideIndex - 1 + project.images.length) % project.images.length;
            updateDetailsSlider();
        });

        next.addEventListener('click', (e) => {
            e.stopPropagation();
            detailsSlideIndex = (detailsSlideIndex + 1) % project.images.length;
            updateDetailsSlider();
        });
    }
};

window.closeProjectDetails = (e) => {
    if (e && e.target !== e.currentTarget && !e.target.closest('.modal-close')) return;
    document.getElementById('project-details-modal').classList.remove('active');
};

function initScrollReveals() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.10
    });

    document.querySelectorAll('section, .timeline-item, .bento-item, .skill-card, .about-card-wrapper').forEach(el => {
        el.classList.add('scroll-reveal');
        observer.observe(el);
    });
}

function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}
