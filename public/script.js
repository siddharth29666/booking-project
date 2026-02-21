document.addEventListener('DOMContentLoaded', () => {
    // Set minimum date to today
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    const bookingForm = document.getElementById('bookingForm');
    const messageDiv = document.getElementById('bookingMessage');

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Show loading state (optional: disable button)
        const submitBtn = bookingForm.querySelector('.submit-btn');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Booking...';
        submitBtn.disabled = true;

        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            service: document.getElementById('service').value,
            date: document.getElementById('date').value,
            time: document.getElementById('time').value
        };

        try {
            const response = await fetch('/api/book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                // Success
                messageDiv.className = 'success-msg show';
                messageDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i> <div>Your appointment has been successfully booked.</div>';
                bookingForm.reset();
            } else {
                // Error
                throw new Error(result.message || 'Something went wrong.');
            }

        } catch (error) {
            console.error('Booking Error:', error);
            messageDiv.className = 'error-msg show';
            messageDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <div>${error.message || 'Failed to book appointment. Please try again.'}</div>`;
        } finally {
            // Reset button
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
            
            // Auto hide message after 5 seconds
            setTimeout(() => {
                messageDiv.classList.remove('show');
            }, 5000);
        }
    });

    // Smooth scroll for nav links (optional, modern browsers handle this with scroll-behavior: smooth in CSS)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});
