import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/scrape-tombis', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to TÖMBİS login page (placeholder URL - update with actual URL)
    await page.goto('https://tombis.example.edu/login', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Fill in login credentials
    await page.type('input[name="username"], #username, input[type="text"]', username, { delay: 50 });
    await page.type('input[name="password"], #password, input[type="password"]', password, { delay: 50 });

    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('button[type="submit"], input[type="submit"], .login-btn')
    ]);

    // Check if login was successful (check for error message or redirect)
    const errorMessage = await page.$eval('.error-message, .alert-danger', el => el.textContent).catch(() => null);
    if (errorMessage) {
      await browser.close();
      return res.status(401).json({ error: 'Invalid credentials', message: errorMessage });
    }

    // Scrape Profile Info
    const profileData = await page.evaluate(() => {
      // Common selectors for student profile information
      const name = document.querySelector('.student-name, .user-name, h1.profile-name, .fullname')?.textContent?.trim() || '';
      const studentId = document.querySelector('.student-id, .user-id, .student-number')?.textContent?.trim() || '';
      const faculty = document.querySelector('.faculty-name, .department')?.textContent?.trim() || '';
      const program = document.querySelector('.program-name, .major')?.textContent?.trim() || '';
      const email = document.querySelector('.email, .user-email')?.textContent?.trim() || '';
      const phone = document.querySelector('.phone, .mobile')?.textContent?.trim() || '';
      
      return { name, studentId, faculty, program, email, phone };
    });

    // Navigate to Schedule page
    await page.goto('https://tombis.example.edu/schedule', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Scrape Schedule
    const scheduleData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.schedule-table tr, .schedule-row, .lesson-row');
      const schedule = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, .schedule-cell');
        if (cells.length >= 4) {
          schedule.push({
            day: cells[0]?.textContent?.trim() || '',
            time: cells[1]?.textContent?.trim() || '',
            course: cells[2]?.textContent?.trim() || '',
            room: cells[3]?.textContent?.trim() || '',
            instructor: cells[4]?.textContent?.trim() || ''
          });
        }
      });
      return schedule;
    });

    // Navigate to Attendance page
    await page.goto('https://tombis.example.edu/attendance', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Scrape Attendance
    const attendanceData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.attendance-table tr, .attendance-row');
      const attendance = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, .attendance-cell');
        if (cells.length >= 3) {
          attendance.push({
            course: cells[0]?.textContent?.trim() || '',
            totalHours: cells[1]?.textContent?.trim() || '',
            attended: cells[2]?.textContent?.trim() || '',
            absent: cells[3]?.textContent?.trim() || '',
            percentage: cells[4]?.textContent?.trim() || ''
          });
        }
      });
      return attendance;
    });

    // Navigate to Payments page
    await page.goto('https://tombis.example.edu/payments', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Scrape Payments
    const paymentsData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.payment-table tr, .payment-row');
      const payments = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, .payment-cell');
        if (cells.length >= 3) {
          payments.push({
            semester: cells[0]?.textContent?.trim() || '',
            description: cells[1]?.textContent?.trim() || '',
            amount: cells[2]?.textContent?.trim() || '',
            status: cells[3]?.textContent?.trim() || '',
            dueDate: cells[4]?.textContent?.trim() || ''
          });
        }
      });
      return payments;
    });

    // Return all scraped data
    const result = {
      success: true,
      profile: profileData,
      schedule: scheduleData,
      attendance: attendanceData,
      payments: paymentsData,
      timestamp: new Date().toISOString()
    };

    await browser.close();
    res.json(result);

  } catch (error) {
    if (browser) await browser.close();
    console.error('Scraping error:', error);
    
    // Return demo data for development/testing when scraping fails
    // REMOVE THIS IN PRODUCTION
    const demoData = {
      success: true,
      demo: true,
      profile: {
        name: 'Ahmet Yılmaz',
        studentId: '202301001',
        faculty: 'Faculty of Engineering',
        program: 'Computer Science',
        email: 'ahmet.yilmaz@university.edu',
        phone: '+90 555 123 4567'
      },
      schedule: [
        { day: 'Monday', time: '09:00 - 11:00', course: 'Data Structures', room: 'Lab 101', instructor: 'Dr. Smith' },
        { day: 'Monday', time: '13:00 - 15:00', course: 'Algorithms', room: 'Room 302', instructor: 'Prof. Johnson' },
        { day: 'Tuesday', time: '10:00 - 12:00', course: 'Database Systems', room: 'Lab 205', instructor: 'Dr. Brown' },
        { day: 'Wednesday', time: '09:00 - 11:00', course: 'Web Development', room: 'Lab 103', instructor: 'Prof. Davis' },
        { day: 'Thursday', time: '14:00 - 16:00', course: 'Machine Learning', room: 'Room 401', instructor: 'Dr. Wilson' }
      ],
      attendance: [
        { course: 'Data Structures', totalHours: '48', attended: '45', absent: '3', percentage: '93.75%' },
        { course: 'Algorithms', totalHours: '48', attended: '42', absent: '6', percentage: '87.50%' },
        { course: 'Database Systems', totalHours: '48', attended: '46', absent: '2', percentage: '95.83%' },
        { course: 'Web Development', totalHours: '48', attended: '44', absent: '4', percentage: '91.67%' },
        { course: 'Machine Learning', totalHours: '48', attended: '40', absent: '8', percentage: '83.33%' }
      ],
      payments: [
        { semester: 'Fall 2024', description: 'Tuition Fee', amount: '15,000 TL', status: 'Paid', dueDate: '2024-10-01' },
        { semester: 'Fall 2024', description: 'Library Fee', amount: '200 TL', status: 'Paid', dueDate: '2024-10-01' },
        { semester: 'Spring 2025', description: 'Tuition Fee', amount: '15,000 TL', status: 'Pending', dueDate: '2025-02-01' }
      ],
      timestamp: new Date().toISOString()
    };
    
    res.json(demoData);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`TÖMBİS Backend server running on http://localhost:${PORT}`);
});
