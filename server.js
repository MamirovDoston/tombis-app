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
    console.log('[PUPPETEER] Launching browser in headless mode...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('[PUPPETEER] Browser launched successfully');

    const page = await browser.newPage();
    console.log('[PUPPETEER] New page created');
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1280, height: 800 });
    console.log('[PUPPETEER] Viewport set to 1280x800');

    // Navigate to TÖMBİS login page - Sakarya University
    console.log('[NAVIGATE] Going to Sakarya University TÖMBİS login page...');
    await page.goto('https://tombis.sakarya.edu.tr/Identity/Account/Login', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    console.log(`[NAVIGATE] Login page loaded. Current URL: ${page.url()}`);

    // Fill in login credentials
    console.log('[LOGIN] Entering username...');
    await page.type('input[name="username"], #username, input[type="text"]', username, { delay: 50 });
    console.log('[LOGIN] Entering password...');
    await page.type('input[name="password"], #password, input[type="password"]', password, { delay: 50 });
    console.log('[LOGIN] Credentials entered, clicking login button...');

    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('button[type="submit"], input[type="submit"], .login-btn')
    ]);
    console.log(`[LOGIN] Navigation complete. Current URL: ${page.url()}`);

    // Check if login was successful (check for error message or redirect)
    console.log('[LOGIN] Checking for login errors...');
    const errorMessage = await page.$eval('.error-message, .alert-danger', el => el.textContent).catch(() => null);
    if (errorMessage) {
      console.log(`[LOGIN ERROR] Login failed: ${errorMessage}`);
      await browser.close();
      console.log('[PUPPETEER] Browser closed');
      return res.status(401).json({ error: 'Invalid credentials', message: errorMessage });
    }
    console.log('[LOGIN] Login successful!');

    // Scrape Profile Info
    console.log('[SCRAPE] Scraping profile information...');
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
    console.log(`[SCRAPE] Profile scraped: ${JSON.stringify(profileData)}`);

    // Navigate to Schedule page - Sakarya University (hardcoded class ID 1781)
    console.log('[NAVIGATE] Going to schedule page...');
    await page.goto('https://tombis.sakarya.edu.tr/Class/Home/1781', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log(`[NAVIGATE] Schedule page loaded. URL: ${page.url()}`);
    
    // Scrape Schedule
    console.log('[SCRAPE] Scraping schedule data...');
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
    console.log(`[SCRAPE] Found ${scheduleData.length} schedule items`);

    // Navigate to Attendance page - Sakarya University (hardcoded class ID 1781)
    console.log('[NAVIGATE] Going to attendance page...');
    await page.goto('https://tombis.sakarya.edu.tr/Class/Attendance/Student/1781', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log(`[NAVIGATE] Attendance page loaded. URL: ${page.url()}`);
    
    // Scrape Attendance
    console.log('[SCRAPE] Scraping attendance data...');
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
    console.log(`[SCRAPE] Found ${attendanceData.length} attendance items`);

    // Navigate to Payments page - Sakarya University
    console.log('[NAVIGATE] Going to payments page...');
    await page.goto('https://tombis.sakarya.edu.tr/Payment/Index', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log(`[NAVIGATE] Payments page loaded. URL: ${page.url()}`);
    
    // Scrape Payments
    console.log('[SCRAPE] Scraping payments data...');
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
    console.log(`[SCRAPE] Found ${paymentsData.length} payment items`);

    // Return all scraped data
    const result = {
      success: true,
      profile: profileData,
      schedule: scheduleData,
      attendance: attendanceData,
      payments: paymentsData,
      timestamp: new Date().toISOString()
    };

    console.log('[SUCCESS] All data scraped successfully!');
    console.log(`[SUMMARY] Profile: ${profileData.name || 'N/A'}, Schedule: ${scheduleData.length} items, Attendance: ${attendanceData.length} items, Payments: ${paymentsData.length} items`);

    await browser.close();
    console.log('[PUPPETEER] Browser closed, sending response');
    
    res.json(result);

  } catch (error) {
    if (browser) {
      await browser.close();
      console.log('[PUPPETEER] Browser closed due to error');
    }
    
    console.error('[ERROR] Scraping failed:', error.message);
    console.error('[ERROR] Stack trace:', error.stack);
    
    // Return actual error - NO MOCK DATA FALLBACK
    res.status(500).json({
      error: 'Failed to scrape data from TÖMBİS',
      message: error.message,
      details: 'The scraping process encountered an error. Please check: 1) Your credentials are correct, 2) The TÖMBİS portal is accessible, 3) The portal structure matches expected selectors.',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`TÖMBİS Backend server running on http://localhost:${PORT}`);
});
