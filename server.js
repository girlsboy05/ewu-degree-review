const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const { logSearch } = require('./lib/searchLogger');

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory debounce for logging (prevents duplicate log entries within 2s for same ID)
const __recentLogs = new Map();
function shouldLogOnce(id) {
    const now = Date.now();
    const last = __recentLogs.get(id) || 0;
    __recentLogs.set(id, now);
    return (now - last) > 2000;
}

// Blocked IDs
const BLOCKED_IDS = ['2022-3-60-034', '2022-3-60-051', '2022-3-60-058', '2022-3-60-061'];

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const searchLogsRoutes = require('./routes/searchLogs');
app.use(searchLogsRoutes);

// Function to parse cookies
const parseCookies = (cookieHeaders) => {
    if (!cookieHeaders) return null;
    return cookieHeaders.map(cookie => cookie.split(';')[0].trim()).join('; ');
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { 
        studentInfo: null,
        degreeCourses: null,
        error: null,
        cookies: null,
        showModal: false
    });
});

app.post('/get-student-info', async (req, res) => {
    const studentId = (req.body && (req.body.studentId || req.body.id)) || '';
    try { if (studentId && shouldLogOnce(studentId)) { logSearch({ searchedId: studentId }); } } catch (e) { /* ignore logging errors */ }

    // Check for blocked IDs
    if (BLOCKED_IDS.includes(studentId)) {
        return res.render('index', {
            studentInfo: null,
            degreeCourses: null,
            cookies: null,
            error: 'Unexpected error from EWU Server',
            showModal: false
        });
    }

    try {
        // First request to get cookies (using fixed ID)
        const form = new FormData();
        form.append('Username', '2022-3-60-061');
        form.append('Password', '@Alhamdulillah');
        form.append('Answer', '20');
        form.append('FirstNo', '6');
        form.append('SecondNo', '14');

        const loginResponse = await axios.post('https://portal.ewubd.edu/', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        const cookies = parseCookies(loginResponse.headers['set-cookie']);

        if (!cookies) {
            throw new Error('No cookies received from login');
        }

        // Make both API requests in parallel
        const [studentInfoResponse, degreeCoursesResponse] = await Promise.all([
            axios.get(
                `https://portal.ewubd.edu/api/StudentProfile/GetStudentInfoDegreeAnalysis?id=${studentId}`,
                {
                    headers: {
                        'Cookie': cookies,
                        'Referer': 'https://portal.ewubd.edu/Home/StudentDegreeReview',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                }
            ),
            axios.get(
                `https://portal.ewubd.edu/api/DegreeReview/GetDegreeReviewCourseAreaCourses?studentId=${studentId}`,
                {
                    headers: {
                        'Cookie': cookies,
                        'Referer': 'https://portal.ewubd.edu/Home/StudentDegreeReview',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                }
            )
        ]);

        res.render('index', {
            studentInfo: studentInfoResponse.data,
            degreeCourses: degreeCoursesResponse.data,
            cookies: cookies,
            error: null,
            showModal: false
        });

    } catch (error) {
        console.error('Error:', error);
        res.render('index', {
            studentInfo: null,
            degreeCourses: null,
            cookies: null,
            error: error.message,
            showModal: false
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});