require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve Admin Dashboard at /admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Google Calendar Configuration
// NOTE: This usually requires a service account key file (e.g., credentials.json)
// For this environment, we will look for KEY_FILE_PATH in env or default to 'credentials.json'
const KEY_FILE_PATH = process.env.KEY_FILE_PATH || 'credentials.json';
const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Email Configuration (Nodemailer)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or use SMTP host/port from env
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // App Password for Gmail
    }
});

// Helper: Add Event to Google Calendar
async function addCalendarEvent(bookingData) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // Calculate start and end time (assuming 1 hour duration)
        // Format: YYYY-MM-DDTHH:mm:ss
        // Input time is like "11:00 AM". Need to convert to 24h format for ISO string
        
        const [timePart, modifier] = bookingData.time.split(' ');
        let [hours, minutes] = timePart.split(':');
        
        if (hours === '12') {
            hours = '00';
        }
        if (modifier === 'PM') {
            hours = parseInt(hours, 10) + 12;
        }

        const startDate = new Date(`${bookingData.date}T${hours}:${minutes}:00`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

        const event = {
            summary: `Booking: ${bookingData.name} - ${bookingData.service}`,
            description: `Phone: ${bookingData.phone}\nService: ${bookingData.service}`,
            start: {
                dateTime: startDate.toISOString(),
                timeZone: 'Asia/Kolkata', // Set appropriate timezone
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
        };

        const res = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: event,
        });

        return res.data;

    } catch (error) {
        console.error('Error adding to calendar:', error);
        // If credentials depend on user setup that isn't done, we might want to return null but not crash.
        // For development purpose, we'll assume it failed and log why.
        throw error;
    }
}

// Helper: Send Email Notification
async function sendEmailNotification(bookingData) {
    if (!process.env.EMAIL_USER) {
        console.log("Email user not configured, skipping email.");
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.OWNER_EMAIL || process.env.EMAIL_USER, // Send to owner
        subject: `New Booking: ${bookingData.name}`,
        text: `New appointment booked!\n\nName: ${bookingData.name}\nPhone: ${bookingData.phone}\nService: ${bookingData.service}\nDate: ${bookingData.date}\nTime: ${bookingData.time}`
    };

    await transporter.sendMail(mailOptions);
}

// Helper: List Events from Google Calendar
async function listCalendarEvents(date) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // Create timeMin and timeMax for the entire day (Local Time -> UTC)
        // Note: For simplicity, we will just query for the whole day in the user's timezone if possible
        // But Google Calendar API expects ISO strings. 
        // Let's assume the 'date' param is 'YYYY-MM-DD'
        
        const timeMin = new Date(`${date}T00:00:00`).toISOString();
        const timeMax = new Date(`${date}T23:59:59`).toISOString();

        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return res.data.items;

    } catch (error) {
        console.error('Error listing calendar events:', error);
        throw error;
    }
}

// Helper: Delete Event from Google Calendar
async function deleteCalendarEvent(eventId) {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: KEY_FILE_PATH,
            scopes: SCOPES,
        });

        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
            calendarId: CALENDAR_ID,
            eventId: eventId,
        });

        return { success: true };

    } catch (error) {
        console.error('Error deleting calendar event:', error);
        throw error;
    }
}

// API Routes
app.delete('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Event ID is required.' });
    }

    try {
        await deleteCalendarEvent(id);
        res.status(200).json({ message: 'Appointment deleted successfully.' });
    } catch (error) {
        console.error("Delete Error:", error.message);
        res.status(500).json({ message: 'Failed to delete appointment.' });
    }
});
app.get('/api/appointments', async (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required (YYYY-MM-DD).' });
    }

    try {
        const events = await listCalendarEvents(date);
        
        // Map events to a cleaner format
        const appointments = events.map(event => ({
            id: event.id,
            summary: event.summary, // Contains "Booking: Name - Service"
            description: event.description, // Contains Phone, Service
            startTime: event.start.dateTime || event.start.date,
            endTime: event.end.dateTime || event.end.date,
        }));

        res.json(appointments);

    } catch (error) {
        console.error("Fetch Appointments Error:", error.message);
        res.status(500).json({ message: 'Failed to fetch appointments.' });
    }
});

// app.post('/api/book', async (req, res) => {
//     const { name, phone, service, date, time } = req.body;

//     // Phone is now optional
//     if (!name || !service || !date || !time) {
//         return res.status(400).json({ message: 'Name, service, date, and time are required.' });
//     }

//     // Set default value if phone is empty
//     req.body.phone = phone || "Not provided";

//     try {
//         console.log("Received booking:", req.body);

//         // Format requested start and end times to check overlap
//         const [timePart, modifier] = time.split(' ');
//         let [hours, minutes] = timePart.split(':');
        
//         if (hours === '12') hours = '00';
//         if (modifier === 'PM') hours = parseInt(hours, 10) + 12;

//         const requestStartDate = new Date(`${date}T${hours}:${minutes}:00`);
//         const requestEndDate = new Date(requestStartDate.getTime() + 60 * 60 * 1000);

//         // Check for double bookings via Google Calendar
//         try {
//             const existingEvents = await listCalendarEvents(date);
//             const isOverlap = existingEvents.some(event => {
//                 const eventStart = new Date(event.start.dateTime || event.start.date);
//                 const eventEnd = new Date(event.end.dateTime || event.end.date);
//                 return requestStartDate < eventEnd && requestEndDate > eventStart;
//             });

//             if (isOverlap) {
//                 return res.status(400).json({ message: 'Sorry, this time slot is already booked.' });
//             }
//         } catch (calCheckError) {
//              console.warn("Could not fetch calendar to check overlaps:", calCheckError.message);
//         }

//         // 1. Add to Google Calendar
//         // NOTE: If credentials are missing, this might fail. We will wrap it.
//         try {
//            await addCalendarEvent(req.body);
//            console.log("Successfully added to Google Calendar");
//         } catch (calError) {
//             console.error("Calendar integration failed:", calError);
//             console.error("PROBABLE CAUSE: Service Account email not shared with Calendar ID, or wrong Calendar ID.");
//         }

//         // 2. Send Email
//         try {
//             await sendEmailNotification(req.body);
//             console.log("Email sent successfully");
//         } catch (emailError) {
//              console.warn("Email sending failed:", emailError.message);
//         }

//         res.status(200).json({ message: 'Booking successful!' });

//     } catch (error) {
//         console.error("Booking Error:", error);
//         res.status(500).json({ message: 'Internal Server Error' });
//     }
// });
app.post('/api/book', async (req, res) => {
  const { name, phone, service, date, time } = req.body;

  if (!name || !service || !date || !time) {
    return res.status(400).json({ message: 'Name, service, date, and time are required.' });
  }

  try {
    console.log("Received booking:", req.body);

    // Convert time to 24h
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':');

    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours) + 12;

    const startDate = new Date(`${date}T${hours}:${minutes}:00`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    // ✅ Check double booking
    const existingEvents = await listCalendarEvents(date);

    const isOverlap = existingEvents.some(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);
      return startDate < eventEnd && endDate > eventStart;
    });

    if (isOverlap) {
      return res.status(400).json({ message: 'Sorry, this time slot is already booked.' });
    }

    // ✅ Add to Google Calendar (MUST succeed)
    await addCalendarEvent(req.body);
    console.log("Added to Google Calendar");

    // ✅ Send Email (MUST succeed)
    await sendEmailNotification(req.body);
    console.log("Email sent");

    return res.json({ message: "Booking successful!" });

  } catch (error) {
    console.error("BOOKING FAILED:", error);
    return res.status(500).json({
      message: "Booking failed",
      error: error.message
    });
  }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
