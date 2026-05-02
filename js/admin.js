const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxE7Mvk2bFUaL_BCvwhjTsB2FMyxLl-sQGn59cw4c4GRURlD3O6mtQccyEz7hIAGCxTTQ/exec';

let allRaces = [];
let currentLogoBase64 = null;
let currentLogoMime = null;
let currentLogoName = null;

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadRaces();

    // File input handler for Logo
    const fileInput = document.getElementById('race-logo-file');
    fileInput.addEventListener('change', handleLogoUpload);

    // Time input formatter (HH:MM:SS)
    const timeInput = document.getElementById('race-time');
    timeInput.addEventListener('input', formatTimeInput);

    // RaceName auto-fill handler
    const raceNameInput = document.getElementById('race-name');
    raceNameInput.addEventListener('input', handleRaceNameAutofill);

    const form = document.getElementById('add-race-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
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
            Logo: document.getElementById('race-logo').value, // existing logo
            logoBase64: currentLogoBase64,
            logoMimeType: currentLogoMime,
            logoFileName: currentLogoName
        };

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: action, data: raceData })
            });
            
            alert(raceId ? 'Race updated successfully!' : 'Race added successfully!');
            resetForm();
            loadRaces();
            loadStats();
        } catch (error) {
            console.error('Error saving race:', error);
            alert('Error saving data. Please check console.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Blog Form Handler
    const blogForm = document.getElementById('blog-form');
    blogForm.addEventListener('submit', async (e) => {
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
            alert('Error saving blog.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    loadBlogs();
});

async function loadStats() {
    if (!SCRIPT_URL) return;
    const statsContainer = document.getElementById('admin-stats');
    try {
        const response = await fetch(`${SCRIPT_URL}?action=stats`);
        const data = await response.json();
        
        if (data.status === 'success') {
            statsContainer.innerHTML = `
                <div style="display:flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Total Races:</span>
                    <strong>${data.stats.totalRaces}</strong>
                </div>
                <div style="display:flex; justify-content: space-between;">
                    <span>Personal Best:</span>
                    <strong>${formatDisplayTime(data.stats.personalBest)}</strong>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error fetching stats:", error);
        statsContainer.innerHTML = '<p class="text-muted">Error loading stats.</p>';
    }
}

function formatDisplayTime(timeStr) {
    if (!timeStr) return '-';
    // Remove any accidental leading dashes or non-alphanumeric junk before parsing
    timeStr = String(timeStr).replace(/^[-]+/, '');
    
    // Handle Google Sheets ISO date string
    if (timeStr.includes('T') && timeStr.includes('Z')) {
        try {
            const d = new Date(timeStr);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        } catch(e) {}
    }
    
    // Handle 6-digit numeric string (e.g. 031545 -> 03:15:45)
    if (/^\d{6}$/.test(timeStr)) {
        return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
    }
    
    return timeStr;
}

async function loadRaces() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-race-table-body');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Loading races...</td></tr>';
    
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        
        if (data.status === 'success') {
            allRaces = data.data;
            populateRaceNameDatalist();
            
            if (allRaces.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No races recorded yet.</td></tr>';
            } else {
                tbody.innerHTML = '';
                allRaces.forEach(race => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${race.RaceName}</strong></td>
                        <td>${race.Type}</td>
                        <td>${race.Participation}</td>
                        <td>${race.Distance || '-'}</td>
                        <td>${formatDisplayTime(race.Time)}</td>
                        <td>${race.Position || '-'}</td>
                        <td>${race.PB}</td>
                        <td>${race.Display_RaceTable}</td>
                        <td>
                            <button class="action-btn edit" onclick="editRace('${race.id}')">Edit</button>
                            <button class="action-btn delete" onclick="deleteRace('${race.id}')">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (error) {
        console.error("Error fetching races:", error);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Error loading races.</td></tr>';
    }
}

function populateRaceNameDatalist() {
    const datalist = document.getElementById('existing-races');
    datalist.innerHTML = '';
    const uniqueNames = [...new Set(allRaces.map(r => r.RaceName).filter(Boolean))];
    uniqueNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        datalist.appendChild(option);
    });
}

function handleRaceNameAutofill(e) {
    // Only auto-fill if we are adding a new race (not editing)
    const currentId = document.getElementById('race-id').value;
    if (currentId) return;

    const enteredName = e.target.value.trim().toLowerCase();
    const existingRace = allRaces.find(r => r.RaceName.trim().toLowerCase() === enteredName);

    if (existingRace) {
        // Auto-fill fields
        if (!document.getElementById('race-type').value) {
            document.getElementById('race-type').value = existingRace.Type || '';
        }
        
        // Auto-fill Logo if available
        if (existingRace.Logo && !document.getElementById('race-logo').value) {
            document.getElementById('race-logo').value = existingRace.Logo;
            document.getElementById('logo-preview-container').style.display = 'block';
            document.getElementById('logo-preview').src = existingRace.Logo;
            currentLogoBase64 = existingRace.Logo; // Since it's already base64, we can keep it
        }
    }
}

function editRace(id) {
    const race = allRaces.find(r => r.id === id);
    if (!race) return;

    document.getElementById('form-title').textContent = 'Update Race';
    document.getElementById('submit-btn').textContent = 'Update Race';
    document.getElementById('cancel-btn').style.display = 'block';

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
    document.getElementById('race-logo').value = race.Logo || '';
    
    // Clear any pending uploads
    clearLogo();
    
    if (race.Logo) {
        document.getElementById('logo-preview-container').style.display = 'block';
        document.getElementById('logo-preview').src = race.Logo;
    }
    
    // Scroll to form
    document.getElementById('add-race-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteRace(id) {
    if (!confirm('Are you sure you want to delete this race?')) return;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
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
    document.getElementById('submit-btn').textContent = 'Save Race';
    document.getElementById('cancel-btn').style.display = 'none';
    clearLogo();
}

// ---- LOGO UPLOAD COMPRESSION LOGIC ----

function clearLogo() {
    document.getElementById('race-logo-file').value = '';
    document.getElementById('logo-preview-container').style.display = 'none';
    document.getElementById('logo-preview').src = '';
    document.getElementById('race-logo').value = ''; // clears explicit old logo URL if user wants to delete it completely
    currentLogoBase64 = null;
    currentLogoMime = null;
    currentLogoName = null;
}

function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Compress Image (max 150x150) to ensure it fits in Google Sheets cell limits
            const MAX_SIZE = 150;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Fill with white background in case it's a transparent PNG being converted to JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Compress as JPEG to make it very small (base64)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);

            // Set state variables
            currentLogoBase64 = compressedDataUrl;
            currentLogoMime = file.type;
            currentLogoName = file.name;

            // Preview
            document.getElementById('logo-preview-container').style.display = 'block';
            document.getElementById('logo-preview').src = compressedDataUrl;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// ---- TIME INPUT FORMATTING LOGIC ----
function formatTimeInput(e) {
    let input = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    
    // Truncate to max 6 digits (HHMMSS)
    if (input.length > 6) {
        input = input.substring(0, 6);
    }
    
    // Format as HH:MM:SS
    let formatted = '';
    if (input.length > 0) {
        formatted += input.substring(0, 2);
    }
    if (input.length > 2) {
        formatted += ':' + input.substring(2, 4);
    }
    if (input.length > 4) {
        formatted += ':' + input.substring(4, 6);
    }
    
    e.target.value = formatted;
}
// ---- BLOG MANAGEMENT LOGIC ----

let allBlogs = [];

async function loadBlogs() {
    if (!SCRIPT_URL) return;
    const tbody = document.getElementById('admin-blog-table-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading blogs...</td></tr>';
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=blogs`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (data.status === 'success') {
            allBlogs = data.data || [];
            if (allBlogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No blogs recorded yet.</td></tr>';
            } else {
                tbody.innerHTML = '';
                allBlogs.forEach(blog => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${blog.Title || 'Untitled'}</strong></td>
                        <td title="${blog.ShortText || ''}">${(blog.ShortText || '').substring(0, 30)}...</td>
                        <td><a href="${blog.URL || '#'}" target="_blank">Link</a></td>
                        <td>${blog.Display || 'No'}</td>
                        <td>
                            <button class="action-btn edit" onclick="editBlog('${blog.id}')">Edit</button>
                            <button class="action-btn delete" onclick="deleteBlog('${blog.id}')">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } else {
            throw new Error(data.message || 'Server error');
        }
    } catch (error) {
        console.error("Error fetching blogs:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ff4444;">Error loading blogs: ${error.message}</td></tr>`;
    }
}

function editBlog(id) {
    const blog = allBlogs.find(b => b.id === id);
    if (!blog) return;

    document.getElementById('blog-form-title').textContent = 'Update Blog Post';
    document.getElementById('blog-submit-btn').textContent = 'Update Blog';
    document.getElementById('blog-cancel-btn').style.display = 'block';

    document.getElementById('blog-id').value = blog.id;
    document.getElementById('blog-title').value = blog.Title || '';
    document.getElementById('blog-text').value = blog.ShortText || '';
    document.getElementById('blog-url').value = blog.URL || '';
    document.getElementById('blog-display').value = blog.Display || 'No';
    
    document.getElementById('blog-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteBlog(id) {
    if (!confirm('Delete this blog post?')) return;
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
        alert('Error deleting blog.');
    }
}

function resetBlogForm() {
    document.getElementById('blog-form').reset();
    document.getElementById('blog-id').value = '';
    document.getElementById('blog-form-title').textContent = 'Add New Blog Post';
    document.getElementById('blog-submit-btn').textContent = 'Save Blog';
    document.getElementById('blog-cancel-btn').style.display = 'none';
}
