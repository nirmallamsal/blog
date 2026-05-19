const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec';

let allActivities = [];
let currentPage = 1;
const itemsPerPage = 5;

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
            renderSummary(statsData.data[0], allActivities[0]);
            renderTable();
        }
    } catch (error) {
        console.error("Error fetching training data:", error);
    }
}

function renderSummary(stats, latest) {
    const container = document.getElementById('training-summary');
    
    if (!stats || !latest) {
        container.innerHTML = '<div class="page-notice">No training data found. Please run "Sync Strava" from the Admin Panel to populate your dashboard.</div>';
        return;
    }

    const totalDist = parseFloat(stats.TotalDistance || 0).toLocaleString('en-US');
    
    container.innerHTML = `
        <div class="strava-card latest-activity">
            <div class="card-tag">Latest Session</div>
            <h4 class="activity-name">${latest.name || 'No recent activity'}</h4>
            <div class="activity-date">${latest.date || '-'}</div>
            <div class="activity-stats-grid">
                <div class="mini-stat">
                    <span class="label">Distance</span>
                    <span class="value">${latest.distance || '0'} km</span>
                </div>
                <div class="mini-stat">
                    <span class="label">Duration</span>
                    <span class="value">${latest.duration || '0'} mins</span>
                </div>
                <div class="mini-stat">
                    <span class="label">Elevation</span>
                    <span class="value">${latest.elevation || '0'} m</span>
                </div>
                <div class="mini-stat">
                    <span class="label">Type</span>
                    <span class="value">${latest.type || 'Activity'}</span>
                </div>
            </div>
        </div>

        <div class="strava-card lifetime-stats">
            <div class="card-tag">Lifetime Achievements</div>
            <div class="total-km-display">
                <span class="label">Total Career Distance</span>
                <div class="large-value">${totalDist} <small>KM</small></div>
            </div>
            <div class="lifetime-meta">
                <div class="meta-item">
                    <span class="label">Total Duration</span>
                    <span class="value">${stats.RecentDistance || '0h 0m'}</span>
                </div>
                <div class="meta-item">
                    <span class="label">Activities</span>
                    <span class="value">${stats.Activities || '0'}</span>
                </div>
            </div>
        </div>
    `;
}

function renderTable() {
    const tbody = document.getElementById('activities-body');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = allActivities.slice(startIndex, endIndex);

    tbody.innerHTML = pageItems.map(act => `
        <tr>
            <td><strong>${act.date}</strong></td>
            <td>${act.name}</td>
            <td><span class="type-chip ${act.type.toLowerCase() === 'run' ? 'type-run' : 'type-ride'}">${act.type}</span></td>
            <td>${act.distance} km</td>
            <td>${act.duration} mins</td>
            <td>${act.elevation} m</td>
        </tr>
    `).join('');

    document.getElementById('current-page').innerText = currentPage;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = endIndex >= allActivities.length;
}

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if ((currentPage * itemsPerPage) < allActivities.length) {
        currentPage++;
        renderTable();
    }
});

// Use the SCRIPT_URL from main.js if available
window.addEventListener('load', () => {
    if (typeof SCRIPT_URL !== 'undefined') {
        fetchTrainingData();
    }
});
