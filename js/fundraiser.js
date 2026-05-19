const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx83zXlV1s7xDwoUqzmXKg-xaipfahc8vaDH3BimCYX0C9ICHL3yemKDzb8Q2NKvp7P/exec';

// Pluggable Contributor List (Admin Integration Ready)
// Pluggable Contributor List (Admin Integration Ready)
let contributors = [];

// Target Fundraising Goal
let TARGET_AMOUNT = 1000000;

const EXCHANGE_RATES = {
    'NPR': 1.0,
    'AUD': 90.0,    // 1 AUD = ~90 NPR
    'US $': 133.0,  // 1 USD = ~133 NPR
    'EURO': 145.0,  // 1 EUR = ~145 NPR
    'POUND': 168.0  // 1 GBP = ~168 NPR
};

function getCurrencySymbol(curr) {
    switch(String(curr).toUpperCase()) {
        case 'NPR': return 'Rs. ';
        case 'US $':
        case 'USD': return '$';
        case 'EURO':
        case 'EUR': return '€';
        case 'POUND':
        case 'GBP': return '£';
        case 'AUD':
        default: return 'A$';
    }
}

// Default Static Payment Details (Fallback if SCRIPT_URL is unavailable or fails)
const defaultPaymentDetails = {
    wallet: {
        platform: "eSewa / Khalti",
        accountName: "Nirmal Lamsal",
        accountNumber: "9800000000",
        qrCode: "assets/qr/wallet-qr.svg"
    },
    bank: {
        platform: "Nepal Investment Mega Bank",
        accountName: "Nirmal Lamsal",
        accountNumber: "0123456789012345",
        qrCode: "assets/qr/bank-qr.svg",
        branch: "Kathmandu",
        swiftCode: "NIBLNPKT"
    }
};

let activePaymentDetails = { ...defaultPaymentDetails };

document.addEventListener('DOMContentLoaded', () => {
    // 1. Calculate & Render Fundraiser Stats
    initStatsAndLeaderboard();

    // 2. Fetch Dynamic Payment Details from Google Sheet if SCRIPT_URL exists
    fetchDynamicPaymentDetails();

    // Fetch dynamic contributors list
    fetchDynamicContributors();

    // 3. Initialize Payment Panel Toggle Event Listeners
    initPaymentToggle();

    // 4. Initialize Social Sharing Functionality
    initSocialSharing();

    // Set current year in footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }
});

/**
 * Calculates stats from contributors and renders leaderboard and table
 */
function initStatsAndLeaderboard() {
    const getConvertedAmount = item => (parseFloat(item.amount) || 0) * (EXCHANGE_RATES[item.currency] || 1.0);

    // Sort contributors descending by converted AUD amount
    const sorted = [...contributors].sort((a, b) => getConvertedAmount(b) - getConvertedAmount(a));
    
    // Calculate totals
    const totalRaised = sorted.reduce((sum, item) => sum + getConvertedAmount(item), 0);
    const totalSupporters = sorted.length;
    const progressPercent = Math.min((totalRaised / TARGET_AMOUNT) * 100, 100).toFixed(0);

    // Update Progress Bar
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-percent');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${progressPercent}%`;

    // Counters Animation
    animateCounter('target-amount', TARGET_AMOUNT, 'Rs. ');
    animateCounter('raised-amount', totalRaised, 'Rs. ');
    animateCounter('total-supporters', totalSupporters, '');

    // Render Leaderboard (Top 5 Contributors)
    const leaderboardContainer = document.getElementById('leaderboard-row');
    if (leaderboardContainer) {
        leaderboardContainer.innerHTML = '';
        const top5 = sorted.slice(0, 5);
        
        top5.forEach((item, index) => {
            const rank = index + 1;
            const card = document.createElement('div');
            // Premium Leaderboard Card
            card.className = "glass shadow-soft p-6 rounded-2xl flex flex-col items-center justify-between text-center border border-primary/10 hover:-translate-y-2 hover:shadow-elevated transition-all duration-300 relative overflow-hidden group";
            
            // Highlight Rank 1
            let rankClass = "bg-primary/10 text-primary";
            if (rank === 1) rankClass = "bg-amber-100 text-amber-600 font-extrabold scale-110 border border-amber-300 shadow-md shadow-amber-200/50";
            else if (rank === 2) rankClass = "bg-slate-100 text-slate-600";
            else if (rank === 3) rankClass = "bg-orange-50 text-orange-600";

            card.innerHTML = `
                <div class="absolute -right-3 -top-3 w-10 h-10 bg-primary/5 rounded-full transition-transform group-hover:scale-150 duration-500"></div>
                <div class="w-10 h-10 ${rankClass} rounded-full flex items-center justify-center text-sm font-bold mb-4 z-10">
                    #${rank}
                </div>
                <h4 class="font-heading font-bold text-on-surface text-base mb-1 truncate w-full z-10">${item.name}</h4>
                <p class="text-primary font-bold font-mono text-lg mt-2 z-10">${getCurrencySymbol(item.currency || 'AUD')}${item.amount.toLocaleString()}</p>
            `;
            leaderboardContainer.appendChild(card);
        });
    }

    // Render Full Contributors Table
    const tableBody = document.getElementById('table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        sorted.forEach((item, index) => {
            const rank = index + 1;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-primary/5 transition-colors border-b border-outline-variant/20";
            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-on-surface-variant font-mono">#${rank}</td>
                <td class="px-6 py-4 font-semibold text-on-surface">${item.name}</td>
                <td class="px-6 py-4 font-bold text-primary font-mono">${getCurrencySymbol(item.currency || 'AUD')}${item.amount.toLocaleString()}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

/**
 * Animate numbers smoothly from 0 to target
 */
function animateCounter(id, target, prefix = '') {
    const el = document.getElementById(id);
    if (!el) return;

    let start = 0;
    const duration = 1500; // ms
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (outQuad)
        const ease = progress * (2 - progress);
        const currentVal = Math.floor(ease * target);
        
        el.textContent = prefix + currentVal.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            el.textContent = prefix + target.toLocaleString();
        }
    }
    requestAnimationFrame(updateCounter);
}

/**
 * Helper to determine SWIFT code and Branch based on Nepali bank platform name
 */
function getSwiftAndBranch(platform) {
    const plat = platform.toLowerCase();
    let swift = "NIBLNPKT"; // Default to NIMB
    let branch = "Kathmandu Branch";

    if (plat.includes("nimb") || plat.includes("investment") || plat.includes("mega")) {
        swift = "NIBLNPKT";
        branch = "Kathmandu Branch";
    } else if (plat.includes("nabil")) {
        swift = "NARBNPKT";
        branch = "Main Branch, Kathmandu";
    } else if (plat.includes("global") || plat.includes("gime")) {
        swift = "GBIME88";
        branch = "Panipokhari Branch, Kathmandu";
    } else if (plat.includes("siddhartha")) {
        swift = "SDBLNPKT";
        branch = "Hattisar Branch, Kathmandu";
    } else if (plat.includes("everest")) {
        swift = "EVBLNPKT";
        branch = "Lazimpat Branch, Kathmandu";
    } else if (plat.includes("himalayan")) {
        swift = "HIMANPKT";
        branch = "Kamaladi Branch, Kathmandu";
    }
    return { swift, branch };
}

/**
 * Fetches dynamic bank/wallet configurations from Google Sheets web app
 */
async function fetchDynamicPaymentDetails() {
    if (!SCRIPT_URL) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=bankDetails&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data && result.data.length > 0) {
            // Find wallet platforms (like eSewa, Khalti, IME Pay)
            const wallets = result.data.filter(item => 
                ['esewa', 'khalti', 'wallet', 'ime', 'ips', 'connect'].some(k => item.Platform.toLowerCase().includes(k))
            );

            // Find bank details
            const banks = result.data.filter(item => 
                !['esewa', 'khalti', 'wallet', 'ime', 'ips', 'connect'].some(k => item.Platform.toLowerCase().includes(k))
            );

            // If found, update our active payment details config
            if (wallets.length > 0) {
                // Find active wallet or use first
                const actW = wallets.find(w => String(w.Status || '').toLowerCase() === 'active') || wallets[0];
                const qrUrl = actW.QR_Code_URL && actW.QR_Code_URL.trim() !== "" && actW.QR_Code_URL.trim().toLowerCase() !== "none" 
                    ? actW.QR_Code_URL 
                    : defaultPaymentDetails.wallet.qrCode;

                activePaymentDetails.wallet = {
                    platform: actW.Platform,
                    accountName: actW.AccountName,
                    accountNumber: actW.AccountNumber_ID,
                    qrCode: qrUrl,
                    paymentUrl: actW.Payment_URL || ""
                };
            }

            if (banks.length > 0) {
                // Find active bank or use first
                const actB = banks.find(b => String(b.Status || '').toLowerCase() === 'active') || banks[0];
                const qrUrl = actB.QR_Code_URL && actB.QR_Code_URL.trim() !== "" && actB.QR_Code_URL.trim().toLowerCase() !== "none" 
                    ? actB.QR_Code_URL 
                    : defaultPaymentDetails.bank.qrCode;

                const bankMeta = getSwiftAndBranch(actB.Platform);
                const finalSwift = (actB.SwiftCode && actB.SwiftCode.trim() !== "") ? actB.SwiftCode.trim() : bankMeta.swift;
                const finalBranch = (actB.Branch && actB.Branch.trim() !== "") ? actB.Branch.trim() : bankMeta.branch;

                activePaymentDetails.bank = {
                    platform: actB.Platform,
                    accountName: actB.AccountName,
                    accountNumber: actB.AccountNumber_ID,
                    qrCode: qrUrl,
                    branch: finalBranch,
                    swiftCode: finalSwift,
                    paymentUrl: actB.Payment_URL || ""
                };
            }

            // Sync view with active selection
            const activeToggleBtn = document.querySelector('.payment-toggle-btn.active');
            if (activeToggleBtn) {
                const mode = activeToggleBtn.dataset.mode;
                renderPaymentMode(mode);
            }
        }
    } catch (e) {
        console.warn("Failed to fetch dynamic payment details. Using local assets fallbacks.", e);
    }
}

async function fetchDynamicContributors() {
    if (!SCRIPT_URL) return;
    try {
        // Fetch settings first to get target, race name, and description
        const settingsResponse = await fetch(`${SCRIPT_URL}?action=getSettings&_=${Date.now()}`);
        const settingsResult = await settingsResponse.json();
        if (settingsResult.status === 'success' && settingsResult.data) {
            if (settingsResult.data.fundraiser_target) {
                TARGET_AMOUNT = parseFloat(settingsResult.data.fundraiser_target) || 1000000;
            }
            if (settingsResult.data.fundraiser_race_name) {
                const raceBadge = document.getElementById('fundraiser-badge-text');
                if (raceBadge) raceBadge.textContent = settingsResult.data.fundraiser_race_name;
                const raceTitle = document.getElementById('fundraiser-race-title');
                if (raceTitle) raceTitle.textContent = settingsResult.data.fundraiser_race_name;
            }
            if (settingsResult.data.fundraiser_description) {
                const descText = document.getElementById('fundraiser-description-text');
                if (descText) descText.innerHTML = settingsResult.data.fundraiser_description;
            }
        }

        const response = await fetch(`${SCRIPT_URL}?action=getFundraisers&_=${Date.now()}`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data && result.data.length > 0) {
            // Filter and map contributors with Display === 'Yes'
            const visibleContributors = result.data
                .filter(item => item.Display === 'Yes')
                .map(item => ({
                    name: item.Name || 'Anonymous',
                    amount: parseFloat(item.Amount) || 0,
                    currency: item.Currency || 'AUD'
                }));
            
            if (visibleContributors.length > 0) {
                contributors = visibleContributors;
            } else {
                contributors = [];
            }
            initStatsAndLeaderboard();
        }
    } catch (e) {
        console.warn("Failed to fetch dynamic contributors. Using local static fallback list.", e);
    }
}

/**
 * Configures the Wallet / Bank selection toggle
 */
function initPaymentToggle() {
    const walletBtn = document.getElementById('wallet-btn');
    const bankBtn = document.getElementById('bank-btn');

    if (walletBtn && bankBtn) {
        walletBtn.addEventListener('click', () => {
            switchPaymentMode('wallet', walletBtn, bankBtn);
        });

        bankBtn.addEventListener('click', () => {
            switchPaymentMode('bank', bankBtn, walletBtn);
        });

        // Initialize with wallet mode
        renderPaymentMode('wallet');
    }
}

function switchPaymentMode(mode, activeBtn, inactiveBtn) {
    if (activeBtn.classList.contains('active')) return;

    // Transition Button Styles
    inactiveBtn.classList.remove('active', 'bg-primary', 'text-white');
    inactiveBtn.classList.add('bg-white/40', 'text-on-surface-variant', 'border-transparent');
    
    activeBtn.classList.add('active', 'bg-primary', 'text-white');
    activeBtn.classList.remove('bg-white/40', 'text-on-surface-variant', 'border-transparent');

    // QR Area Container Transition (Animate Out, Update, Animate In)
    const qrContainer = document.getElementById('qr-container');
    if (qrContainer) {
        qrContainer.classList.remove('animate-fade-in');
        qrContainer.classList.add('opacity-0', 'scale-95');
        
        setTimeout(() => {
            renderPaymentMode(mode);
            qrContainer.classList.remove('opacity-0', 'scale-95');
            qrContainer.classList.add('animate-fade-in');
        }, 200);
    } else {
        renderPaymentMode(mode);
    }
}

/**
 * Update DOM elements for the selected payment mode
 */
function renderPaymentMode(mode) {
    const qrImg = document.getElementById('qr-code-img');
    const detailsContainer = document.getElementById('payment-details-fields');
    
    if (!detailsContainer) return;

    const data = activePaymentDetails[mode];
    
    if (qrImg) {
        qrImg.src = data.qrCode;
    }

    if (mode === 'wallet') {
        detailsContainer.innerHTML = `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20">
                    <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Wallet Provider</span>
                    <span class="font-heading font-bold text-on-surface mt-1 sm:mt-0">${data.platform}</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20">
                    <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Receiver Name</span>
                    <span class="font-heading font-bold text-on-surface mt-1 sm:mt-0">${data.accountName}</span>
                </div>
                <div class="flex items-center justify-between pb-1">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Wallet ID / Phone</span>
                        <span id="copy-target" class="font-mono font-bold text-primary text-base mt-1 tracking-wider">${data.accountNumber}</span>
                    </div>
                    <button onclick="copyAccountToClipboard()" class="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold font-heading transition-colors duration-200" title="Copy Wallet ID">
                        <span class="material-symbols-outlined text-xs">content_copy</span>
                        Copy
                    </button>
                </div>
            </div>
        `;
    } else {
        detailsContainer.innerHTML = `
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20">
                    <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Bank Name</span>
                    <span class="font-heading font-bold text-on-surface text-right mt-1 sm:mt-0">${data.platform}</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20">
                    <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Account Name</span>
                    <span class="font-heading font-bold text-on-surface text-right mt-1 sm:mt-0">${data.accountName}</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20">
                    <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Branch</span>
                    <span class="font-heading font-bold text-on-surface text-right mt-1 sm:mt-0">${data.branch || 'Kathmandu'}</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20">
                    <span class="text-xs font-bold uppercase tracking-wider text-text-muted">SWIFT Code</span>
                    <span class="font-mono font-bold text-on-surface mt-1 sm:mt-0">${data.swiftCode || 'NIBLNPKT'}</span>
                </div>
                <div class="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold uppercase tracking-wider text-text-muted">Account Number</span>
                        <span id="copy-target" class="font-mono font-bold text-primary text-base mt-1 tracking-widest">${data.accountNumber}</span>
                    </div>
                    <button onclick="copyAccountToClipboard()" class="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold font-heading transition-colors duration-200" title="Copy Account Number">
                        <span class="material-symbols-outlined text-xs">content_copy</span>
                        Copy
                    </button>
                </div>
                <div class="text-center pt-1">
                    <p class="text-[11px] text-on-surface-variant font-medium italic flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-xs text-primary">info</span>
                        You can easily transfer funds internationally using SWIFT.
                    </p>
                </div>
            </div>
        `;
    }

    // Inject direct payout portal button if configured in the Google Sheet
    if (data.paymentUrl && data.paymentUrl.trim() !== "") {
        detailsContainer.innerHTML += `
            <div class="mt-4 pt-3 border-t border-outline-variant/20">
                <a href="${data.paymentUrl}" target="_blank" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl text-sm font-bold font-heading transition-all shadow-md shadow-primary/20 hover:scale-[1.01]">
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                    Pay via ${data.platform} Portal
                </a>
            </div>
        `;
    }
}

/**
 * Handle account number copy
 */
window.copyAccountToClipboard = function() {
    const copyTarget = document.getElementById('copy-target');
    if (!copyTarget) return;
    
    const text = copyTarget.textContent.replace(/\s+/g, ''); // strip spacing
    
    navigator.clipboard.writeText(text).then(() => {
        // Show temporary toast or feedback
        showNotificationToast("Copied to clipboard!");
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
};

/**
 * Display a premium small notification toast
 */
function showNotificationToast(msg) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'fixed bottom-8 right-8 z-[2000] bg-on-surface text-surface px-6 py-3 rounded-xl shadow-2xl font-heading font-bold text-sm transform translate-y-12 opacity-0 transition-all duration-300 flex items-center gap-2';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<span class="material-symbols-outlined text-primary-container text-base">check_circle</span> ${msg}`;
    
    // Trigger entrance animation
    setTimeout(() => {
        toast.classList.remove('translate-y-12', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    // Trigger exit animation
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-12', 'opacity-0');
    }, 3000);
}

/**
 * Configures the Social Share buttons
 */
function initSocialSharing() {
    const shareTitle = "Support Nirmal Lamsal's Sydney Marathon Dream!";
    const shareText = "Help power the Sydney Marathon journey for Nepal's elite runner Nirmal Lamsal. Check out the fundraiser page and join the quest!";
    const shareUrl = window.location.href;

    const platforms = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
        instagram: `instagram` // Needs fallback guide
    };

    // Desktop opens new windows
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const platform = btn.dataset.platform;

            if (platform === 'native') {
                triggerNativeShare(shareTitle, shareText, shareUrl);
            } else if (platform === 'icloud') {
                // Copy Link with a nice success toast (mimics iOS iCloud sharing actions)
                navigator.clipboard.writeText(shareUrl).then(() => {
                    showNotificationToast("Share Link copied to iCloud clipboard!");
                });
            } else if (platform === 'instagram') {
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert("Link copied! Since Instagram doesn't support direct links sharing in grid posts, you can add this link to your Instagram Story or Bio. Opening Instagram now...");
                    window.open('https://instagram.com', '_blank');
                });
            } else if (platforms[platform]) {
                window.open(platforms[platform], '_blank', 'width=600,height=450,location=yes,toolbar=no,menubar=no');
            }
        });
    });
}

function triggerNativeShare(title, text, url) {
    if (navigator.share) {
        navigator.share({
            title: title,
            text: text,
            url: url
        }).then(() => {
            showNotificationToast("Thanks for sharing!");
        }).catch(err => {
            if (err.name !== 'AbortError') {
                console.warn('Native share failed:', err);
                fallbackCopyToClipboard(url);
            }
        });
    } else {
        fallbackCopyToClipboard(url);
    }
}

function fallbackCopyToClipboard(url) {
    navigator.clipboard.writeText(url).then(() => {
        showNotificationToast("Share link copied to clipboard!");
    });
}
