const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxE7Mvk2bFUaL_BCvwhjTsB2FMyxLl-sQGn59cw4c4GRURlD3O6mtQccyEz7hIAGCxTTQ/exec'; 

document.addEventListener('DOMContentLoaded', () => {
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
