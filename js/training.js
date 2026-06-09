// ===== TRAINING DASHBOARD - INTERACTIVE CONTROLLER =====
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec';

let allActivities = [];
let filteredActivities = [];
let currentPage = 1;
const itemsPerPage = 8;
let currentFilter = 'all';
let currentSearch = '';
let sortField = 'date';
let sortDir = 'desc';

// Chart instances
let distanceChartInstance = null;
let typeChartInstance = null;
let elevationChartInstance = null;
let durationChartInstance = null;
let paceChartInstance = null;

// ===== DATA FETCHING =====
async function fetchTrainingData() {
    try {
        const [statsRes, actsRes] = await Promise.all([
            fetch(`${window.SCRIPT_URL || SCRIPT_URL}?action=getStravaData`),
            fetch(`${window.SCRIPT_URL || SCRIPT_URL}?action=getStravaActivities`)
        ]);

        const statsData = await statsRes.json();
        const actsData = await actsRes.json();

        if (statsData.status === 'success' && actsData.status === 'success') {
            allActivities = actsData.data;
            filteredActivities = [...allActivities];

            renderSpotlight(allActivities[0]);
            renderHeroStats(statsData.data[0], allActivities);
            renderDistanceChart(allActivities);
            renderTypeChart(allActivities);
            renderElevationChart(allActivities);
            renderDurationChart(allActivities);
            renderPaceChart(allActivities);
            renderTable();
        }
    } catch (error) {
        console.error("Error fetching training data:", error);
        document.getElementById('spot-name').textContent = 'Unable to load data';
    }
}

// ===== LATEST ACTIVITY SPOTLIGHT =====
function renderSpotlight(latest) {
    if (!latest) return;
    document.getElementById('spot-name').textContent = latest.name || 'No recent activity';
    document.getElementById('spot-date').textContent = latest.date || '—';
    document.getElementById('spot-dist').textContent = `${latest.distance || 0} km`;
    document.getElementById('spot-dur').textContent = `${latest.duration || 0} min`;
    document.getElementById('spot-elev').textContent = `${latest.elevation || 0} m`;
    document.getElementById('spot-type').textContent = latest.type || 'Activity';
}

// ===== HERO STATS WITH COUNTING ANIMATION =====
function renderHeroStats(stats, activities) {
    if (!stats) return;

    const totalDist = parseFloat(stats.TotalDistance || 0);
    const totalActs = parseInt(stats.Activities || activities.length || 0);
    const avgDist = totalActs > 0 ? (totalDist / totalActs).toFixed(1) : 0;

    animateCounter('stat-total-dist', totalDist, 0);
    animateCounter('stat-total-acts', totalActs, 0);
    animateCounter('stat-avg-dist', parseFloat(avgDist), 1);

    document.getElementById('stat-total-dur').innerHTML = `${stats.RecentDistance || '0h 0m'}`;
}

function animateCounter(elementId, target, decimals = 0) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 2000;
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = eased * target;

        el.textContent = current.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// Helper to parse date strings of format "dd-MMM-yyyy" (e.g. "27-May-2026") or fallback to standard parsing
function parseCustomDate(dateStr) {
    if (!dateStr) return new Date(0);
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const monthStr = parts[1].toLowerCase();
            const year = parseInt(parts[2], 10);
            
            const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const monthIdx = shortMonths.indexOf(monthStr);
            if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
                return new Date(year, monthIdx, day);
            }
        }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

// Helper to format chart x-axis labels to avoid clutter
// Shows "Month Day" on the left (first label) and when the month changes, and just "Day" elsewhere.
function formatChartLabels(data) {
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return data.map((a, idx) => {
        if (!a.date) return '';
        const d = parseCustomDate(a.date);
        if (isNaN(d.getTime())) return a.date;
        
        const day = d.getDate();
        const month = shortMonths[d.getMonth()];
        
        // Show month + day for the first label
        if (idx === 0) {
            return `${month} ${day}`;
        }
        
        // Show month + day if month changed from the previous item
        const prevD = parseCustomDate(data[idx - 1].date);
        if (!isNaN(prevD.getTime()) && prevD.getMonth() !== d.getMonth()) {
            return `${month} ${day}`;
        }
        
        // Otherwise just show the day
        return day.toString();
    });
}

// ===== CHART: Distance Over Time =====
function renderDistanceChart(activities, limit = 10) {
    const ctx = document.getElementById('distanceChart');
    if (!ctx) return;

    let data = [...activities].reverse();
    if (limit !== 'all') data = data.slice(-parseInt(limit));

    const labels = formatChartLabels(data);
    const distances = data.map(a => parseFloat(a.distance) || 0);

    if (distanceChartInstance) distanceChartInstance.destroy();

    distanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Distance (km)',
                data: distances,
                borderColor: '#006973',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx: c, chartArea} = chart;
                    if (!chartArea) return 'rgba(0,105,115,0.1)';
                    const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(0,105,115,0.25)');
                    gradient.addColorStop(1, 'rgba(0,105,115,0.02)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: '#006973',
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#006973',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleFont: { family: 'Outfit', weight: '700' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            return data[idx].date || '';
                        },
                        label: (ctx) => `${ctx.parsed.y.toFixed(1)} km`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10, family: 'Inter', weight: '600' },
                        color: '#9ca3af',
                        maxTicksLimit: 8,
                        maxRotation: 0
                    }
                },
                y: {
                    grid: { color: 'rgba(0,105,115,0.05)', drawBorder: false },
                    ticks: {
                        font: { size: 10, family: 'Inter', weight: '600' },
                        color: '#9ca3af',
                        callback: (v) => v + ' km'
                    }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            }
        }
    });
}

function setDistancePeriod(period, btnEl) {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderDistanceChart(allActivities, period);
}

// ===== CHART: Activity Type Breakdown (Doughnut) =====
function renderTypeChart(activities) {
    const ctx = document.getElementById('typeChart');
    if (!ctx) return;

    const typeCounts = {};
    activities.forEach(a => {
        const t = (a.type || 'Other').toLowerCase();
        typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const typeColors = {
        run: '#006973',
        ride: '#FC4C02',
        walk: '#7C3AED',
        hike: '#10B981',
        swim: '#3B82F6',
        other: '#6B7280'
    };

    const labels = Object.keys(typeCounts).map(t => t.charAt(0).toUpperCase() + t.slice(1));
    const data = Object.values(typeCounts);
    const colors = Object.keys(typeCounts).map(t => typeColors[t] || typeColors.other);
    const total = data.reduce((a, b) => a + b, 0);

    document.getElementById('doughnut-total').textContent = total;

    // Build legend
    const legendEl = document.getElementById('type-legend');
    legendEl.innerHTML = labels.map((label, i) => `
        <div class="legend-item">
            <div class="legend-dot" style="background:${colors[i]}"></div>
            ${label} (${data[i]})
        </div>
    `).join('');

    if (typeChartInstance) typeChartInstance.destroy();

    typeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: '#fff',
                hoverBorderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleFont: { family: 'Outfit', weight: '700' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: (ctx) => {
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
}

// ===== CHART: Elevation Gain =====
function renderElevationChart(activities) {
    const ctx = document.getElementById('elevationChart');
    if (!ctx) return;

    const data = [...activities].reverse().slice(-20);
    const labels = formatChartLabels(data);
    const elevations = data.map(a => parseFloat(a.elevation) || 0);

    if (elevationChartInstance) elevationChartInstance.destroy();

    elevationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Elevation (m)',
                data: elevations,
                backgroundColor: (context) => {
                    const value = context.parsed?.y || 0;
                    const max = Math.max(...elevations, 1);
                    const intensity = 0.3 + (value / max) * 0.7;
                    return `rgba(0,105,115,${intensity})`;
                },
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 28,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleFont: { family: 'Outfit', weight: '700' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            return data[idx].date || '';
                        },
                        label: (ctx) => `${ctx.parsed.y} m elevation`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9, family: 'Inter', weight: '600' }, color: '#9ca3af', maxTicksLimit: 10, maxRotation: 0 }
                },
                y: {
                    grid: { color: 'rgba(0,105,115,0.05)', drawBorder: false },
                    ticks: { font: { size: 10, family: 'Inter', weight: '600' }, color: '#9ca3af', callback: (v) => v + ' m' }
                }
            },
            animation: { duration: 1200, easing: 'easeOutQuart' }
        }
    });
}

// ===== CHART: Duration Trend =====
function renderDurationChart(activities) {
    const ctx = document.getElementById('durationChart');
    if (!ctx) return;

    const data = [...activities].reverse().slice(-20);
    const labels = formatChartLabels(data);
    const durations = data.map(a => parseFloat(a.duration) || 0);

    if (durationChartInstance) durationChartInstance.destroy();

    durationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Duration (min)',
                data: durations,
                borderColor: '#7C3AED',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx: c, chartArea} = chart;
                    if (!chartArea) return 'rgba(124,58,237,0.1)';
                    const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(124,58,237,0.2)');
                    gradient.addColorStop(1, 'rgba(124,58,237,0.02)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: '#7C3AED',
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#7C3AED',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleFont: { family: 'Outfit', weight: '700' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            return data[idx].date || '';
                        },
                        label: (ctx) => `${ctx.parsed.y} mins`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9, family: 'Inter', weight: '600' }, color: '#9ca3af', maxTicksLimit: 10, maxRotation: 0 }
                },
                y: {
                    grid: { color: 'rgba(124,58,237,0.05)', drawBorder: false },
                    ticks: { font: { size: 10, family: 'Inter', weight: '600' }, color: '#9ca3af', callback: (v) => v + ' min' }
                }
            },
            animation: { duration: 1200, easing: 'easeOutQuart' }
        }
    });
}

// ===== CHART: Pace Trend =====
function renderPaceChart(activities) {
    const ctx = document.getElementById('paceChart');
    if (!ctx) return;

    // Filter to activities that have a valid pace (not '-') and reverse for chronological order
    const validActivities = [...activities].reverse().filter(a => a.pace && a.pace !== '-' && !a.pace.includes(':00:'));
    const data = validActivities.slice(-20);
    const labels = formatChartLabels(data);
    const paces = data.map(a => {
        const parts = a.pace.split(':').map(Number);
        if (parts.length === 2) return parts[0] + parts[1] / 60; // Convert to decimal minutes
        return 0;
    });

    if (paceChartInstance) paceChartInstance.destroy();

    paceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Pace (min/km)',
                data: paces,
                borderColor: '#10B981',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx: c, chartArea} = chart;
                    if (!chartArea) return 'rgba(16,185,129,0.1)';
                    const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(16,185,129,0.2)');
                    gradient.addColorStop(1, 'rgba(16,185,129,0.02)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: '#10B981',
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#10B981',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    titleFont: { family: 'Outfit', weight: '700' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            const idx = tooltipItems[0].dataIndex;
                            return data[idx].date || '';
                        },
                        label: (ctx) => {
                            const val = ctx.parsed.y;
                            const mins = Math.floor(val);
                            const secs = Math.round((val - mins) * 60);
                            return `${mins}:${secs < 10 ? '0' : ''}${secs} /km`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9, family: 'Inter', weight: '600' }, color: '#9ca3af', maxTicksLimit: 10, maxRotation: 0 }
                },
                y: {
                    reverse: true, // Lower pace = faster = better, so invert axis
                    grid: { color: 'rgba(16,185,129,0.05)', drawBorder: false },
                    ticks: {
                        font: { size: 10, family: 'Inter', weight: '600' },
                        color: '#9ca3af',
                        callback: (v) => {
                            const mins = Math.floor(v);
                            const secs = Math.round((v - mins) * 60);
                            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                        }
                    }
                }
            },
            animation: { duration: 1200, easing: 'easeOutQuart' }
        }
    });
}

// ===== FILTERING =====
function filterActivities(type, btnEl) {
    currentFilter = type;
    currentPage = 1;

    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    applyFilters();
    renderTable();
}

function searchActivities(query) {
    currentSearch = query.toLowerCase().trim();
    currentPage = 1;
    applyFilters();
    renderTable();
}

function applyFilters() {
    filteredActivities = allActivities.filter(a => {
        const matchType = currentFilter === 'all' || (a.type || '').toLowerCase() === currentFilter;
        const matchSearch = !currentSearch ||
            (a.name || '').toLowerCase().includes(currentSearch) ||
            (a.date || '').toLowerCase().includes(currentSearch) ||
            (a.type || '').toLowerCase().includes(currentSearch);
        return matchType && matchSearch;
    });

    // Apply current sort
    sortActivities();
}

// ===== SORTING =====
function sortTable(field) {
    if (sortField === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDir = 'desc';
    }

    // Update header visual
    document.querySelectorAll('.training-table th').forEach(th => th.classList.remove('sorted'));
    const headers = document.querySelectorAll('.training-table th');
    const fieldIndex = ['date', 'name', 'type', 'distance', 'pace', 'duration', 'elevation'].indexOf(field);
    if (fieldIndex >= 0 && headers[fieldIndex]) {
        headers[fieldIndex].classList.add('sorted');
        headers[fieldIndex].querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '▲' : '▼';
    }

    sortActivities();
    renderTable();
}

function sortActivities() {
    filteredActivities.sort((a, b) => {
        let vA, vB;
        switch (sortField) {
            case 'date':
                vA = parseCustomDate(a.date).getTime();
                vB = parseCustomDate(b.date).getTime();
                break;
            case 'name':
                vA = (a.name || '').toLowerCase();
                vB = (b.name || '').toLowerCase();
                return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
            case 'type':
                vA = (a.type || '').toLowerCase();
                vB = (b.type || '').toLowerCase();
                return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
            case 'distance':
                vA = parseFloat(a.distance) || 0;
                vB = parseFloat(b.distance) || 0;
                break;
            case 'pace':
                vA = parsePaceToSeconds(a.pace);
                vB = parsePaceToSeconds(b.pace);
                break;
            case 'duration':
                vA = parseFloat(a.duration) || 0;
                vB = parseFloat(b.duration) || 0;
                break;
            case 'elevation':
                vA = parseFloat(a.elevation) || 0;
                vB = parseFloat(b.elevation) || 0;
                break;
            default:
                return 0;
        }
        return sortDir === 'asc' ? vA - vB : vB - vA;
    });
}

// Helper to convert pace string (e.g. "05:04") to total seconds for sorting
function parsePaceToSeconds(paceStr) {
    if (!paceStr || paceStr === '-') return Infinity; // No pace = sort to end
    const parts = paceStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return Infinity;
}

// ===== TABLE RENDERING =====
function getTypeClass(type) {
    const t = (type || '').toLowerCase();
    if (t === 'run') return 'type-run';
    if (t === 'ride') return 'type-ride';
    if (t === 'walk') return 'type-walk';
    if (t === 'hike') return 'type-hike';
    if (t === 'swim') return 'type-swim';
    return 'type-other';
}

function renderTable() {
    const tbody = document.getElementById('activities-body');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredActivities.slice(startIndex, endIndex);

    // Max distance for bar width scaling
    const maxDist = Math.max(...filteredActivities.map(a => parseFloat(a.distance) || 0), 1);

    if (pageItems.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="no-results">
                    <div class="emoji">🔍</div>
                    <div class="msg">No activities found matching your criteria</div>
                </div>
            </td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map((act, i) => {
            const dist = parseFloat(act.distance) || 0;
            const barWidth = Math.max((dist / maxDist) * 100, 4);
            const paceDisplay = act.pace && act.pace !== '-' ? `${act.pace} /km` : '—';
            return `
            <tr style="animation-delay: ${i * 0.05}s">
                <td><strong>${act.date}</strong></td>
                <td style="font-weight:600;">${act.name}</td>
                <td><span class="type-chip ${getTypeClass(act.type)}">${act.type}</span></td>
                <td>
                    <div class="dist-bar-wrap">
                        <span class="dist-val">${act.distance} km</span>
                        <div class="dist-bar"><div class="dist-bar-fill" style="width:${barWidth}%"></div></div>
                    </div>
                </td>
                <td>${paceDisplay}</td>
                <td>${act.duration} min</td>
                <td>${act.elevation} m</td>
            </tr>`;
        }).join('');
    }

    renderPagination();
}

// ===== PAGINATION =====
function renderPagination() {
    const totalItems = filteredActivities.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    document.getElementById('pagination-info').textContent =
        totalItems > 0 ? `Showing ${start}–${end} of ${totalItems} activities` : 'No activities to show';

    const btnsContainer = document.getElementById('pagination-btns');
    let btnsHTML = '';

    // Previous
    btnsHTML += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">← Prev</button>`;

    // Page numbers (show max 5 around current)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        btnsHTML += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) btnsHTML += `<span style="color:#9ca3af;padding:0 0.3rem;">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        btnsHTML += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) btnsHTML += `<span style="color:#9ca3af;padding:0 0.3rem;">…</span>`;
        btnsHTML += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Next
    btnsHTML += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Next →</button>`;

    btnsContainer.innerHTML = btnsHTML;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();

    // Smooth scroll to table
    document.querySelector('.training-table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== SCROLL REVEAL ANIMATION =====
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-in-section').forEach(el => observer.observe(el));
}

// ===== INIT =====
window.addEventListener('load', () => {
    initScrollReveal();
    fetchTrainingData();
});
