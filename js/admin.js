const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec';

let allRaces = [];
let filteredRaces = [];
let currentPage = 1;
let galleryCurrentPage = 1;
let blogCurrentPage = 1;
const itemsPerPage = 10;

let allBlogs = [];
let allGallery = [];

// Race names data with logo (fetched from NameofRace sheet)
let allRaceNamesData = [];

let currentLogoBase64 = null;
let currentLogoMime = null;
let currentLogoName = null;

// Race entity logo (for NameofRace sheet)
let raceEntityLogoBase64 = null;
let raceEntityLogoName = null;

// Race photo upload queue: array of { file, base64, name }
let racePhotoQueue = [];

// Compression constants
const MAX_WIDTH = 1920;
const COMPRESSION_QUALITY = 0.7;
const SIZE_THRESHOLD = 1048576; // 1MB in bytes

// Image compression function
async function compressImageIfNeeded(file, statusElement = null, statusText = '') {
    // Always process images to ensure they are downscaled/optimized
    // (Size check removed per request)

    // Show compression status
    if (statusElement) {
        statusElement.textContent = 'Compressing...';
        statusElement.classList.remove('hidden');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Downscale if wider than 1920px
                if (width > MAX_WIDTH) {
                    height = Math.round(height * MAX_WIDTH / width);
                    width = MAX_WIDTH;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG at 70% quality
                const base64 = canvas.toDataURL('image/jpeg', COMPRESSION_QUALITY).split(',')[1];

                // Clear compression status
                if (statusElement) {
                    statusElement.textContent = '';
                    statusElement.classList.add('hidden');
                }

                resolve({
                    base64: base64,
                    originalSize: file.size,
                    compressedSize: Math.round((base64.length * 3) / 4) // Approximate decoded size
                });
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    refreshAllData();

    // Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Race Form
    const raceForm = document.getElementById('add-race-form');
    if (raceForm) raceForm.addEventListener('submit', handleRaceSubmit);

    // Search Input
    const searchInput = document.getElementById('race-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            filterRaces(term);
        });
    }

    // Logo Upload
    const fileInput = document.getElementById('race-logo-file');
    if (fileInput) fileInput.addEventListener('change', handleLogoUpload);

    // Race Entity Logo Upload
    const raceEntityLogoInput = document.getElementById('race-entity-logo-file');
    if (raceEntityLogoInput) raceEntityLogoInput.addEventListener('change', handleRaceEntityLogoUpload);

    // Time Formatter
    const timeInput = document.getElementById('race-time');
    if (timeInput) timeInput.addEventListener('input', formatTimeInput);

    // Race Name Form
    const raceNameForm = document.getElementById('race-name-form');
    if (raceNameForm) raceNameForm.addEventListener('submit', submitRaceNameForm);

    // Blog Form
    const blogForm = document.getElementById('blog-form');
    if (blogForm) blogForm.addEventListener('submit', handleBlogSubmit);

    // Gallery Edit/Upload Form
    const galleryEditForm = document.getElementById('gallery-edit-form');
    if (galleryEditForm) galleryEditForm.addEventListener('submit', handleGallerySubmit);

    // Race Photo Multi-Upload
    const racePhotoInput = document.getElementById('race-photo-files');
    if (racePhotoInput) racePhotoInput.addEventListener('change', handleRacePhotoSelect);

    // Bank Details Form
    const bankForm = document.getElementById('bank-details-form');
    if (bankForm) bankForm.addEventListener('submit', handleBankSubmit);

    // Bank QR & Logo Uploads
    const bankQRInput = document.getElementById('bank-qr-file');
    if (bankQRInput) bankQRInput.addEventListener('change', handleBankQRSelect);
    const bankLogoInput = document.getElementById('bank-logo-file');
    if (bankLogoInput) bankLogoInput.addEventListener('change', handleBankLogoSelect);

    // Fundraiser Form
    const fundraiserForm = document.getElementById('fundraiser-form');
    if (fundraiserForm) fundraiserForm.addEventListener('submit', handleFundraiserSubmit);

    // Initialize Race Display Options
    updateRaceDisplayOptions();
}

async function refreshAllData() {
    loadStats();
    loadRaceNames();
    loadRaces();
    loadBlogs();
    loadGallery();
    loadSystemSettings();
    loadMajors();
    loadBankDetails();
    loadFundraisers();
}

// --- STATISTICS ---
async function loadStats() {
    if (!SCRIPT_URL) return;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=stats&_=${Date.now()}`);
        const data = await response.json();

        if (data.status === 'success') {
            if (data.stats) {
                if (data.stats.totalRaces !== undefined) document.getElementById('stat-total-races').textContent = data.stats.totalRaces || '0';
                if (data.stats.personalBest) document.getElementById('stat-pb').textContent = formatDisplayTime(data.stats.personalBest) || '--:--:--';

                if (data.stats.totalDistance !== undefined) {
                    // Handle Distance
                    const distance = data.stats.totalDistance || 0;
                    const goal = data.stats.distanceGoal || 100000;
                    const percent = Math.min(100, (distance / goal) * 100).toFixed(2);

                    document.getElementById('stat-distance').textContent = distance.toLocaleString();
                    const progressBar = document.getElementById('distance-progress-bar');
                    const progressPercent = document.getElementById('distance-progress-percent');

                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (progressPercent) progressPercent.textContent = `${percent}% of ${goal.toLocaleString()} KM Goal`;
                }
            }
        }
    } catch (error) {
        console.error("Error fetching stats:", error);
    }
    // Always recalculate from local data for consistency
    updateDashboardStats();
}

function updateDashboardStats() {
    let totalDistance = 0;
    let bestTime = null;
    const totalRaces = allRaces ? allRaces.length : 0;

    if (allRaces) {
        allRaces.forEach(race => {
            // Parse distance
            let distStr = String(race.Distance || '');
            let distValue = parseFloat(distStr.replace(/[^\d.]/g, ''));
            if (!isNaN(distValue)) {
                if (distStr.toLowerCase().includes('mile')) {
                    totalDistance += distValue * 1.60934;
                } else {
                    totalDistance += distValue;
                }
            }

            // Best Time Logic
            const currentTime = race.Time;
            if (currentTime && currentTime !== '-' && currentTime !== '--:--:--') {
                if (!bestTime || compareTimes(currentTime, bestTime) < 0) {
                    bestTime = currentTime;
                }
            }
        });
    }

    // Update DOM
    const totalRacesEl = document.getElementById('stat-total-races');
    const pbEl = document.getElementById('stat-pb');
    const distEl = document.getElementById('stat-distance');
    const progressEl = document.getElementById('distance-progress-bar');
    const labelEl = document.getElementById('distance-progress-percent');

    if (totalRacesEl) totalRacesEl.textContent = totalRaces;
    if (pbEl) pbEl.textContent = formatDisplayTime(bestTime);
    if (distEl) distEl.textContent = totalDistance.toLocaleString(undefined, { maximumFractionDigits: 1 });

    const goal = 100000;
    const percentage = Math.min((totalDistance / goal) * 100, 100);
    if (progressEl) progressEl.style.width = percentage + '%';
    if (labelEl) labelEl.textContent = `${percentage.toFixed(1)}% of ${goal.toLocaleString()} KM Goal`;
}

function compareTimes(t1, t2) {
    const normalize = (t) => {
        t = String(t).replace(/\D/g, '');
        return t.padStart(6, '0');
    };
    return normalize(t1).localeCompare(normalize(t2));
}

// --- RACE MANAGEMENT ---
async function loadRaces() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-race-table-body');

    // Show loading state
    tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">Loading races...</td></tr>';

    try {
        const response = await fetch(`${SCRIPT_URL}?_=${Date.now()}`);
        const data = await response.json();

        if (data && data.status === 'success') {
            allRaces = data.data || [];
            if (allRaces.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">No races recorded yet. Add your first race!</td></tr>';
            } else {
                filterRaces(''); // Initial render
            }
            updateDashboardStats(); // Update stats whenever races are loaded
        } else if (data && data.error) {
            console.error("Server error:", data.error);
            tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">No races found. Add your first race!</td></tr>';
        } else {
            // No data or empty response
            allRaces = [];
            tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">No races recorded yet. Add your first race!</td></tr>';
        }
    } catch (error) {
        console.error("Error fetching races:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-error font-medium">Unable to load races. Please try again later..</td></tr>';
    }
}

function filterRaces(term) {
    if (!term) {
        filteredRaces = [...allRaces];
    } else {
        filteredRaces = allRaces.filter(race =>
            (race.RaceName || '').toLowerCase().includes(term) ||
            (race.Type || '').toLowerCase().includes(term) ||
            (race.Participation || '').toString().includes(term)
        );
    }
    currentPage = 1;
    renderRaceTable();
}

function renderRaceTable() {
    const tbody = document.getElementById('admin-race-table-body');
    const info = document.getElementById('pagination-info');
    const controls = document.getElementById('pagination-controls');

    if (filteredRaces.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant font-medium">No records matching your search.</td></tr>';
        info.textContent = 'Showing 0 of 0 races';
        controls.innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredRaces.length);
    const paginatedItems = filteredRaces.slice(start, end);

    tbody.innerHTML = '';
    paginatedItems.forEach(race => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-primary/5 transition-athletic";
        const raceLogo = getRaceLogo(race.RaceName);
        tr.innerHTML = `
            <td class="py-4 pr-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center overflow-hidden">
                        ${raceLogo ? `<img src="${raceLogo}" class="w-full h-full object-contain">` : `<span class="material-symbols-outlined text-xs text-on-surface-variant">sprint</span>`}
                    </div>
                    <div>
                        <p class="font-bold text-sm">${race.RaceName}</p>
                        <p class="text-xs text-on-surface-variant">${race.Type}</p>
                    </div>
                </div>
            </td>
            <td class="py-4 pr-4">
                <span class="text-sm font-semibold">${race.Participation}</span>
            </td>
            <td class="py-4 pr-4">
                <span class="text-sm font-mono">${formatDisplayTime(race.Time)}</span>
            </td>
            <td class="py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-athletic">
                    <button onclick="editRace('${race.id}')" class="p-2 hover:bg-primary/20 text-primary rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="deleteRace('${race.id}')" class="p-2 hover:bg-error/20 text-error rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update info
    info.textContent = `Showing ${start + 1}-${end} of ${filteredRaces.length} races`;

    // Render controls
    const totalPages = Math.ceil(filteredRaces.length / itemsPerPage);
    controls.innerHTML = '';

    if (totalPages > 1) {
        const prev = document.createElement('button');
        prev.className = `p-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-athletic ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`;
        prev.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_left</span>';
        prev.onclick = () => { if (currentPage > 1) { currentPage--; renderRaceTable(); } };
        controls.appendChild(prev);

        const next = document.createElement('button');
        next.className = `p-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-athletic ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : ''}`;
        next.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_right</span>';
        next.onclick = () => { if (currentPage < totalPages) { currentPage++; renderRaceTable(); } };
        controls.appendChild(next);
    }
}

async function handleRaceSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;

    const raceId = document.getElementById('race-id').value;
    const action = raceId ? 'update' : 'create';

    try {
        const timeInput = document.getElementById('race-time');
        const rawTime = timeInput.dataset.rawTime || timeInput.value;
        const raceData = {
            id: raceId,
            RaceName: document.getElementById('race-name').value,
            Type: document.getElementById('race-type').value,
            Participation: document.getElementById('race-participation').value,
            Distance: document.getElementById('race-distance').value + ' ' + document.getElementById('race-distance-unit').value,
            Time: rawTime,
            Position: document.getElementById('race-position').value,
            PB: document.getElementById('race-pb').value,
            RaceStatus: document.getElementById('race-status').value, // Added RaceStatus
            Notes: document.getElementById('race-notes').value,
            Display_RaceTable: document.getElementById('race-display').value
        };

        // Update button to show active work
        submitBtn.textContent = 'Saving Race Data...';

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: action, data: raceData })
        });

        // Google Apps Script might return a redirect or a simple text response
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Server returned an error.');

        // Upload queued race photos to Gallery (tagged to this race)
        if (racePhotoQueue.length > 0) {
            await uploadRacePhotosToGallery(raceData.RaceName);
        }

        alert(raceId ? 'Race updated successfully!' : 'Race added successfully!');
        resetForm();
        loadRaces();
        loadStats();
    } catch (error) {
        console.error('Error saving race:', error);
        alert('Error saving data: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ── Race Photo Queue ──────────────────────────────────────────────────────

async function handleRacePhotoSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const statusEl = document.getElementById('race-photo-status');
    const total = files.length;
    let processed = 0;

    for (const file of files) {
        racePhotoQueue.push({
            file: file,
            name: file.name.replace(/\.[^.]+$/, '.jpg')
        });
    }

    renderRacePhotoPreviews();
    if (statusEl) {
        statusEl.textContent = `${racePhotoQueue.length} photo(s) queued`;
        statusEl.classList.remove('hidden');
    }
    e.target.value = '';
}

function renderRacePhotoPreviews() {
    const grid = document.getElementById('race-photo-previews');
    const status = document.getElementById('race-photo-status');
    if (!grid) return;
    grid.innerHTML = '';
    racePhotoQueue.forEach((item, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'relative group';
        const objectUrl = URL.createObjectURL(item.file);
        wrap.innerHTML = `
            <img src="${objectUrl}"
                 class="w-full aspect-square object-cover rounded-lg border border-outline-variant">
            <button type="button" onclick="removeRacePhoto(${idx})"
                    class="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full
                           flex items-center justify-center opacity-0 group-hover:opacity-100
                           transition-opacity text-xs">&times;</button>`;
        grid.appendChild(wrap);
    });
    grid.classList.toggle('hidden', racePhotoQueue.length === 0);
    if (status) {
        status.textContent = racePhotoQueue.length ? `${racePhotoQueue.length} photo(s) queued` : '';
        status.classList.toggle('hidden', racePhotoQueue.length === 0);
    }
}

function removeRacePhoto(idx) {
    racePhotoQueue.splice(idx, 1);
    renderRacePhotoPreviews();
}

async function uploadRacePhotosToGallery(raceName) {
    const statusEl = document.getElementById('race-photo-status');
    const total = racePhotoQueue.length;
    let done = 0;
    const progressBarContainer = document.getElementById('race-photo-progress-container');
    const progressBar = document.getElementById('race-photo-progress-bar');

    if (progressBarContainer) progressBarContainer.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';

    for (const item of racePhotoQueue) {
        done++;
        const progress = Math.round(((done - 1) / total) * 100);

        if (statusEl) statusEl.textContent = `Compressing ${done}/${total}: ${item.name}…`;
        if (progressBar) progressBar.style.width = `${progress}%`;

        try {
            const compressionResult = await compressImageIfNeeded(item.file, statusEl);
            const base64Data = compressionResult ? compressionResult.base64 : null;

            if (!base64Data) throw new Error('Compression failed');

            const uploadProgress = Math.round((done / total) * 100);
            const statusMsg = `Uploading ${done}/${total}… (${uploadProgress}%)`;
            if (statusEl) statusEl.textContent = statusMsg + `: ${item.name}`;
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) submitBtn.textContent = statusMsg;
            if (progressBar) progressBar.style.width = `${uploadProgress}%`;

            await sendGalleryRequest('galleryUpload', {
                base64Data: base64Data,
                fileName: item.name,
                description: raceName + ' – race moment',
                displayStatus: 'TRUE',
                displayOrder: '',
                taggedRace: raceName
            });
        } catch (err) {
            console.error('Photo processing/upload failed:', item.name, err);
            if (statusEl) {
                statusEl.textContent = `⚠️ Failed: ${item.name} — ${err.message}`;
                statusEl.style.color = '#dc2626';
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (statusEl) {
        statusEl.textContent = `✅ ${done}/${total} photos uploaded.`;
        statusEl.style.color = '';
    }

    // Briefly show completion before hiding progress bar
    setTimeout(() => {
        if (progressBarContainer) progressBarContainer.classList.add('hidden');
    }, 2000);
    racePhotoQueue = [];
    renderRacePhotoPreviews();
    loadGallery();
}

/**
 * Sends a request to the Google Apps Script backend specifically for gallery operations.
 * Uses text/plain to avoid CORS preflight issues with application/json.
 */
async function sendGalleryRequest(action, data) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: action, data: data })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    // We expect a JSON response from the backend
    return await response.json();
}


function editRace(id) {
    const race = allRaces.find(r => r.id === id);
    if (!race) return;

    document.getElementById('form-title').textContent = 'Update Race Record';
    document.getElementById('submit-btn').textContent = 'Apply Changes';
    document.getElementById('cancel-btn').classList.remove('hidden');

    document.getElementById('race-id').value = race.id;
    document.getElementById('race-name').value = race.RaceName || '';
    document.getElementById('race-type').value = race.Type || '';
    document.getElementById('race-participation').value = race.Participation || '';

    let dist = race.Distance || '';
    let unit = 'KM';
    if (dist.toLowerCase().endsWith('miles')) {
        unit = 'Miles';
        dist = dist.replace(/miles/i, '').trim();
    } else if (dist.toLowerCase().endsWith('km') || dist.toLowerCase().endsWith('kms')) {
        unit = 'KM';
        dist = dist.replace(/kms?/i, '').trim();
    }
    document.getElementById('race-distance').value = dist;
    document.getElementById('race-distance-unit').value = unit;

    document.getElementById('race-time').value = formatDisplayTime(race.Time) !== '-' ? formatDisplayTime(race.Time) : '';
    document.getElementById('race-position').value = race.Position || '';
    document.getElementById('race-pb').value = race.PB || 'No';
    document.getElementById('race-notes').value = race.Notes || '';
    document.getElementById('race-display').value = race.Display_RaceTable || 'None';

    // Update Race Status Toggle
    const status = race.RaceStatus || 'Completed';
    const statusInput = document.getElementById('race-status');
    if (statusInput) statusInput.value = status;
    updateStatusToggleUI(status);
    updateRaceDisplayOptions(race.Display_RaceTable || 'None');

    document.getElementById('add-race-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteRace(id) {
    if (!confirm('Are you sure you want to permanently delete this race record?')) return;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', data: { id: id } })
        });

        alert('Race deleted successfully!');
        loadRaces();
        loadStats();
    } catch (error) {
        console.error('Error deleting race:', error);
        alert('Error deleting race.');
    }
}

function resetForm() {
    document.getElementById('add-race-form').reset();
    document.getElementById('race-id').value = '';
    document.getElementById('form-title').textContent = 'Add New Race';
    document.getElementById('submit-btn').textContent = 'Save Race Data';
    document.getElementById('cancel-btn').classList.add('hidden');
    // Reset Race Status Toggle
    const statusInput = document.getElementById('race-status');
    if (statusInput) statusInput.value = 'Completed';
    updateStatusToggleUI('Completed');
    updateRaceDisplayOptions();
    // Clear photo queue
    racePhotoQueue = [];
    renderRacePhotoPreviews();
    const statusEl = document.getElementById('race-photo-status');
    if (statusEl) { statusEl.textContent = ''; statusEl.classList.add('hidden'); }
}

// --- BLOG MANAGEMENT ---
async function loadBlogs() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-blog-table-body');

    try {
        const response = await fetch(`${SCRIPT_URL}?action=blogs&_=${Date.now()}`);
        const data = await response.json();

        if (data.status === 'success') {
            allBlogs = data.data || [];
            blogCurrentPage = 1;
            renderBlogTable();
        }
    } catch (error) {
        console.error("Error fetching blogs:", error);
        tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-error font-medium">Unable to load experiences.</td></tr>';
    }
}

function renderBlogTable() {
    const tbody = document.getElementById('admin-blog-table-body');
    const info = document.getElementById('blog-pagination-info');
    const controls = document.getElementById('blog-pagination-controls');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (allBlogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-on-surface-variant">No experiences logged yet.</td></tr>';
        if (info) info.textContent = 'Showing 0 of 0 posts';
        if (controls) controls.innerHTML = '';
        return;
    }

    const start = (blogCurrentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, allBlogs.length);
    const paginatedItems = allBlogs.slice(start, end);

    paginatedItems.forEach(blog => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-primary/5 transition-athletic";
        tr.innerHTML = `
            <td class="py-4 pr-4">
                <p class="font-bold text-sm">${blog.Title || 'Untitled'}</p>
                <p class="text-xs text-on-surface-variant">${(blog.ShortText || '').substring(0, 50)}...</p>
            </td>
            <td class="py-4 pr-4">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${blog.Display === 'Yes' ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}">
                    ${blog.Display === 'Yes' ? 'Visible' : 'Hidden'}
                </span>
            </td>
            <td class="py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-athletic">
                    <button onclick="editBlog('${blog.id}')" class="p-2 hover:bg-primary/20 text-primary rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="deleteBlog('${blog.id}')" class="p-2 hover:bg-error/20 text-error rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update info
    if (info) {
        info.textContent = `Showing ${start + 1}-${end} of ${allBlogs.length} posts`;
    }

    // Render controls
    if (controls) {
        controls.innerHTML = '';
        const totalPages = Math.ceil(allBlogs.length / itemsPerPage);

        if (totalPages > 1) {
            const prev = document.createElement('button');
            prev.className = `p-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-athletic ${blogCurrentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`;
            prev.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_left</span>';
            prev.onclick = () => { if (blogCurrentPage > 1) { blogCurrentPage--; renderBlogTable(); } };
            controls.appendChild(prev);

            const next = document.createElement('button');
            next.className = `p-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-athletic ${blogCurrentPage === totalPages ? 'opacity-30 cursor-not-allowed' : ''}`;
            next.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_right</span>';
            next.onclick = () => { if (blogCurrentPage < totalPages) { blogCurrentPage++; renderBlogTable(); } };
            controls.appendChild(next);
        }
    }
}

async function handleBlogSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('blog-submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    const blogId = document.getElementById('blog-id').value;
    const action = blogId ? 'updateBlog' : 'createBlog';

    try {
        const blogData = {
            id: blogId,
            Title: document.getElementById('blog-title').value,
            ShortText: document.getElementById('blog-text').value,
            URL: document.getElementById('blog-url').value,
            Display: document.getElementById('blog-display').value
        };

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: action, data: blogData })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Server returned an error.');

        alert(blogId ? 'Blog updated!' : 'Blog added!');
        resetBlogForm();
        loadBlogs();
    } catch (error) {
        console.error('Error saving blog:', error);
        alert('Error saving blog: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function editBlog(id) {
    const blog = allBlogs.find(b => b.id === id);
    if (!blog) return;

    document.getElementById('blog-form-title').textContent = 'Update Experience Post';
    document.getElementById('blog-submit-btn').textContent = 'Apply Update';
    document.getElementById('blog-cancel-btn').classList.remove('hidden');

    document.getElementById('blog-id').value = blog.id;
    document.getElementById('blog-title').value = blog.Title || '';
    document.getElementById('blog-text').value = blog.ShortText || '';
    document.getElementById('blog-url').value = blog.URL || '';
    document.getElementById('blog-display').value = blog.Display || 'No';

    document.getElementById('blog-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteBlog(id) {
    if (!confirm('Permanently delete this blog post?')) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'deleteBlog', data: { id: id } })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        alert('Blog deleted.');
        loadBlogs();
    } catch (error) {
        console.error('Error deleting blog:', error);
        alert('Delete failed: ' + error.message);
    }
}

function resetBlogForm() {
    document.getElementById('blog-form').reset();
    document.getElementById('blog-id').value = '';
    document.getElementById('blog-form-title').textContent = 'Post New Experience';
    document.getElementById('blog-submit-btn').textContent = 'Publish Post';
    document.getElementById('blog-cancel-btn').classList.add('hidden');
}

// --- GALLERY MANAGEMENT ---

async function loadGallery() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('gallery-table-body');

    try {
        const response = await fetch(`${SCRIPT_URL}?action=gallery&_=${Date.now()}`);
        const data = await response.json();

        if (data.status === 'success') {
            allGallery = data.data || [];
            renderGalleryTable();
        }
    } catch (error) {
        console.error("Error fetching gallery:", error);
    }
}

function renderGalleryTable() {
    const tbody = document.getElementById('gallery-table-body');
    const info = document.getElementById('gallery-pagination-info');
    const controls = document.getElementById('gallery-pagination-controls');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (allGallery.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-on-surface-variant font-medium">No images in library. <button onclick="openGalleryModal()" class="text-primary underline">Upload one</button></td></tr>';
        if (info) info.textContent = '0 images';
        return;
    }

    const start = (galleryCurrentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedItems = allGallery.slice(start, end);

    paginatedItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-primary/5 transition-athletic";
        tr.innerHTML = `
            <td class="py-4 pr-4">
                <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline-variant">
                    <img src="${item.GitHub_URL}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/100?text=No+Image'">
                </div>
            </td>
            <td class="py-4 pr-4">
                <span class="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">${item.Display_Order || 'None'}</span>
            </td>
            <td class="py-4 pr-4">
                <span class="text-[10px] font-bold text-on-surface-variant uppercase">${item.Tagged_Race || 'Untagged'}</span>
            </td>
            <td class="py-4 pr-4">
                <p class="font-bold text-sm truncate max-w-[150px]">${item.Filename}</p>
                <p class="text-[10px] text-on-surface-variant uppercase font-bold truncate max-w-[150px]">${item.Description || 'No description'}</p>
            </td>
            <td class="py-4 pr-4">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" ${item.Display_Status === 'TRUE' ? 'checked' : ''} onchange="updateGalleryDisplayStatus('${item.id}', this)" class="w-4 h-4 rounded border-outline-variant text-primary focus:ring-0">
                    <span class="text-[10px] font-bold uppercase ${item.Display_Status === 'TRUE' ? 'text-primary' : 'text-on-surface-variant'}">Visible</span>
                </label>
            </td>
            <td class="py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-athletic">
                    <button onclick="editGallery('${item.id}')" class="p-2 hover:bg-primary/20 text-primary rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="deleteGallery('${item.id}')" class="p-2 hover:bg-error/20 text-error rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Pagination Info
    if (info) {
        info.textContent = `Showing ${start + 1}-${Math.min(end, allGallery.length)} of ${allGallery.length} images`;
    }

    // Pagination Controls
    if (controls) {
        controls.innerHTML = '';
        const totalPages = Math.ceil(allGallery.length / itemsPerPage);

        const prevBtn = document.createElement('button');
        prevBtn.className = `p-2 rounded-lg border border-outline-variant hover:bg-primary/10 transition-athletic ${galleryCurrentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`;
        prevBtn.innerHTML = '<span class="material-symbols-outlined">chevron_left</span>';
        prevBtn.onclick = () => { if (galleryCurrentPage > 1) { galleryCurrentPage--; renderGalleryTable(); } };
        controls.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = `p-2 rounded-lg border border-outline-variant hover:bg-primary/10 transition-athletic ${galleryCurrentPage === totalPages ? 'opacity-30 cursor-not-allowed' : ''}`;
        nextBtn.innerHTML = '<span class="material-symbols-outlined">chevron_right</span>';
        nextBtn.onclick = () => { if (galleryCurrentPage < totalPages) { galleryCurrentPage++; renderGalleryTable(); } };
        controls.appendChild(nextBtn);
    }
}

function openGalleryModalForUpload() {
    openGalleryModal(false);
}

function openGalleryModal(isEdit = false) {
    const modal = document.getElementById('gallery-modal');
    const title = document.getElementById('gallery-modal-title');
    const uploadFields = document.getElementById('gallery-upload-fields');

    if (isEdit) {
        title.textContent = 'Edit Image Details';
        uploadFields.classList.add('hidden'); // Hide file input during detail edit
    } else {
        title.textContent = 'Upload New Image';
        uploadFields.classList.remove('hidden');
        document.getElementById('gallery-edit-form').reset();
        document.getElementById('edit-gallery-id').value = '';
        document.getElementById('gallery-preview-container').classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

function closeGalleryModal() {
    document.getElementById('gallery-modal').classList.add('hidden');
}

function editGallery(id) {
    const item = allGallery.find(g => g.id === id);
    if (!item) return;

    openGalleryModal(true);
    document.getElementById('edit-gallery-id').value = item.id;
    document.getElementById('edit-gallery-filename').value = item.Filename || '';
    document.getElementById('edit-gallery-description').value = item.Description || '';
    document.getElementById('edit-gallery-order').value = item.Display_Order || '';
    document.getElementById('edit-gallery-race').value = item.Tagged_Race || '';

    const preview = document.getElementById('gallery-preview-container');
    const previewImg = document.getElementById('gallery-preview-img');
    preview.classList.remove('hidden');
    previewImg.src = item.GitHub_URL;
}

async function handleGallerySubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('gallery-save-btn');
    const status = document.getElementById('gallery-modal-status');
    const originalText = saveBtn.textContent;

    const id = document.getElementById('edit-gallery-id').value;
    const action = id ? 'updateGallery' : 'galleryUpload';

    saveBtn.disabled = true;
    saveBtn.textContent = id ? 'Saving...' : 'Uploading...';
    status.textContent = 'Connecting to server...';

    const data = {
        id: id,
        fileName: document.getElementById('edit-gallery-filename').value.trim(),
        description: document.getElementById('edit-gallery-description').value.trim(),
        displayOrder: document.getElementById('edit-gallery-order').value,
        taggedRace: document.getElementById('edit-gallery-race').value
    };

    if (!id) {
        // Upload flow
        const fileInput = document.getElementById('edit-gallery-file');
        if (!fileInput.files.length) {
            alert('Please select an image file.');
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            return;
        }

        const file = fileInput.files[0];

        // Check if compression is needed (file > 1MB)
        if (file.size > SIZE_THRESHOLD) {
            saveBtn.textContent = 'Compressing...';
            status.textContent = 'Compressing image (large file detected)...';

            const compressionResult = await compressImageIfNeeded(file, status, 'Gallery');

            if (compressionResult) {
                data.base64Data = compressionResult.base64;
                data.displayStatus = 'TRUE';
                data.fileName = data.fileName.replace(/\.[^.]+$/, '.jpg'); // Flatten to .jpg

                saveBtn.textContent = 'Uploading...';
                status.textContent = 'Uploading...';

                try {
                    await sendGalleryRequest(action, data);
                    status.textContent = 'Success!';
                    setTimeout(() => {
                        closeGalleryModal();
                        loadGallery();
                    }, 1000);
                } catch (err) {
                    console.error('Gallery upload error:', err);
                    status.textContent = '❌ ' + (err.message || 'Upload failed. Check console.');
                    status.style.color = '#dc2626';
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                }
                return;
            }
        }

        // No compression needed - use original with standard resize
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = async function () {
                // Image Resizing Logic (max 1920px, JPEG 70%)
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                data.base64Data = canvas.toDataURL('image/jpeg', COMPRESSION_QUALITY).split(',')[1];
                data.displayStatus = 'TRUE';

                try {
                    await sendGalleryRequest(action, data);
                    status.textContent = 'Success!';
                    setTimeout(() => {
                        closeGalleryModal();
                        loadGallery();
                    }, 1000);
                } catch (err) {
                    console.error('Gallery upload error:', err);
                    status.textContent = '❌ ' + (err.message || 'Upload failed. Check console.');
                    status.style.color = '#dc2626';
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalText;
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        // Update flow
        try {
            await sendGalleryRequest(action, data);
            status.textContent = 'Changes saved.';
            setTimeout(() => {
                closeGalleryModal();
                loadGallery();
            }, 1000);
        } catch (err) {
            console.error('Gallery update error:', err);
            status.textContent = '❌ ' + (err.message || 'Update failed. Check console.');
            status.style.color = '#dc2626';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

async function sendGalleryRequest(action, data) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: action, data: data })
    });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message || 'Server error');
    return result;
}

async function deleteGallery(id) {
    if (!confirm('Permanently delete this photo from the library?')) return;
    try {
        await sendGalleryRequest('deleteGallery', { id: id });
        alert('Photo removed.');
        loadGallery();
    } catch (error) {
        console.error('Error deleting gallery item:', error);
    }
}

async function updateGalleryDisplayStatus(id, checkbox) {
    try {
        await sendGalleryRequest('updateGalleryStatus', { id: id, displayStatus: checkbox.checked ? 'TRUE' : 'FALSE' });
    } catch (error) {
        checkbox.checked = !checkbox.checked;
    }
}

// --- HELPERS ---

async function loadRaceNames() {
    if (!SCRIPT_URL) return;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=names&_=${Date.now()}`);
        const data = await response.json();
        if (data.status === 'success') {
            allRaceNamesData = data.data || [];

            const names = allRaceNamesData.map(item => item.RaceName).filter(Boolean);

            // Populate Race Management dropdown
            const select = document.getElementById('race-name');
            select.innerHTML = '<option value="">Select a race</option>';

            // Populate Gallery Tagging dropdown
            const gallerySelect = document.getElementById('edit-gallery-race');
            gallerySelect.innerHTML = '<option value="">No Tag</option>';

            // Populate Datalist for new race entity form
            const datalist = document.getElementById('existing-races-list');
            if (datalist) {
                datalist.innerHTML = '';
                names.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    datalist.appendChild(option);
                });
            }

            names.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);

                const gOption = document.createElement('option');
                gOption.value = name;
                gOption.textContent = name;
                gallerySelect.appendChild(gOption);
            });
        }
    } catch (error) {
        console.error("Error loading race names:", error);
    }
}

// Get logo for a race by name (from NameofRace sheet data)
function getRaceLogo(raceName) {
    const raceData = allRaceNamesData.find(r => r.RaceName === raceName);
    return raceData ? raceData.Logo : null;
}

function openRaceNameModal() {
    document.getElementById('race-name-modal').classList.remove('hidden');
}

function closeRaceNameModal() {
    document.getElementById('race-name-modal').classList.add('hidden');
    clearRaceEntityLogo();
}

async function handleRaceNameInput(value) {
    const race = allRaceNamesData.find(r => r.RaceName.toLowerCase() === value.toLowerCase());
    const submitBtn = document.querySelector('#race-name-form button[type="submit"]');

    if (race) {
        // Autofill existing data
        document.getElementById('new-race-location').value = race.Location || '';
        document.getElementById('new-race-country').value = race.Country || '';
        document.getElementById('new-race-intro').value = race.Intro || '';

        if (race.Logo) {
            document.getElementById('race-entity-logo-preview-container').classList.remove('hidden');
            document.getElementById('race-entity-logo-preview').src = race.Logo;
            const statusEl = document.getElementById('race-entity-logo-status');
            if (statusEl) {
                statusEl.textContent = 'Existing logo loaded';
                statusEl.classList.remove('hidden');
            }
        }
        if (submitBtn) submitBtn.textContent = 'Update Entity';
    } else {
        // Clear if no match (optional, or just leave it)
        if (submitBtn) submitBtn.textContent = 'Create Entity';
    }
}

async function submitRaceNameForm(e) {
    e.preventDefault();

    const raceName = document.getElementById('new-race-name').value.trim();
    const existingRace = allRaceNamesData.find(r => r.RaceName.toLowerCase() === raceName.toLowerCase());

    // Validate logo (mandatory only for new races)
    if (!raceEntityLogoBase64 && (!existingRace || !existingRace.Logo)) {
        alert('Please upload a race logo.');
        return;
    }

    const data = {
        RaceName: raceName,
        Location: document.getElementById('new-race-location').value.trim(),
        Country: document.getElementById('new-race-country').value.trim(),
        Intro: document.getElementById('new-race-intro').value.trim(),
        logoBase64: raceEntityLogoBase64 ? 'data:image/jpeg;base64,' + raceEntityLogoBase64 : null,
        Logo: existingRace ? existingRace.Logo : ''
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: existingRace ? 'updateRaceName' : 'createRaceName',
                data: data
            })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Server error');

        alert(existingRace ? 'Race entity updated.' : 'Race entity created.');
        closeRaceNameModal();
        document.getElementById('race-name-form').reset();
        clearRaceEntityLogo();
        loadRaceNames();
    } catch (error) {
        console.error('Error handling race entity:', error);
        alert('Action failed: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // If file > 1MB, compress it first (downscale to 1920px, JPEG 70%)
    if (file.size > SIZE_THRESHOLD) {
        const statusEl = document.getElementById('race-photo-status');
        if (statusEl) {
            statusEl.textContent = 'Compressing logo...';
            statusEl.classList.remove('hidden');
        }

        const compressionResult = await compressImageIfNeeded(file, statusEl);

        if (compressionResult) {
            // Now resize compressed image to logo size (150px max)
            const img = new Image();
            img.src = 'data:image/jpeg;base64,' + compressionResult.base64;
            await new Promise(resolve => { img.onload = resolve; });

            const MAX_SIZE = 150;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            currentLogoBase64 = canvas.toDataURL('image/jpeg', 0.6);
            currentLogoMime = 'image/jpeg';
            currentLogoName = file.name.replace(/\.[^.]+$/, '.jpg');

            if (statusEl) {
                statusEl.textContent = '';
                statusEl.classList.add('hidden');
            }

            document.getElementById('logo-preview-container').classList.remove('hidden');
            document.getElementById('logo-preview').src = currentLogoBase64;
            return;
        }
    }

    // Standard processing for smaller files
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const MAX_SIZE = 150;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            currentLogoBase64 = canvas.toDataURL('image/jpeg', 0.6);
            currentLogoMime = file.type;
            currentLogoName = file.name.replace(/\.[^.]+$/, '.jpg');

            document.getElementById('logo-preview-container').classList.remove('hidden');
            document.getElementById('logo-preview').src = currentLogoBase64;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function clearLogoPreview() {
    document.getElementById('race-logo-file').value = '';
    document.getElementById('logo-preview-container').classList.add('hidden');
    document.getElementById('logo-preview').src = '';
    currentLogoBase64 = null;
}

async function handleRaceEntityLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('race-entity-logo-status');

    // If file > 1MB, compress it first
    if (file.size > SIZE_THRESHOLD) {
        if (statusEl) {
            statusEl.textContent = 'Compressing...';
            statusEl.classList.remove('hidden');
        }

        const compressionResult = await compressImageIfNeeded(file, statusEl);

        if (compressionResult) {
            raceEntityLogoBase64 = compressionResult.base64;
            raceEntityLogoName = file.name.replace(/\.[^.]+$/, '.jpg');

            if (statusEl) {
                statusEl.textContent = 'Logo uploaded';
                statusEl.classList.remove('hidden');
            }

            document.getElementById('race-entity-logo-preview-container').classList.remove('hidden');
            document.getElementById('race-entity-logo-preview').src = 'data:image/jpeg;base64,' + raceEntityLogoBase64;
            return;
        }
    }

    // Standard processing for smaller files - resize to 150px
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const MAX_SIZE = 150;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            raceEntityLogoBase64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            raceEntityLogoName = file.name.replace(/\.[^.]+$/, '.jpg');

            if (statusEl) {
                statusEl.textContent = 'Logo uploaded';
                statusEl.classList.remove('hidden');
            }

            document.getElementById('race-entity-logo-preview-container').classList.remove('hidden');
            document.getElementById('race-entity-logo-preview').src = 'data:image/jpeg;base64,' + raceEntityLogoBase64;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function clearRaceEntityLogo() {
    document.getElementById('race-entity-logo-file').value = '';
    document.getElementById('race-entity-logo-preview-container').classList.add('hidden');
    document.getElementById('race-entity-logo-preview').src = '';
    const statusEl = document.getElementById('race-entity-logo-status');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.classList.add('hidden');
    }
    raceEntityLogoBase64 = null;
    raceEntityLogoName = null;
}

function formatTimeInput(e) {
    if (e.inputType === 'deleteContentBackward') return;
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 6) input = input.substring(0, 6);

    // Keep raw value with seconds for the backend
    e.target.dataset.rawTime = input;

    let formatted = '';
    if (input.length > 0) formatted += input.substring(0, 2);
    if (input.length > 2) formatted += ' Hrs ' + input.substring(2, 4);
    if (input.length > 4) formatted += ' Min'; // Do not display seconds visually
    e.target.value = formatted;
}

// --- RACE STATUS TOGGLE ---
function toggleRaceStatus() {
    const statusInput = document.getElementById('race-status');
    if (!statusInput) return;

    const currentStatus = statusInput.value;
    const newStatus = currentStatus === 'Completed' ? 'Upcoming' : 'Completed';
    statusInput.value = newStatus;

    updateStatusToggleUI(newStatus);
    updateRaceDisplayOptions();
}

function updateStatusToggleUI(status) {
    const container = document.getElementById('status-toggle-container');
    const slider = document.getElementById('status-slider');
    const icon = document.getElementById('slider-icon');
    const labelCompleted = document.getElementById('label-completed');
    const labelUpcoming = document.getElementById('label-upcoming');

    if (status === 'Completed') {
        container.classList.remove('bg-surface-container-highest');
        container.classList.add('bg-primary');
        slider.style.transform = 'translateX(0)';
        icon.textContent = 'check';
        icon.classList.add('text-primary');
        icon.classList.remove('text-on-surface-variant');
        labelCompleted.style.opacity = '1';
        labelUpcoming.style.opacity = '0';
    } else {
        container.classList.add('bg-surface-container-highest');
        container.classList.remove('bg-primary');
        slider.style.transform = 'translateX(-160px)';
        icon.textContent = 'schedule';
        icon.classList.remove('text-primary');
        icon.classList.add('text-on-surface-variant');
        labelCompleted.style.opacity = '0';
        labelUpcoming.style.opacity = '1';
    }
}

function updateRaceDisplayOptions(selectedValue = 'None') {
    const statusInput = document.getElementById('race-status');
    const displaySelect = document.getElementById('race-display');
    if (!statusInput || !displaySelect) return;

    const status = statusInput.value;
    displaySelect.innerHTML = '<option value="None">None</option>';

    if (status === 'Completed') {
        for (let i = 1; i <= 8; i++) {
            const opt = document.createElement('option');
            opt.value = i.toString();
            opt.textContent = `Slot ${i} (Completed)`;
            displaySelect.appendChild(opt);
        }
    } else {
        for (let i = 1; i <= 3; i++) {
            const opt = document.createElement('option');
            opt.value = `Upcoming_${i}`;
            opt.textContent = `Upcoming Slot ${i}`;
            displaySelect.appendChild(opt);
        }
    }

    // Restore selected value if it exists in the new options
    if (Array.from(displaySelect.options).some(opt => opt.value === selectedValue)) {
        displaySelect.value = selectedValue;
    } else {
        displaySelect.value = 'None';
    }
}

function formatDisplayTime(timeStr) {
    if (!timeStr || timeStr === '-' || timeStr === '--:--:--') return '--:--:--';
    let normalized = timeStr;
    let cleanStr = String(timeStr).replace(/^[-]+/, '');

    if (cleanStr.includes('T') && cleanStr.includes('Z')) {
        try {
            const d = new Date(cleanStr);
            normalized = `${String(d.getHours()).padStart(2, '0')} Hrs ${String(d.getMinutes()).padStart(2, '0')} Min`;
            return normalized;
        } catch (e) { }
    } else if (/^\d{6}$/.test(cleanStr)) {
        return `${cleanStr.substring(0, 2)} Hrs ${cleanStr.substring(2, 4)} Min`;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
        const parts = normalized.split(':');
        return `${parts[0]} Hrs ${parts[1]} Min`;
    }

    return normalized;
}

// --- SYSTEM SETTINGS ---

async function loadSystemSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    // Define the display names locally as source of truth
    const sectionNames = {
        'hero': 'Hero Section (Top)',
        'about': 'About / Introduction',
        'marathons': 'Marathon Participation Section',
        'gallery': 'Photo Gallery Grid',
        'blog': 'Experience Log / Blog',
        'sponsorship': 'Sponsorship Quest Section',
        'contact': 'Contact Form',
        'training': 'Training Update (Strava)',
        'upcoming_races': 'Upcoming Races Section',
        'major_london': 'Abbott Major: London',
        'major_tokyo': 'Abbott Major: Tokyo',
        'major_boston': 'Abbott Major: Boston',
        'major_berlin': 'Abbott Major: Berlin',
        'major_chicago': 'Abbott Major: Chicago',
        'major_nyc': 'Abbott Major: NYC'
    };

    // Pre-populate with loading state or default UI
    container.innerHTML = Object.entries(sectionNames).map(([id, name]) => `
        <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-outline-variant hover:border-primary/30 transition-athletic opacity-50" id="setting-row-${id}">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-surface-container-highest rounded-lg flex items-center justify-center text-on-surface-variant">
                    <span class="material-symbols-outlined">${id === 'training' ? 'monitoring' : (id.startsWith('major_') ? 'star' : (id === 'upcoming_races' ? 'event' : 'visibility'))}</span>
                </div>
                <div>
                    <p class="font-bold text-on-background">${name}</p>
                    <p class="text-xs text-on-surface-variant">Syncing...</p>
                </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" value="${id}" class="sr-only peer setting-toggle" disabled>
                <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
    `).join('');

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSettings`);
        const result = await response.json();

        if (result.status === 'success') {
            const settings = result.data;

            Object.entries(sectionNames).forEach(([id, name]) => {
                const isVisible = settings[id] === 'Show';
                const row = document.getElementById(`setting-row-${id}`);
                if (row) {
                    row.classList.remove('opacity-50');
                    const statusText = row.querySelector('.text-xs');
                    if (statusText) statusText.textContent = isVisible ? 'Currently visible' : 'Hidden from public';

                    const toggle = row.querySelector('.setting-toggle');
                    if (toggle) {
                        toggle.disabled = false;
                        toggle.checked = isVisible;
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback: Enable toggles but show error message
        const status = document.getElementById('settings-status');
        if (status) status.textContent = 'Note: Could not sync with database. Showing local defaults.';
        document.querySelectorAll('.setting-toggle').forEach(t => {
            t.disabled = false;
            t.parentElement.parentElement.classList.remove('opacity-50');
        });
    }
}
async function runDatabaseMigration() {
    const btn = document.getElementById('sync-db-btn');
    const originalContent = btn.innerHTML;

    if (!confirm('This will scan your Google Sheets and add any missing columns (like Payment URL or Race Status) without touching your existing data. Continue?')) {
        return;
    }

    btn.innerHTML = '<span class="animate-spin material-symbols-outlined text-sm">sync</span> Syncing...';
    btn.disabled = true;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'migrate' })
        });
        const result = await response.json();

        if (result.status === 'success') {
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Success!';
            btn.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
            setTimeout(() => {
                location.reload(); // Refresh to load new settings/columns
            }, 2000);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Migration error:', error);
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">error</span> Failed';
        btn.classList.add('bg-red-100', 'text-red-700', 'border-red-200');
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            btn.classList.remove('bg-red-100', 'text-red-700', 'border-red-200');
        }, 3000);
    }
}

async function runStravaSync() {
    const btn = document.getElementById('strava-sync-btn');
    const status = document.getElementById('strava-status');
    const originalContent = btn.innerHTML;

    btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span> Syncing Strava...';
    btn.disabled = true;
    status.textContent = 'Connecting to Strava API...';

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'stravaSync' })
        });
        const result = await response.json();

        if (result.status === 'success') {
            status.textContent = '✅ ' + result.message;
            status.style.color = '#15803d'; // Green
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Sync Complete';
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                status.textContent = '';
            }, 3000);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Strava sync error:', error);
        status.textContent = '❌ Sync Failed: ' + error.message;
        status.style.color = '#dc2626'; // Red
        btn.innerHTML = '<span class="material-symbols-outlined">error</span> Sync Error';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }, 5000);
    }
}


async function saveSystemSettings() {
    const btn = document.getElementById('save-settings-btn');
    const status = document.getElementById('settings-status');
    const toggles = document.querySelectorAll('.setting-toggle');

    const settingsUpdate = {};
    toggles.forEach(t => {
        settingsUpdate[t.value] = t.checked ? 'Show' : 'Hide';
    });

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving Settings...';
    status.textContent = '';

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateSettings',
                data: settingsUpdate
            })
        });
        const result = await response.json();

        if (result.status === 'success') {
            status.textContent = 'Settings applied successfully! Refresh the home page to see changes.';
            status.className = 'text-xs text-center text-green-600 mt-3';
            loadSystemSettings(); // Refresh UI
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        status.textContent = 'Error: ' + error.message;
        status.className = 'text-xs text-center text-error mt-3';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">save</span> Apply Visibility Settings';
    }
}

// --- BANK / PAYMENT MANAGEMENT ---

let bankQRBase64 = null;
let bankLogoBase64 = null;
let bankCurrentPage = 1;
const bankItemsPerPage = 5;

async function loadBankDetails() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-bank-table-body');
    if (!tbody) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=bankDetails&_=${Date.now()}`);
        const result = await response.json();

        if (result.status === 'success') {
            allBankDetails = result.data || [];
            renderBankTable();
        }
    } catch (error) {
        console.error("Error loading bank details:", error);
    }
}

function renderBankTable() {
    const tbody = document.getElementById('admin-bank-table-body');
    const info = document.getElementById('bank-pagination-info');
    if (!tbody) return;

    if (allBankDetails.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">No payment options added yet.</td></tr>';
        if (info) info.textContent = 'Showing 0 of 0 options';
        return;
    }

    const start = (bankCurrentPage - 1) * bankItemsPerPage;
    const end = Math.min(start + bankItemsPerPage, allBankDetails.length);
    const paginated = allBankDetails.slice(start, end);

    tbody.innerHTML = '';
    paginated.forEach(bank => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-primary/5 transition-athletic";
        tr.innerHTML = `
            <td class="py-4 pr-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline-variant">
                        ${bank.Platform_Logo_URL ? `<img src="${bank.Platform_Logo_URL}" class="w-full h-full object-contain">` : `<span class="material-symbols-outlined text-on-surface-variant">payments</span>`}
                    </div>
                    <span class="font-bold text-sm">${bank.Platform}</span>
                </div>
            </td>
            <td class="py-4 pr-4">
                <p class="text-sm font-semibold">${bank.AccountName}</p>
                <p class="text-xs text-on-surface-variant">${bank.AccountNumber_ID}</p>
            </td>
            <td class="py-4 pr-4 text-center">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" ${bank.Status === 'Active' ? 'checked' : ''} 
                           onchange="toggleBankStatus('${bank.id}', this)"
                           class="sr-only peer">
                    <div class="w-9 h-5 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </td>
            <td class="py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-athletic">
                    <button onclick="editBank('${bank.id}')" class="p-2 hover:bg-primary/20 text-primary rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="deleteBank('${bank.id}')" class="p-2 hover:bg-error/20 text-error rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (info) info.textContent = `Showing ${start + 1}-${end} of ${allBankDetails.length} options`;
}

function changeBankPage(dir) {
    const totalPages = Math.ceil(allBankDetails.length / bankItemsPerPage);
    if (dir === 1 && bankCurrentPage < totalPages) {
        bankCurrentPage++;
        renderBankTable();
    } else if (dir === -1 && bankCurrentPage > 1) {
        bankCurrentPage--;
        renderBankTable();
    }
}

async function handleBankQRSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('bank-qr-status');
    const preview = document.getElementById('bank-qr-preview');
    const container = document.getElementById('bank-qr-preview-container');

    try {
        const result = await compressImageIfNeeded(file, statusEl);
        bankQRBase64 = result.base64; // Store raw base64
        preview.src = 'data:image/jpeg;base64,' + bankQRBase64;
        container.classList.remove('hidden');
    } catch (err) {
        console.error("QR compression failed:", err);
    }
}

async function handleBankLogoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('bank-logo-status');
    const preview = document.getElementById('bank-logo-preview');
    const container = document.getElementById('bank-logo-preview-container');

    try {
        const result = await compressImageIfNeeded(file, statusEl);
        bankLogoBase64 = result.base64; // Store raw base64
        preview.src = 'data:image/jpeg;base64,' + bankLogoBase64;
        container.classList.remove('hidden');
    } catch (err) {
        console.error("Logo compression failed:", err);
    }
}

function clearBankQR() {
    bankQRBase64 = null;
    document.getElementById('bank-qr-file').value = '';
    document.getElementById('bank-qr-preview-container').classList.add('hidden');
}

function clearBankLogo() {
    bankLogoBase64 = null;
    document.getElementById('bank-logo-file').value = '';
    document.getElementById('bank-logo-preview-container').classList.add('hidden');
}

async function handleBankSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('bank-submit-btn');
    const originalText = btn.textContent;
    const id = document.getElementById('bank-id').value;
    const action = id ? 'updateBankDetails' : 'createBankDetails';

    btn.disabled = true;
    btn.textContent = 'Saving...';

    const data = {
        id: id,
        Platform: document.getElementById('bank-platform').value,
        AccountName: document.getElementById('bank-account-name').value,
        AccountNumber_ID: document.getElementById('bank-account-number').value,
        SwiftCode: document.getElementById('bank-swift-code').value || '',
        Branch: document.getElementById('bank-branch').value || '',
        Status: document.getElementById('bank-status').value || 'Inactive',
        Payment_URL: document.getElementById('bank-payment-url').value,
        qrBase64: bankQRBase64,
        logoBase64: bankLogoBase64
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: action, data: data })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        alert(id ? 'Payment option updated!' : 'Payment option added!');
        resetBankForm();
        loadBankDetails();
    } catch (error) {
        console.error("Error saving bank:", error);
        alert("Error saving: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function editBank(id) {
    const bank = allBankDetails.find(b => b.id === id);
    if (!bank) return;

    document.getElementById('bank-form-title').textContent = 'Update Payment Option';
    document.getElementById('bank-submit-btn').textContent = 'Apply Update';
    document.getElementById('bank-cancel-btn').classList.remove('hidden');

    document.getElementById('bank-id').value = bank.id;
    document.getElementById('bank-platform').value = bank.Platform || '';
    document.getElementById('bank-account-name').value = bank.AccountName || '';
    document.getElementById('bank-account-number').value = bank.AccountNumber_ID || '';
    document.getElementById('bank-swift-code').value = bank.SwiftCode || '';
    document.getElementById('bank-branch').value = bank.Branch || '';
    document.getElementById('bank-status').value = bank.Status || 'Inactive';
    document.getElementById('bank-payment-url').value = bank.Payment_URL || '';

    if (bank.QR_Code_URL) {
        const preview = document.getElementById('bank-qr-preview');
        preview.src = bank.QR_Code_URL;
        document.getElementById('bank-qr-preview-container').classList.remove('hidden');
    }

    if (bank.Platform_Logo_URL) {
        const preview = document.getElementById('bank-logo-preview');
        preview.src = bank.Platform_Logo_URL;
        document.getElementById('bank-logo-preview-container').classList.remove('hidden');
    }

    document.getElementById('bank-details-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteBank(id) {
    if (!confirm('Delete this payment option?')) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'deleteBankDetails', data: { id: id } })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        alert('Option deleted.');
        loadBankDetails();
    } catch (error) {
        console.error("Error deleting bank:", error);
    }
}

function resetBankForm() {
    document.getElementById('bank-details-form').reset();
    document.getElementById('bank-id').value = '';
    document.getElementById('bank-form-title').textContent = 'Add Payment Option';
    document.getElementById('bank-submit-btn').textContent = 'Save Option';
    document.getElementById('bank-cancel-btn').classList.add('hidden');
    clearBankQR();
    clearBankLogo();
}

async function toggleBankStatus(id, checkbox) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'setPrimaryBank',
                data: { id: id }
            })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        // Refresh local data and table
        loadBankDetails();
    } catch (error) {
        console.error("Error toggling bank status:", error);
        checkbox.checked = !checkbox.checked;
    }
}

async function loadMajors() {
    const container = document.getElementById('majors-list-container');
    if (!container) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getMajors&_=${Date.now()}`);
        const result = await response.json();

        if (result.status === 'success') {
            const majors = result.data || [];
            if (majors.length === 0) {
                container.innerHTML = '<div class="col-span-full py-6 text-center text-on-surface-variant italic">No goal races added yet. Click "Add New Goal" to start.</div>';
                return;
            }

            container.innerHTML = majors.map(major => {
                const isCompleted = major.Status === 'Completed';
                return `
                    <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-outline-variant hover:border-primary/30 transition-athletic">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 ${isCompleted ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'} rounded-lg flex items-center justify-center">
                                <span class="material-symbols-outlined">${isCompleted ? 'stars' : 'star'}</span>
                            </div>
                            <div>
                                <p class="font-bold text-on-background">${major.Name}</p>
                                <p class="text-xs ${isCompleted ? 'text-primary font-semibold' : 'text-on-surface-variant'}">${major.Status}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="toggleMajorStatus('${major.id}', '${major.Name}', '${major.Status}')" 
                                    class="p-2 ${isCompleted ? 'text-primary hover:bg-primary/10' : 'text-on-surface-variant hover:bg-primary/10 hover:text-primary'} rounded-lg transition-athletic"
                                    title="Toggle Completion">
                                <span class="material-symbols-outlined">${isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
                            </button>
                            <button onclick="deleteMajor('${major.id}')" class="p-2 text-error/40 hover:text-error hover:bg-error/10 rounded-lg transition-athletic">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading majors:', error);
    }
}

async function addNewMajor() {
    const name = prompt('Enter the name of the new Marathon Goal (e.g., Sydney Marathon):');
    if (!name) return;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'addMajor',
                data: { Name: name, Status: 'Pending' }
            })
        });
        const result = await response.json();
        if (result.status === 'success') {
            loadMajors();
        } else {
            alert('Failed to add goal: ' + result.message);
        }
    } catch (error) {
        console.error('Error adding major:', error);
        alert('Network error adding goal.');
    }
}

async function toggleMajorStatus(id, name, currentStatus) {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateMajor',
                data: { id: id, Name: name, Status: newStatus }
            })
        });
        const result = await response.json();
        if (result.status === 'success') {
            loadMajors();
        }
    } catch (error) {
        console.error('Error updating major status:', error);
    }
}

async function deleteMajor(id) {
    if (!confirm('Delete this marathon goal from your tracker?')) return;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'deleteMajor',
                data: { id: id }
            })
        });
        const result = await response.json();
        if (result.status === 'success') {
            loadMajors();
        }
    } catch (error) {
        console.error('Error deleting major:', error);
    }
}

// --- FUNDRAISER MANAGEMENT ---

let allFundraisers = [];
let fundraiserCurrentPage = 1;
const fundraiserItemsPerPage = 10;

const EXCHANGE_RATES = {
    'NPR': 1.0,
    'AUD': 90.0,    // 1 AUD = ~90 NPR
    'US $': 133.0,  // 1 USD = ~133 NPR
    'EURO': 145.0,  // 1 EUR = ~145 NPR
    'POUND': 168.0  // 1 GBP = ~168 NPR
};

function animateCounter(id, target, decimals = 0) {
    const el = document.getElementById(id);
    if (!el) return;

    const duration = 1000; // ms
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (outQuad)
        const ease = progress * (2 - progress);
        const currentVal = ease * target;

        el.textContent = currentVal.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            el.textContent = target.toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        }
    }
    requestAnimationFrame(updateCounter);
}

async function loadFundraisers() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-fundraiser-table-body');
    if (!tbody) return;

    try {
        // Fetch settings first to get the target amount, race name, and description
        const settingsResponse = await fetch(`${SCRIPT_URL}?action=getCampaignSettings&_=${Date.now()}`);
        const settingsResult = await settingsResponse.json();
        if (settingsResult.status === 'success' && settingsResult.data) {
            if (settingsResult.data.fundraiser_target) {
                const targetAmount = parseFloat(settingsResult.data.fundraiser_target) || 0;
                animateCounter('fundraiser-stat-target', targetAmount, 0);
                const targetInput = document.getElementById('fundraiser-target-input');
                if (targetInput) targetInput.value = targetAmount;
            }
            if (settingsResult.data.fundraiser_race_name) {
                const raceNameVal = settingsResult.data.fundraiser_race_name;
                const raceCurrent = document.getElementById('fundraiser-race-name-current');
                if (raceCurrent) raceCurrent.textContent = raceNameVal;
                const raceInput = document.getElementById('fundraiser-race-name-input');
                if (raceInput) raceInput.value = raceNameVal;
            }
            if (settingsResult.data.fundraiser_description) {
                const descVal = settingsResult.data.fundraiser_description;
                const descInput = document.getElementById('fundraiser-desc-input');
                if (descInput) descInput.value = descVal;
            }
        }

        const response = await fetch(`${SCRIPT_URL}?action=getFundraisers&_=${Date.now()}`);
        const result = await response.json();

        if (result.status === 'success') {
            allFundraisers = result.data || [];
            if (fundraiserCurrentPage > Math.ceil(allFundraisers.length / fundraiserItemsPerPage)) {
                fundraiserCurrentPage = 1;
            }
            updateFundraiserStats();
            renderFundraiserTable();
        }
    } catch (error) {
        console.error("Error loading fundraisers:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-error font-medium">Unable to load contributors list.</td></tr>';
    }
}

function updateFundraiserStats() {
    const raisedEl = document.getElementById('fundraiser-stat-raised');
    const contributorsEl = document.getElementById('fundraiser-stat-contributors');

    let totalRaisedNPR = 0;
    allFundraisers.forEach(item => {
        if (item.Display === 'Yes') {
            const amount = parseFloat(item.Amount) || 0;
            const rate = EXCHANGE_RATES[item.Currency] || 1.0;
            totalRaisedNPR += amount * rate;
        }
    });

    if (raisedEl) animateCounter('fundraiser-stat-raised', totalRaisedNPR, 2);
    if (contributorsEl) animateCounter('fundraiser-stat-contributors', allFundraisers.length, 0);
}

function renderFundraiserTable() {
    const tbody = document.getElementById('admin-fundraiser-table-body');
    const info = document.getElementById('fundraiser-pagination-info');
    const controls = document.getElementById('fundraiser-pagination-controls');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (allFundraisers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant font-medium">No contributors logged yet.</td></tr>';
        if (info) info.textContent = 'Showing 0 of 0 contributors';
        if (controls) controls.innerHTML = '';
        return;
    }

    const start = (fundraiserCurrentPage - 1) * fundraiserItemsPerPage;
    const end = Math.min(start + fundraiserItemsPerPage, allFundraisers.length);
    const paginated = allFundraisers.slice(start, end);

    paginated.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-primary/5 transition-athletic";
        const safeName = (item.Name || 'Anonymous').replace(/'/g, "\\'");
        tr.innerHTML = `
            <td class="py-4 pr-4">
                <p class="font-bold text-sm text-on-background">${item.Name || 'Anonymous'}</p>
                <p class="text-xs text-on-surface-variant">${item.Timestamp ? new Date(item.Timestamp).toLocaleDateString() : 'N/A'}</p>
            </td>
            <td class="py-4 pr-4">
                <span class="text-sm font-semibold font-mono">${item.Currency || 'AUD'} ${(parseFloat(item.Amount) || 0).toFixed(2)}</span>
            </td>
            <td class="py-4 pr-4">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.Display === 'Yes' ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}">
                    ${item.Display === 'Yes' ? 'Visible' : 'Hidden'}
                </span>
            </td>
            <td class="py-4 pr-4">
                <button onclick="shareThankYou('${safeName}', '${item.Amount}', '${item.Currency}')" class="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-athletic flex items-center gap-1 text-xs font-bold" title="Share Thank You">
                    <span class="material-symbols-outlined text-[16px]">share</span> Share
                </button>
            </td>
            <td class="py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-athletic">
                    <button onclick="editFundraiser('${item.id}')" class="p-2 hover:bg-primary/20 text-primary rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="deleteFundraiser('${item.id}')" class="p-2 hover:bg-error/20 text-error rounded-lg transition-athletic">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (info) info.textContent = `Showing ${start + 1}-${end} of ${allFundraisers.length} contributors`;

    // Render controls
    if (controls) {
        controls.innerHTML = '';
        const totalPages = Math.ceil(allFundraisers.length / fundraiserItemsPerPage);

        if (totalPages > 1) {
            const prev = document.createElement('button');
            prev.className = `p-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-athletic ${fundraiserCurrentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}`;
            prev.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_left</span>';
            prev.onclick = () => { if (fundraiserCurrentPage > 1) { fundraiserCurrentPage--; renderFundraiserTable(); } };
            controls.appendChild(prev);

            const next = document.createElement('button');
            next.className = `p-2 rounded-lg border border-outline-variant hover:bg-surface-container-high transition-athletic ${fundraiserCurrentPage === totalPages ? 'opacity-30 cursor-not-allowed' : ''}`;
            next.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_right</span>';
            next.onclick = () => { if (fundraiserCurrentPage < totalPages) { fundraiserCurrentPage++; renderFundraiserTable(); } };
            controls.appendChild(next);
        }
    }
}

async function handleFundraiserSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('fundraiser-submit-btn');
    const originalText = btn.textContent;
    const id = document.getElementById('fundraiser-id').value;
    const action = id ? 'updateFundraiser' : 'createFundraiser';

    btn.disabled = true;
    btn.textContent = 'Saving...';

    const data = {
        id: id,
        Name: document.getElementById('fundraiser-name').value.trim(),
        Currency: document.getElementById('fundraiser-currency').value || 'AUD',
        Amount: parseFloat(document.getElementById('fundraiser-amount').value) || 0,
        Display: document.getElementById('fundraiser-display').value
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: action, data: data })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        alert(id ? 'Contributor updated successfully!' : 'Contributor added successfully!');
        resetFundraiserForm();
        loadFundraisers();
    } catch (error) {
        console.error("Error saving contributor:", error);
        alert("Error saving contributor: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function editFundraiser(id) {
    const item = allFundraisers.find(f => f.id === id);
    if (!item) return;

    document.getElementById('fundraiser-form-title').textContent = 'Update Contributor';
    document.getElementById('fundraiser-submit-btn').textContent = 'Apply Update';
    document.getElementById('fundraiser-cancel-btn').classList.remove('hidden');

    document.getElementById('fundraiser-id').value = item.id;
    document.getElementById('fundraiser-name').value = item.Name || '';
    document.getElementById('fundraiser-currency').value = item.Currency || 'AUD';
    document.getElementById('fundraiser-amount').value = item.Amount || 0;
    document.getElementById('fundraiser-display').value = item.Display || 'Yes';

    document.getElementById('fundraiser-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteFundraiser(id) {
    if (!confirm('Permanently delete this contributor record?')) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'deleteFundraiser', data: { id: id } })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        alert('Contributor deleted.');
        loadFundraisers();
    } catch (error) {
        console.error("Error deleting contributor:", error);
        alert("Delete failed: " + error.message);
    }
}

function resetFundraiserForm() {
    document.getElementById('fundraiser-form').reset();
    document.getElementById('fundraiser-id').value = '';
    document.getElementById('fundraiser-currency').value = 'AUD';
    document.getElementById('fundraiser-form-title').textContent = 'Add Contributor';
    document.getElementById('fundraiser-submit-btn').textContent = 'Save Contributor';
    document.getElementById('fundraiser-cancel-btn').classList.add('hidden');
}

async function saveFundraiserSettings() {
    const targetInput = document.getElementById('fundraiser-target-input');
    const raceNameInput = document.getElementById('fundraiser-race-name-input');
    const descInput = document.getElementById('fundraiser-desc-input');

    if (!targetInput || !raceNameInput || !descInput) return;

    const targetVal = parseFloat(targetInput.value);
    if (isNaN(targetVal) || targetVal <= 0) {
        alert("Please enter a valid positive target amount.");
        return;
    }

    const raceNameVal = raceNameInput.value.trim();
    if (!raceNameVal) {
        alert("Please enter a valid race name.");
        return;
    }

    const descVal = descInput.value.trim();
    if (!descVal) {
        alert("Please enter a valid description.");
        return;
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'updateCampaignSettings',
                data: {
                    fundraiser_target: String(targetVal),
                    fundraiser_race_name: raceNameVal,
                    fundraiser_description: descVal
                }
            })
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert("Fundraiser campaign settings updated successfully!");
            toggleCampaignEditMode(false); // Lock the fields and reload
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error("Error saving fundraiser settings:", error);
        alert("Failed to save campaign settings: " + error.message);
    }
}

let campaignEditMode = false;
function toggleCampaignEditMode(forceState) {
    campaignEditMode = (forceState !== undefined) ? forceState : !campaignEditMode;

    const targetInput = document.getElementById('fundraiser-target-input');
    const raceNameInput = document.getElementById('fundraiser-race-name-input');
    const descInput = document.getElementById('fundraiser-desc-input');
    const btnContainer = document.getElementById('save-campaign-btn-container');
    const editBtnText = document.getElementById('edit-campaign-text');
    const editBtnIcon = document.getElementById('edit-campaign-icon');

    if (!targetInput || !raceNameInput || !descInput || !btnContainer || !editBtnText || !editBtnIcon) return;

    if (campaignEditMode) {
        // Unlock
        targetInput.disabled = false;
        targetInput.classList.remove('bg-surface-container', 'cursor-not-allowed');
        targetInput.classList.add('bg-white');

        raceNameInput.disabled = false;
        raceNameInput.classList.remove('bg-surface-container', 'cursor-not-allowed');
        raceNameInput.classList.add('bg-white');

        descInput.disabled = false;
        descInput.classList.remove('bg-surface-container', 'cursor-not-allowed');
        descInput.classList.add('bg-white');

        btnContainer.classList.remove('hidden');

        editBtnText.textContent = "Cancel";
        editBtnIcon.textContent = "close";
    } else {
        // Lock
        targetInput.disabled = true;
        targetInput.classList.add('bg-surface-container', 'cursor-not-allowed');
        targetInput.classList.remove('bg-white');

        raceNameInput.disabled = true;
        raceNameInput.classList.add('bg-surface-container', 'cursor-not-allowed');
        raceNameInput.classList.remove('bg-white');

        descInput.disabled = true;
        descInput.classList.add('bg-surface-container', 'cursor-not-allowed');
        descInput.classList.remove('bg-white');

        btnContainer.classList.add('hidden');

        editBtnText.textContent = "Edit Settings";
        editBtnIcon.textContent = "edit";
        
        // Reload settings to restore original values
        loadFundraisers();
    }
}

let thankYouLogs = JSON.parse(localStorage.getItem('nirmal_thank_you_logs')) || [];

function shareThankYou(name, amount, currency) {
    const raceCurrent = document.getElementById('fundraiser-race-name-current');
    const raceName = raceCurrent ? raceCurrent.textContent : 'campaign';
    const amountFormatted = parseFloat(amount || 0).toFixed(2);
    
    let pageUrl = window.location.href.split('?')[0].replace('admin.html', 'fundraisers.html');
    if (!pageUrl.endsWith('fundraisers.html')) {
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        pageUrl = window.location.origin + basePath + 'fundraisers.html';
    }
    
    const message = `Hi ${name}! 🎉 Thank you so much for your generous contribution towards my ${raceName}. Your support means the world to me and helps me get closer to my goal! 🙌🏃‍♂️💨\n\nSee the supporters wall here: ${pageUrl}\n\n- Nirmal Lamsal`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Thank You for Your Support!',
            text: message
        }).then(() => {
            logThankYou(name, amountFormatted, currency, message);
        }).catch(err => {
            console.error("Share failed:", err);
            // Fallback to clipboard if user cancelled or error
        });
    } else {
        // Fallback to clipboard
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(message).then(() => {
                alert("Thank you message copied to clipboard!\n\n" + message);
                logThankYou(name, amountFormatted, currency, message);
            }).catch(err => {
                alert("Failed to copy message: " + err);
            });
        } else {
            // Fallback for file:// protocol or non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = message;
            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    alert("Thank you message copied to clipboard!\n\n" + message);
                    logThankYou(name, amountFormatted, currency, message);
                } else {
                    alert("Failed to copy message automatically. Please copy it manually:\n\n" + message);
                }
            } catch (err) {
                alert("Failed to copy message automatically. Please copy it manually:\n\n" + message);
            }
            
            document.body.removeChild(textArea);
        }
    }
}

function logThankYou(name, amount, currency, message) {
    const logEntry = {
        id: Date.now().toString(),
        name: name,
        amount: amount,
        currency: currency,
        message: message,
        timestamp: new Date().toISOString()
    };
    thankYouLogs.unshift(logEntry);
    localStorage.setItem('nirmal_thank_you_logs', JSON.stringify(thankYouLogs));
    renderThankYouLog();
}

function renderThankYouLog() {
    const tbody = document.getElementById('thank-you-log-body');
    const countEl = document.getElementById('ty-sent-count');
    if (!tbody) return;
    
    if (countEl) countEl.textContent = `${thankYouLogs.length} sent`;

    if (thankYouLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-on-surface-variant">No thank you messages sent yet.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    thankYouLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-primary/5 transition-athletic";
        const date = new Date(log.timestamp).toLocaleDateString() + ' ' + new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const safeName = log.name.replace(/'/g, "\\'");
        const preview = log.message.substring(0, 50) + '...';
        
        tr.innerHTML = `
            <td class="py-4 pr-4 font-bold text-sm text-on-background">${log.name}</td>
            <td class="py-4 pr-4 font-mono text-sm">${log.currency} ${log.amount}</td>
            <td class="py-4 pr-4 text-xs text-on-surface-variant max-w-[200px] truncate" title="${log.message.replace(/"/g, '&quot;')}">${preview}</td>
            <td class="py-4 pr-4 text-xs text-on-surface-variant">${date}</td>
            <td class="py-4 text-right">
                <button onclick="shareThankYou('${safeName}', '${log.amount}', '${log.currency}')" class="p-2 hover:bg-primary/20 text-primary rounded-lg transition-athletic" title="Re-Share">
                    <span class="material-symbols-outlined text-lg">replay</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Ensure the log is rendered when the page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(renderThankYouLog, 500);
});

