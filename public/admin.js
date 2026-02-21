document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('adminDate');
    const appointmentsList = document.getElementById('appointmentsList');

    // Default to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    
    // Initial fetch
    fetchAppointments(today);

    dateInput.addEventListener('change', (e) => {
        fetchAppointments(e.target.value);
    });

    async function fetchAppointments(date) {
        appointmentsList.innerHTML = '<div class="empty-state">Loading...</div>';

        try {
            const response = await fetch(`/api/appointments?date=${date}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch appointments');
            }

            const appointments = await response.json();
            renderAppointments(appointments);

        } catch (error) {
            console.error('Error:', error);
            appointmentsList.innerHTML = `<div class="empty-state" style="color: red;">Error: ${error.message}</div>`;
        }
    }

    function renderAppointments(appointments) {
        if (appointments.length === 0) {
            appointmentsList.innerHTML = '<div class="empty-state">No appointments found for this date.</div>';
            return;
        }

        let html = `
            <table class="appointments-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Details</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        appointments.forEach(app => {
            // Extract details from description if possible
            // We saved it as "Phone: ...\nService: ..."
            const phoneMatch = app.description ? app.description.match(/Phone: (.*)/) : null;
            const phone = phoneMatch ? phoneMatch[1] : 'N/A';
            
            // Format time
            const startTime = new Date(app.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Extract Name from Summary "Booking: Name - Service"
            // Or just display the whole summary
            const summaryDisplay = app.summary.replace('Booking: ', '');

            html += `
                <tr>
                    <td><strong>${startTime}</strong></td>
                    <td>${summaryDisplay.split(' - ')[0]}</td>
                    <td>${summaryDisplay.split(' - ')[1] || 'N/A'}</td>
                    <td>${phone}</td>
                    <td>
                        <button onclick="deleteAppointment('${app.id}')" class="delete-btn">Cancel</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        appointmentsList.innerHTML = html;
    }

    // Expose delete function to window so onclick works
    window.deleteAppointment = async (id) => {
        if (!confirm('Are you sure you want to cancel this appointment? This will remove it from Google Calendar.')) {
            return;
        }

        try {
            const response = await fetch(`/api/appointments/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                // Refresh list
                const date = document.getElementById('adminDate').value;
                fetchAppointments(date);
            } else {
                alert('Failed to delete appointment.');
            }
        } catch (error) {
            console.error('Delete Error:', error);
            alert('Error deleting appointment.');
        }
    };
});
