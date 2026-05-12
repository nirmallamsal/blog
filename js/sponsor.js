const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    loadBankDetails();
    loadUpcomingRaces();
    applyVisibilitySettings();
    const questForm = document.getElementById('quest-contact-form');
    const formContainer = document.getElementById('form-container');
    
    if (questForm) {
        questForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('q-submit-btn');
            const originalText = btn.innerHTML;
            
            const name = document.getElementById('q-name').value;
            const company = document.getElementById('q-company').value;
            const email = document.getElementById('q-email').value;
            const interest = document.getElementById('q-interest').value;
            const message = document.getElementById('q-message').value;

            btn.innerHTML = '<span>Processing...</span>';
            btn.disabled = true;

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'submitInquiry',
                        data: { 
                            name, 
                            company, 
                            email, 
                            interest, 
                            message,
                            type: 'sponsor' 
                        }
                    })
                });

                const result = await response.json();
                
                if (result.status === 'success') {
                    formContainer.innerHTML = `
                        <div class="text-center py-20 animate-in fade-in zoom-in duration-500">
                            <div class="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-8">
                                <span class="material-symbols-outlined text-5xl">verified</span>
                            </div>
                            <h2 class="text-4xl font-heading font-extrabold text-on-surface mb-4">Quest Joined!</h2>
                            <p class="text-on-surface-variant text-lg max-w-md mx-auto mb-10 font-body">
                                Thank you, ${name}. Your proposal request for the <strong>${interest}</strong> tier has been received. My team will review your organization, <strong>${company || 'your team'}</strong>, and contact you shortly.
                            </p>
                            <button onclick="location.reload()" class="bg-primary text-white px-10 py-4 rounded-2xl font-heading font-bold hover:bg-on-primary-container transition-all shadow-xl shadow-primary/25">
                                Send Another Request
                            </button>
                        </div>
                    `;
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Sponsorship Submission error:', error);
                btn.innerHTML = '<span>Error! Try Again</span>';
                btn.classList.add('bg-error');
                btn.disabled = false;
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('bg-error');
                }, 3000);
            }
        });
    }
});

let allBankDetails = [];

async function loadBankDetails() {
    const loadingContainer = document.getElementById('support-loading-container');
    const displayArea = document.getElementById('support-display-area');
    const logosGrid = document.getElementById('payment-logos-grid');
    
    if (!loadingContainer || !displayArea || !logosGrid) return;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=bankDetails`);
        const result = await response.json();
        
        if (result.status === 'success') {
            allBankDetails = result.data || [];
            loadingContainer.classList.add('hidden');
            
            if (allBankDetails.length === 0) {
                loadingContainer.innerHTML = '<p class="text-sm text-on-surface-variant w-full">No payment options available.</p>';
                loadingContainer.classList.remove('hidden');
                return;
            }
            
            // Render the grid first
            logosGrid.innerHTML = '';
            allBankDetails.forEach((bank, index) => {
                const logoBtn = document.createElement('button');
                logoBtn.className = "payment-logo-btn bg-white border border-outline-variant/50 rounded-xl p-2 hover:border-primary/50 transition-all flex items-center justify-center aspect-[3/2] group";
                logoBtn.onclick = () => switchActiveBank(bank.id);
                
                if (bank.Platform_Logo_URL) {
                    const img = document.createElement('img');
                    img.src = bank.Platform_Logo_URL;
                    img.alt = bank.Platform;
                    img.className = "w-full h-full object-contain filter group-hover:grayscale-0 transition-all";
                    logoBtn.appendChild(img);
                } else {
                    const name = document.createElement('span');
                    name.className = "text-[10px] font-bold text-on-surface-variant uppercase text-center";
                    name.textContent = bank.Platform;
                    logoBtn.appendChild(name);
                }
                logosGrid.appendChild(logoBtn);
            });

            // Find default (marked Active) or first one
            const activeBank = allBankDetails.find(item => item.Status === 'Active') || allBankDetails[0];
            if (activeBank) {
                switchActiveBank(activeBank.id);
            }
            
            displayArea.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Error loading bank details:", e);
        loadingContainer.innerHTML = '<p class="text-sm text-error w-full">Failed to load payment options.</p>';
    }
}

function switchActiveBank(id) {
    const bank = allBankDetails.find(b => b.id === id);
    if (!bank) return;

    // Update UI elements
    const qrImg = document.getElementById('support-active-qr');
    const platImg = document.getElementById('support-active-platform-logo');
    const nameEl = document.getElementById('support-active-name');
    const accEl = document.getElementById('support-active-account');
    const platEl = document.getElementById('support-active-platform');
    const payoutBtn = document.getElementById('payout-button-container');
    const payoutLink = document.getElementById('payout-link');
    const payoutPlat = document.getElementById('payout-platform-name');
    const qrOverlay = document.getElementById('support-qr-overlay');

    if (qrImg) qrImg.src = bank.QR_Code_URL || '';
    if (platImg) {
        platImg.src = bank.Platform_Logo_URL || '';
        platImg.classList.toggle('hidden', !bank.Platform_Logo_URL);
    }
    if (nameEl) nameEl.textContent = bank.AccountName || bank.Platform;
    if (accEl) accEl.textContent = bank.AccountNumber_ID || '';
    if (platEl) platEl.textContent = bank.Platform || '';

    // Handle Payment URL
    if (bank.Payment_URL && bank.Payment_URL.trim() !== "") {
        if (payoutBtn) payoutBtn.classList.remove('hidden');
        if (payoutLink) payoutLink.href = bank.Payment_URL;
        if (payoutPlat) payoutPlat.textContent = bank.Platform;
        if (qrOverlay) {
            qrOverlay.classList.remove('hidden');
            qrOverlay.onclick = () => window.open(bank.Payment_URL, '_blank');
        }
    } else {
        if (payoutBtn) payoutBtn.classList.add('hidden');
        if (qrOverlay) {
            qrOverlay.classList.add('hidden');
            qrOverlay.onclick = null;
        }
    }

    // Scroll to display area if it's mobile and user clicked a logo below
    const displayArea = document.getElementById('support-display-area');
    if (window.innerWidth < 640 && displayArea) {
        // Only scroll if we are not already at the top of display area
        const rect = displayArea.getBoundingClientRect();
        if (rect.top < 0) {
            displayArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard!");
    });
};

async function loadUpcomingRaces() {
    const container = document.getElementById('upcoming-races-container');
    if (!container) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?_=${Date.now()}`);
        const data = await response.json();

        if (data.status === 'success' && data.data && data.data.length > 0) {
            const upcomingRaces = data.data
                .filter(r => 
                    String(r.RaceStatus || '').toLowerCase() === 'upcoming' || 
                    String(r.Display_RaceTable || '').startsWith('Upcoming_')
                )
                .sort((a, b) => {
                    // Sort by slot if available, otherwise by timestamp or name
                    const slotA = String(a.Display_RaceTable || '');
                    const slotB = String(b.Display_RaceTable || '');
                    if (slotA.startsWith('Upcoming_') && slotB.startsWith('Upcoming_')) {
                        return slotA.localeCompare(slotB);
                    }
                    if (slotA.startsWith('Upcoming_')) return -1;
                    if (slotB.startsWith('Upcoming_')) return 1;
                    return 0;
                });

            if (upcomingRaces.length === 0) {
                const upcomingSection = document.getElementById('upcoming-races');
                if (upcomingSection) upcomingSection.style.display = 'none';
                return;
            }

            container.innerHTML = '';
            upcomingRaces.forEach(race => {
                const card = document.createElement('div');
                card.className = 'race-card fade-up';
                
                const placeholderSvg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70"><rect width="70" height="70" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-weight="bold" font-size="12" fill="#94a3b8">LOGO</text></svg>')}`;
                const logoSrc = race.Logo || placeholderSvg;
                
                const raceSlug = String(race.RaceName || '').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
                
                card.onclick = () => window.location.href = `race.html?race=${raceSlug}`;

                card.innerHTML = `
                    <div class="flex items-center gap-4">
                        <img src="${logoSrc}" alt="${race.RaceName}" class="race-logo" onerror="this.src='${placeholderSvg}'">
                        <div class="race-info">
                            <h3>${race.RaceName}</h3>
                            <div class="race-meta">
                                <span class="type-text">${race.Type || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-auto">
                        <span class="year-chip">${race.Participation || 'Upcoming'}</span>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error loading upcoming races:', error);
        container.innerHTML = '<div class="col-span-full text-center py-12"><p class="text-error">Failed to load upcoming races.</p></div>';
    }
}

async function applyVisibilitySettings() {
    if (!SCRIPT_URL) return;
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSettings&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const settings = result.data;
            // Map the 'upcoming_races' setting to the sponsor page's section ID
            if (settings['upcoming_races'] === 'Hide') {
                const upcomingSection = document.getElementById('upcoming-races');
                if (upcomingSection) {
                    upcomingSection.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error applying visibility settings on sponsor page:', error);
    }
}
