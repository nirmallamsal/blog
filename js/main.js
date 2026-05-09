const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Mobile Navigation Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Close mobile menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });

    // Contact Form Submission (Mock)
    const contactForm = document.getElementById('contact-form');
    if(contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button');
            const originalText = btn.textContent;
            
            if (!SCRIPT_URL) {
                alert('Database URL not configured. Please check main.js.');
                return;
            }

            btn.textContent = 'Sending...';
            btn.disabled = true;

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'submitInquiry',
                        data: { ...formData, type: 'contact' }
                    })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    btn.textContent = 'Message Sent!';
                    contactForm.reset();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Submission error:', error);
                btn.textContent = 'Error! Try Again';
            } finally {
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 4000);
            }
        });
    }


    // Fetch and render marathons
    function formatDisplayTime(timeStr) {
        if (!timeStr) return '-';
        timeStr = String(timeStr).replace(/^[-]+/, '');
        if (timeStr.includes('T') && timeStr.includes('Z')) {
            try {
                const d = new Date(timeStr);
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                const ss = String(d.getSeconds()).padStart(2, '0');
                return `${hh}:${mm}:${ss}`;
            } catch(e) {}
        }
        if (/^\d{6}$/.test(timeStr)) {
            return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
        }
        return timeStr;
    }

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    async function loadMarathons() {
        const raceList = document.getElementById('race-list');
        
        if (!SCRIPT_URL) {
            const placeholderSvg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70"><rect width="70" height="70" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-weight="bold" font-size="12" fill="#94a3b8">LOGO</text></svg>')}`;

            raceList.innerHTML = `
                <div class="race-card">
                    <img src="https://excelsheet101.github.io/nirmal-lamsal/Images/logo-pangong-frozenlake-2025.jpg" alt="Logo" class="race-logo" onerror="this.src='${placeholderSvg}'">
                    <div class="race-info">
                        <h3>Pangong Frozen Lake Marathon</h3>
                        <div class="race-meta">
                            <span>Type: High Altitude Marathon (Extreme)</span>
                            <span style="margin-top: 4px;">Participation: 2025 (Finish)</span>
                        </div>
                    </div>
                </div>
                <div class="race-card">
                    <img src="${placeholderSvg}" alt="Logo" class="race-logo">
                    <div class="race-info">
                        <h3>Pokhara Marathon</h3>
                        <div class="race-meta">
                            <span>Type: Road Marathon / City Marathon</span>
                            <span style="margin-top: 4px;">Participation: 2018 &middot; 2020 &middot; 2022</span>
                        </div>
                    </div>
                </div>
                <div class="race-card">
                    <img src="${placeholderSvg}" alt="Logo" class="race-logo">
                    <div class="race-info">
                        <h3>Kathmandu International Marathon</h3>
                        <div class="race-meta">
                            <span>Type: Road Marathon / Charity Event</span>
                            <span style="margin-top: 4px;">Participation: 2015 &middot; 2016 &middot; 2019</span>
                        </div>
                    </div>
                </div>
                <div class="race-card">
                    <img src="${placeholderSvg}" alt="Logo" class="race-logo">
                    <div class="race-info">
                        <h3>London Marathon</h3>
                        <div class="race-meta">
                            <span>Type: World Major — Road Marathon</span>
                            <span style="margin-top: 4px;">Participation: 2024 (Finish)</span>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        try {
        const response = await fetch(`${SCRIPT_URL}?_=${Date.now()}`);
        const data = await response.json();

                if (data.status === 'success' && data.data.length > 0) {
                raceList.innerHTML = ''; // clear loading
                
                // Filter to Display_RaceTable values 1-8
                const displayRacesRaw = data.data
                    .filter(r => {
                        const val = parseInt(r.Display_RaceTable);
                        return !isNaN(val) && val >= 1 && val <= 8;
                    })
                    .sort((a, b) => parseInt(a.Display_RaceTable) - parseInt(b.Display_RaceTable));

                // Deduplicate by RaceName so we don't show the same marathon twice
                const displayRaces = [];
                const seenNames = new Set();
                
                for (const race of displayRacesRaw) {
                    const normalizedName = race.RaceName.trim().toLowerCase();
                    if (!seenNames.has(normalizedName)) {
                        seenNames.add(normalizedName);
                        displayRaces.push(race);
                    }
                    if (displayRaces.length >= 8) break; // Hard limit of 8 boxes
                }

                if (displayRaces.length === 0) {
                     raceList.innerHTML = '<p>No highlighted races to display.</p>';
                } else {
                    displayRaces.forEach(race => {
                        const card = document.createElement('div');
                        card.className = 'race-card';
                        
                        // Default placeholder if no logo URL
                        const placeholderSvg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70"><rect width="70" height="70" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-weight="bold" font-size="12" fill="#94a3b8">LOGO</text></svg>')}`;
                        const logoSrc = race.Logo || placeholderSvg;
                        
                        // Aggregate participation years from all matching races in the sheet
                        const allInstances = data.data.filter(r => r.RaceName && race.RaceName && r.RaceName.toLowerCase() === race.RaceName.toLowerCase());
                        let years = [];
                        let times = [];
                        
                        allInstances.forEach(instance => {
                            if (instance.Participation) {
                                // Split by comma, dot, middle dot, or slash
                                const splitYears = String(instance.Participation).split(/[,.\/·]/).map(y => y.trim()).filter(Boolean);
                                years.push(...splitYears);
                            }
                            if (instance.Time) {
                                const formattedTime = formatDisplayTime(instance.Time);
                                if (formattedTime !== '-') {
                                    times.push(formattedTime);
                                }
                            }
                        });
                        
                        // Deduplicate and sort ascending (oldest first)
                        years = [...new Set(years)].sort((a, b) => a.localeCompare(b));
                        const chipsHtml = years.map(y => `<span class="year-chip">${y}</span>`).join('');
                        
                        // Sort times ascending to find Personal Best (shortest time)
                        times.sort();
                        const bestTimeHtml = times.length > 0 ? `<span class="time-text" style="font-size: 0.85rem; margin-bottom: 0.4rem;"><strong>Best Time:</strong> ${times[0]}</span>` : '';
                        

                        const raceSlug = slugify(race.RaceName);
                        card.onclick = () => window.location.href = `race.html?race=${raceSlug}`;
                        card.style.cursor = 'pointer';

                        card.innerHTML = `
                            <img src="${logoSrc}" alt="${race.RaceName} Logo" class="race-logo" onerror="this.src='${placeholderSvg}'">
                            <div class="race-info">
                                <h3>${race.RaceName}</h3>
                                <div class="race-meta">
                                    <span class="type-text">${race.Type || 'N/A'}</span>
                                    ${bestTimeHtml}
                                    <div class="chip-container">
                                        ${chipsHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                        raceList.appendChild(card);
                    });
                }
            } else {
                raceList.innerHTML = '<p>No race data found.</p>';
            }
        } catch (error) {
            console.error('Error fetching race data:', error);
            raceList.innerHTML = '<p>Failed to load race data. Please try again later.</p>';
        }
    }

    // Initial load
    loadMarathons();
    loadBlogs();
    loadGallery();
    loadStravaData();
    applyVisibilitySettings();
});

async function applyVisibilitySettings() {
    if (!SCRIPT_URL) return;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSettings&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const settings = result.data;
            const mapping = {
                'hero': '#hero',
                'about': '#about',
                'marathons': '#marathons',
                'gallery': '#gallery',
                'blog': '#blog',
                'sponsorship': '#sponsorship',
                'contact': '#contact',
                'training': '.training-update-card'
            };

            Object.entries(mapping).forEach(([settingId, selector]) => {
                const isHidden = settings[settingId] === 'Hide';
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    if (isHidden) {
                        el.style.display = 'none';
                        // Also hide nav link if it's a main section
                        const navLink = document.querySelector(`.nav-links a[href="${selector}"]`);
                        if (navLink) navLink.parentElement.style.display = 'none';
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error applying visibility settings:', error);
    }
}

async function loadStravaData() {
    const container = document.getElementById('strava-data-container');
    if (!container || !SCRIPT_URL) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=stravaData&_=${Date.now()}`);
        const data = await response.json();

        if (data.status === 'success' && data.data && data.data.length > 0) {
            const stats = data.data[0];
            
            // Format TotalDistance into individual digit chips
            const distanceStr = String(stats.TotalDistance || '0').replace(/,/g, '');
            const chipsHtml = distanceStr.split('').map(digit => `<span class="dist-chip">${digit}</span>`).join('');
            
            container.innerHTML = `
                <div class="recent-activity-section">
                    <div class="activity-meta">
                        <div class="meta-item">
                            <span class="label">Recent Distance</span>
                            <span class="value">${stats.RecentDistance || '0'} km</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">Elevation</span>
                            <span class="value">${stats.Elevation || '0'} m</span>
                        </div>
                    </div>
                    <div class="activity-type">
                        <span class="label">Activity Type</span>
                        <span class="type-text">${stats.Activities || 'Running & Cycling'}</span>
                    </div>
                </div>
                
                <div class="total-milestone">
                    <span class="label">Lifetime Achievement</span>
                    <div class="chips-wrapper">
                        ${chipsHtml}
                        <span class="unit">KM</span>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '<div class="loading-mini">No recent stats available.</div>';
        }
    } catch (error) {
        console.error('Error loading Strava data:', error);
        container.innerHTML = '<div class="loading-mini">Stats temporarily unavailable.</div>';
    }
}

window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('hidden');
        setTimeout(() => preloader.remove(), 500);
    }
});

async function loadBlogs() {
    const blogGrid = document.getElementById('blog-grid');
    if (!blogGrid || !SCRIPT_URL) return;

    // Set a timeout to prevent hanging forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(`${SCRIPT_URL}?action=blogs`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();

        if (data.status === 'success') {
            const displayBlogs = (data.data || []).filter(b => b.Display === 'Yes');
            if (displayBlogs.length > 0) {
                blogGrid.innerHTML = '';
                displayBlogs.forEach(blog => {
                    const article = document.createElement('article');
                    article.className = 'blog-card';
                    
                    // Limit summary to 20 words
                    let summary = blog.ShortText || '';
                    const words = summary.split(/\s+/);
                    if (words.length > 20) {
                        summary = words.slice(0, 20).join(' ') + '...';
                    }

                    article.innerHTML = `
                        <h3>${blog.Title || 'Untitled Post'}</h3>
                        <p>${summary}</p>
                        <a href="${blog.URL || '#'}" class="read-more" target="_blank">Read More →</a>
                    `;
                    blogGrid.appendChild(article);
                });
            } else {
                blogGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No featured blog posts at the moment.</p>';
            }
        } else {
            throw new Error(data.message || 'Failed to load blogs');
        }
    } catch (error) {
        clearTimeout(timeoutId);
        console.error('Error loading blogs:', error);
        if (error.name === 'AbortError') {
            blogGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ff4444; padding: 2rem;">Connection timeout. <br><small>Google is taking too long to respond. Please check your internet or redeploy the script.</small></p>';
        } else {
            blogGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ff4444; padding: 2rem;">Unable to load experiences: ${error.message}. <br><small>Make sure you have redeployed the script and authorized access.</small></p>`;
        }
    }
}

async function loadGallery() {
    const galleryGrid = document.getElementById('main-gallery-grid');
    if (!galleryGrid || !SCRIPT_URL) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=gallery`);
        const data = await response.json();

        if (data.status === 'success') {
            const displayItems = (data.data || [])
                .filter(item => item.Display_Status === 'TRUE' && item.Display_Order && item.Display_Order !== '')
                .sort((a, b) => {
                    const orderA = parseInt(a.Display_Order) || 999;
                    const orderB = parseInt(b.Display_Order) || 999;
                    return orderA - orderB;
                })
                .slice(0, 8); // Max 8 images

            if (displayItems.length > 0) {
                galleryGrid.innerHTML = '';
                displayItems.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'gallery-item';
                    div.innerHTML = `
                        <img src="${item.GitHub_URL}" alt="${item.Filename}" loading="lazy">
                        <div class="gallery-overlay">
                            <p>${item.Description || ''}</p>
                        </div>
                    `;
                    galleryGrid.appendChild(div);
                });
            } else {
                galleryGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No photos featured in the gallery yet.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading gallery:', error);
        galleryGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ff4444; padding: 2rem;">Unable to load gallery.</p>';
    }
}
