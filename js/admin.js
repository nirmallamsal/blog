const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec';

let allRaces = [];
let filteredRaces = [];
let currentPage = 1;
const itemsPerPage = 10;

let allBlogs = [];
let allGallery = [];

let currentLogoBase64 = null;
let currentLogoMime = null;
let currentLogoName = null;

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

    // New Race Photo Upload
    const racePhotoInput = document.getElementById('race-photo-files');
    if (racePhotoInput) racePhotoInput.addEventListener('change', handleRacePhotos);

    // Race Entity Logo Upload
    const entityLogoInput = document.getElementById('race-entity-logo-file');
    if (entityLogoInput) entityLogoInput.addEventListener('change', handleRaceEntityLogoUpload);
}

async function refreshAllData() {
    loadStats();
    loadRaceNames();
    loadRaces();
    loadBlogs();
    loadGallery();
    loadSystemSettings(); // New
}

// --- STATISTICS ---
async function loadStats() {
    if (!SCRIPT_URL) return;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=stats`);
        const data = await response.json();
        
        if (data.status === 'success') {
            // Server stats can be a fallback or supplemental
            if (data.stats) {
                if (data.stats.totalRaces) document.getElementById('stat-total-races').textContent = data.stats.totalRaces;
                if (data.stats.personalBest) document.getElementById('stat-pb').textContent = formatDisplayTime(data.stats.personalBest);
            }
        }
    } catch (error) {
        console.error("Error fetching stats:", error);
    }
    // Always recalculate from local data for consistency
    updateDashboardStats();
}

function updateDashboardStats() {
    if (!allRaces || allRaces.length === 0) return;

    let totalDistance = 0;
    let bestTime = null;
    const totalRaces = allRaces.length;

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

    // Update DOM
    const totalRacesEl = document.getElementById('stat-total-races');
    const pbEl = document.getElementById('stat-pb');
    const distEl = document.getElementById('stat-distance');
    const progressEl = document.getElementById('distance-progress-bar');
    const labelEl = document.getElementById('distance-progress-percent');

    if (totalRacesEl) totalRacesEl.textContent = totalRaces;
    if (pbEl) pbEl.textContent = formatDisplayTime(bestTime);
    if (distEl) distEl.textContent = totalDistance.toLocaleString(undefined, {maximumFractionDigits: 1});

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
    
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        
        if (data.status === 'success') {
            allRaces = data.data || [];
            filterRaces(''); // Initial render
            updateDashboardStats(); // Update stats whenever races are loaded
        }
    } catch (error) {
        console.error("Error fetching races:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-error font-bold">Error loading races.</td></tr>';
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
        tr.innerHTML = `
            <td class="py-4 pr-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center overflow-hidden">
                        ${race.Logo ? `<img src="${race.Logo}" class="w-full h-full object-contain">` : `<span class="material-symbols-outlined text-xs text-on-surface-variant">sprint</span>`}
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
        Display_RaceTable: document.getElementById('race-display').value,
        Logo: document.getElementById('race-logo').value, 
        logoBase64: currentLogoBase64,
        logoMimeType: currentLogoMime,
        logoFileName: currentLogoName,
        racePhotos: racePhotosBase64 // Added multi-photo support
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, data: raceData })
        });
        
        alert(raceId ? 'Race updated successfully!' : 'Race added successfully!');
        resetForm();
        loadRaces();
        loadStats();
        // Clear photo previews
        document.getElementById('race-photo-previews').innerHTML = '';
        document.getElementById('race-photo-previews').classList.add('hidden');
        document.getElementById('race-photo-status').classList.add('hidden');
        racePhotosBase64 = [];
    } catch (error) {
        console.error('Error saving race:', error);
        alert('Error saving data. Please check console.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
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
    document.getElementById('race-gallery-links').value = race.Gallery_Links || '';
    document.getElementById('race-display').value = race.Display_RaceTable || 'None';
    document.getElementById('race-logo').value = race.Logo || '';
    
    clearLogoPreview();
    
    if (race.Logo) {
        document.getElementById('logo-preview-container').classList.remove('hidden');
        document.getElementById('logo-preview').src = race.Logo;
    }
    
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
    clearLogoPreview();
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

    const blogData = {
        id: blogId,
        Title: document.getElementById('blog-title').value,
        ShortText: document.getElementById('blog-text').value,
        URL: document.getElementById('blog-url').value,
        Display: document.getElementById('blog-display').value
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, data: blogData })
        });
        
        alert(blogId ? 'Blog updated!' : 'Blog added!');
        resetBlogForm();
        loadBlogs();
    } catch (error) {
        console.error('Error saving blog:', error);
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
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteBlog', data: { id: id } })
        });
        alert('Blog deleted.');
        loadBlogs();
    } catch (error) {
        console.error('Error deleting blog:', error);
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
                        <span class="text-[10px] font-bold text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-lg border border-outline-variant">${item.Tagged_Race || 'Untagged'}</span>
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
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = async function() {
                // Image Resizing Logic
                const MAX_WIDTH = 1200;
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
                
                data.base64Data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                data.displayStatus = 'TRUE';
                
                try {
                    await sendGalleryRequest(action, data);
                    status.textContent = 'Success!';
                    setTimeout(() => {
                        closeGalleryModal();
                        loadGallery();
                    }, 1000);
                } catch (err) {
                    status.textContent = 'Upload failed.';
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
            status.textContent = 'Update failed.';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
}

async function sendGalleryRequest(action, data) {
    return fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, data: data })
    });
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
            const names = (data.data || []).map(item => item.RaceName).filter(Boolean);
            const select = document.getElementById('race-name');
            const dataList = document.getElementById('existing-races-list');
            const galleryRaceSelect = document.getElementById('edit-gallery-race');

            if (select) {
                select.innerHTML = '<option value="">Select a race</option>';
                names.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    select.appendChild(option);
                });
            }

            if (dataList) {
                dataList.innerHTML = '';
                names.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    dataList.appendChild(option);
                });
            }

            if (galleryRaceSelect) {
                galleryRaceSelect.innerHTML = '<option value="">No Tag</option>';
                names.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    galleryRaceSelect.appendChild(option);
                });
            }
        }
    } catch (error) {}
}

function openRaceNameModal() {
    document.getElementById('race-name-modal').classList.remove('hidden');
}

function closeRaceNameModal() {
    document.getElementById('race-name-modal').classList.add('hidden');
}

async function submitRaceNameForm(e) {
    e.preventDefault();
    const data = {
        RaceName: document.getElementById('new-race-name').value.trim(),
        Location: document.getElementById('new-race-location').value.trim(),
        Country: document.getElementById('new-race-country').value.trim(),
        Intro: document.getElementById('new-race-intro').value.trim(),
        logoBase64: currentEntityLogoBase64 // Added logo for race entity
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createRaceName', data: data })
        });
        alert('Race entity created.');
        closeRaceNameModal();
        document.getElementById('race-name-form').reset();
        loadRaceNames();
    } catch (error) {}
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

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
            currentLogoName = file.name;

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
    if (!container || !SCRIPT_URL) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSettings`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const settings = data.data || [];
            container.innerHTML = '';
            
            if (settings.length === 0) {
                container.innerHTML = '<p class="text-on-surface-variant py-4 text-center">No settings found in database.</p>';
                return;
            }

            settings.forEach(setting => {
                const div = document.createElement('div');
                div.className = "flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant";
                div.innerHTML = `
                    <div>
                        <p class="font-bold text-sm">${setting.Name}</p>
                        <p class="text-xs text-on-surface-variant">${setting.Description || 'Control section visibility'}</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" data-setting-id="${setting.id}" ${setting.Value === 'TRUE' ? 'checked' : ''} class="sr-only peer">
                        <div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                `;
                container.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        container.innerHTML = '<p class="text-error font-bold py-4">Failed to load settings.</p>';
    }
}

async function saveSystemSettings() {
    const btn = document.getElementById('save-settings-btn');
    const status = document.getElementById('settings-status');
    const checkboxes = document.querySelectorAll('#settings-container input[type="checkbox"]');
    
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving...';
    status.textContent = 'Updating visibility rules...';

    const settingsData = Array.from(checkboxes).map(cb => ({
        id: cb.getAttribute('data-setting-id'),
        Value: cb.checked ? 'TRUE' : 'FALSE'
    }));

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateSettings', data: settingsData })
        });
        
        status.textContent = 'Settings updated successfully!';
        setTimeout(() => status.textContent = '', 3000);
    } catch (error) {
        status.textContent = 'Error saving settings.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- PHOTO UPLOAD HELPERS ---
let racePhotosBase64 = [];

function handleRacePhotos(e) {
    const files = e.target.files;
    const previewContainer = document.getElementById('race-photo-previews');
    const status = document.getElementById('race-photo-status');
    
    if (!files.length) return;
    
    previewContainer.innerHTML = '';
    previewContainer.classList.remove('hidden');
    status.classList.remove('hidden');
    status.textContent = `Processing ${files.length} images...`;
    racePhotosBase64 = [];

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const b64 = canvas.toDataURL('image/jpeg', 0.7);
                racePhotosBase64.push({ b64: b64.split(',')[1], name: file.name, type: file.type });

                // Create preview
                const div = document.createElement('div');
                div.className = "relative group aspect-square rounded-lg overflow-hidden border border-outline-variant";
                div.innerHTML = `<img src="${b64}" class="w-full h-full object-cover">`;
                previewContainer.appendChild(div);

                if (racePhotosBase64.length === files.length) {
                    status.textContent = `${files.length} images ready to upload.`;
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Race Entity Logo Logic
let currentEntityLogoBase64 = null;
function handleRaceEntityLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 150; canvas.height = 150;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 150, 150);
            ctx.drawImage(img, 0, 0, 150, 150);
            currentEntityLogoBase64 = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('race-entity-logo-preview-container').classList.remove('hidden');
            document.getElementById('race-entity-logo-preview').src = currentEntityLogoBase64;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function clearRaceEntityLogo() {
    document.getElementById('race-entity-logo-file').value = '';
    document.getElementById('race-entity-logo-preview-container').classList.add('hidden');
    currentEntityLogoBase64 = null;
}

function handleRaceNameInput(value) {
    // Optional: Filter datalist or highlight existing
}
