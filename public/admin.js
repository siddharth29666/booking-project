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
            <div class="table-responsive">
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

        html += `</tbody></table></div>`;
        appointmentsList.innerHTML = html;
    }

    // Expose delete function to window so onclick works
    window.deleteAppointment = async (id) => {
        const result = await Swal.fire({
            title: 'Cancel Appointment?',
            text: "This will permanently remove it from Google Calendar. You cannot undo this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#b76e79', // Theme rose-gold
            confirmButtonText: 'Yes, cancel it!',
            cancelButtonText: 'Keep it'
        });

        if (result.isConfirmed) {
            try {
                // Show loading state
                Swal.fire({
                    title: 'Canceling...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const response = await fetch(`/api/appointments/${id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    Swal.fire({
                        title: 'Canceled!',
                        text: 'The appointment has been removed.',
                        icon: 'success',
                        confirmButtonColor: '#b76e79'
                    });
                    // Refresh list
                    const date = document.getElementById('adminDate').value;
                    fetchAppointments(date);
                } else {
                    Swal.fire('Error', 'Failed to delete appointment.', 'error');
                }
            } catch (error) {
                console.error('Delete Error:', error);
                Swal.fire('Error', 'Error deleting appointment.', 'error');
            }
        }
    };
});
