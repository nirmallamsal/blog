const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec';

let allRaces = [];
let filteredRaces = [];
let currentPage = 1;
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
}

async function refreshAllData() {
    loadStats();
    loadRaceNames();
    loadRaces();
    loadBlogs();
    loadGallery();
    loadSystemSettings();
}

// --- STATISTICS ---
async function loadStats() {
    if (!SCRIPT_URL) return;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=stats`);
        const data = await response.json();
        
        if (data.status === 'success') {
            document.getElementById('stat-total-races').textContent = data.stats.totalRaces || '0';
            document.getElementById('stat-pb').textContent = formatDisplayTime(data.stats.personalBest) || '--:--:--';
            
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
    } catch (error) {
        console.error("Error fetching stats:", error);
    }
}

// --- RACE MANAGEMENT ---
async function loadRaces() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-race-table-body');
    
    // Show loading state
    tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">Loading races...</td></tr>';
    
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        
        if (data && data.status === 'success') {
            allRaces = data.data || [];
            if (allRaces.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant">No races recorded yet. Add your first race!</td></tr>';
            } else {
                filterRaces(''); // Initial render
            }
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
        const raceData = {
            id: raceId,
            RaceName: document.getElementById('race-name').value,
            Type: document.getElementById('race-type').value,
            Participation: document.getElementById('race-participation').value,
            Distance: document.getElementById('race-distance').value + ' ' + document.getElementById('race-distance-unit').value,
            Time: document.getElementById('race-time').value,
            Position: document.getElementById('race-position').value,
            PB: document.getElementById('race-pb').value,
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
    const grid   = document.getElementById('race-photo-previews');
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
                base64Data:    base64Data,
                fileName:      item.name,
                description:   raceName + ' – race moment',
                displayStatus: 'TRUE',
                displayOrder:  '',
                taggedRace:    raceName
            });
        } catch (err) {
            console.error('Photo processing/upload failed:', item.name, err);
            if (statusEl) { 
                statusEl.textContent = `⚠️ Failed: ${item.name} — ${err.message}`; 
                statusEl.style.color='#dc2626'; 
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    if (statusEl) { 
        statusEl.textContent = `✅ ${done}/${total} photos uploaded.`; 
        statusEl.style.color=''; 
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
        const response = await fetch(`${SCRIPT_URL}?action=blogs`);
        const data = await response.json();
        
        if (data.status === 'success') {
            allBlogs = data.data || [];
            tbody.innerHTML = '';
            
            if (allBlogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-on-surface-variant">No experiences logged yet.</td></tr>';
                return;
            }

            allBlogs.forEach(blog => {
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
        }
    } catch (error) {
        console.error("Error fetching blogs:", error);
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
        const response = await fetch(`${SCRIPT_URL}?action=gallery`);
        const data = await response.json();
        
        if (data.status === 'success') {
            allGallery = data.data || [];
            tbody.innerHTML = '';
            
            if (allGallery.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-on-surface-variant font-medium">No images in library. <button onclick="openGalleryModal()" class="text-primary underline">Upload one</button></td></tr>';
                return;
            }

            allGallery.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "group hover:bg-primary/5 transition-athletic";
                tr.innerHTML = `
                    <td class="py-4 pr-4">
                        <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline-variant">
                            <img src="${item.GitHub_URL}" class="w-full h-full object-cover">
                        </div>
                    </td>
                    <td class="py-4 pr-4">
                        <span class="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">${item.Display_Order || 'None'}</span>
                    </td>
                    <td class="py-4 pr-4">
                        <span class="text-[10px] font-bold text-on-surface-variant uppercase">${item.Tagged_Race || 'Untagged'}</span>
                    </td>
                    <td class="py-4 pr-4">
                        <p class="font-bold text-sm">${item.Filename}</p>
                        <p class="text-[10px] text-on-surface-variant uppercase font-bold">${item.Description || 'No description'}</p>
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
        }
    } catch (error) {
        console.error("Error fetching gallery:", error);
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
        reader.onload = function(event) {
            const img = new Image();
            img.onload = async function() {
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
        const response = await fetch(`${SCRIPT_URL}?action=names`);
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

async function submitRaceNameForm(e) {
    e.preventDefault();
    
    // Validate logo is uploaded (mandatory)
    if (!raceEntityLogoBase64) {
        alert('Please upload a race logo (required).');
        return;
    }

    const data = {
        RaceName: document.getElementById('new-race-name').value.trim(),
        Location: document.getElementById('new-race-location').value.trim(),
        Country: document.getElementById('new-race-country').value.trim(),
        Intro: document.getElementById('new-race-intro').value.trim(),
        Logo: raceEntityLogoBase64
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'createRaceName', data: data })
        });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message || 'Server error');
        alert('Race entity created.');
        closeRaceNameModal();
        document.getElementById('race-name-form').reset();
        clearRaceEntityLogo();
        loadRaceNames();
    } catch (error) {
        console.error('Error creating race entity:', error);
        alert('Failed to create race entity: ' + error.message);
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
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 6) input = input.substring(0, 6);
    let formatted = '';
    if (input.length > 0) formatted += input.substring(0, 2);
    if (input.length > 2) formatted += ':' + input.substring(2, 4);
    if (input.length > 4) formatted += ':' + input.substring(4, 6);
    e.target.value = formatted;
}

function formatDisplayTime(timeStr) {
    if (!timeStr) return '--:--:--';
    timeStr = String(timeStr).replace(/^[-]+/, '');
    if (timeStr.includes('T') && timeStr.includes('Z')) {
        try {
            const d = new Date(timeStr);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        } catch(e) {}
    }
    if (/^\d{6}$/.test(timeStr)) {
        return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
    }
    return timeStr;
}

// --- SYSTEM SETTINGS ---

async function loadSystemSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    // Define the display names locally as source of truth
    const sectionNames = {
        'hero': 'Hero Section (Top)',
        'about': 'About / Introduction',
        'marathons': 'Recent Marathons List',
        'gallery': 'Photo Gallery Grid',
        'blog': 'Experience Log / Blog',
        'sponsorship': 'Sponsorship Quest Section',
        'contact': 'Contact Form',
        'training': 'Training Update (Strava)'
    };

    // Pre-populate with loading state or default UI
    container.innerHTML = Object.entries(sectionNames).map(([id, name]) => `
        <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-outline-variant hover:border-primary/30 transition-athletic opacity-50" id="setting-row-${id}">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-surface-container-highest rounded-lg flex items-center justify-center text-on-surface-variant">
                    <span class="material-symbols-outlined">${id === 'training' ? 'monitoring' : 'visibility'}</span>
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

