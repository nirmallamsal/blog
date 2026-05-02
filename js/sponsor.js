const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxE7Mvk2bFUaL_BCvwhjTsB2FMyxLl-sQGn59cw4c4GRURlD3O6mtQccyEz7hIAGCxTTQ/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    const questForm = document.getElementById('quest-contact-form');
    
    if (questForm) {
        questForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = questForm.querySelector('button');
            const originalText = btn.textContent;
            
            // Get form data
            const name = document.getElementById('q-name').value;
            const company = document.getElementById('q-company').value;
            const email = document.getElementById('q-email').value;
            const interest = document.getElementById('q-interest').value;
            const message = document.getElementById('q-message').value;

            btn.textContent = 'Sending...';
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
                    // Show success state
                    questForm.innerHTML = `
                        <div style="text-align: center; padding: 2rem; animation: fadeIn 0.5s ease;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">🚀</div>
                            <h3 style="margin-bottom: 1rem;">Proposal Request Sent!</h3>
                            <p>Thank you, ${name}. I am excited about the possibility of partnering with ${company || 'you'}. My team will review your request and get back to you shortly.</p>
                            <button onclick="location.reload()" class="btn btn-outline" style="margin-top: 2rem;">Send Another Request</button>
                        </div>
                    `;
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('Sponsorship Submission error:', error);
                btn.textContent = 'Error! Try Again';
                btn.disabled = false;
                setTimeout(() => btn.textContent = originalText, 3000);
            }
        });
    }
});
