// Initialize Supabase
const supabaseUrl = 'https://amsrxpzwgjleqebacgpl.supabase.co'; //
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtc3J4cHp3Z2psZXFlYmFjZ3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3NDQ1MDcsImV4cCI6MjA2NzMyMDUwN30.rka0TwVVu2virQPNThD5q4uBxVwQjjBUp5Odzag2JYc'; //
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

/* ---------- Application State ---------- */
let appState = {
    isLoggedIn: false,
    ahtRecords: [], // Array of { id, date, total_calls, total_talk_time_seconds, total_talk_time, aht }
    user: null
};

/* ---------- DOM Elements (MODIFIED) ---------- */
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const demoLoginForm = document.getElementById('demo-login-form'); // reused for email/password form
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const ahtNavBtn = document.getElementById('aht-nav-btn');
const themeToggle = document.getElementById('theme-toggle');
const dataInput = document.getElementById('data-input');
const saveDataBtn = document.getElementById('save-data-btn');
const backBtn = document.getElementById('back-btn');
const todayAhtDisplay = document.getElementById('today-aht');
const overallAhtDisplay = document.getElementById('overall-aht');
const recordsList = document.getElementById('records-list');
const deleteDatePicker = document.getElementById('delete-date-picker');
const deleteSingleBtn = document.getElementById('delete-single-btn');
const deleteTillBtn = document.getElementById('delete-till-btn');

// ADDED THESE
const overallTotalCallsDisplay = document.getElementById('overall-total-calls');
const overallTotalTalkTimeDisplay = document.getElementById('overall-total-talk-time');
// ADDED NEW CARD DISPLAY
const avgCallsDisplay = document.getElementById('avg-calls');


/* ---------- Initialization ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    attachAuthListener();
    checkAuthOnLoad();
    updateUI();
});

/* ---------- AUTH: helper to attach auth state change listener ---------- */
function attachAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
            appState.isLoggedIn = true;
            appState.user = session.user;
            loadRecordsFromSupabase();
        } else {
            appState.isLoggedIn = false;
            appState.user = null;
            appState.ahtRecords = [];
        }
        updateUI();
    });
}

/* ---------- Check current session (on page load) ---------- */
async function checkAuthOnLoad() {
    try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session && data.session.user) {
            appState.isLoggedIn = true;
            appState.user = data.session.user;
            await loadRecordsFromSupabase();
        } else {
            appState.isLoggedIn = false;
            appState.user = null;
        }
    } catch (err) {
        console.error('Auth check error', err);
        showToast('Unable to verify authentication', 'error');
    }
    updateUI();
}

/* ---------- LOGIN (Email + Password) ---------- */
demoLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showToast('Please provide email and password', 'error');
        return;
    }

    try {
        showToast('Signing in...', 'info');
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error(error);
            showToast(error.message || 'Login failed', 'error');
            return;
        }

        if (data && data.user) {
            appState.isLoggedIn = true;
            appState.user = data.user;
            showToast('Login successful 🎉', 'success');
            await loadRecordsFromSupabase();
            updateUI();
        } else {
            showToast('Login pending (check email for confirmation)', 'info');
        }
    } catch (err) {
        console.error('Login error', err);
        showToast('Login error — check console', 'error');
    }
});

/* ---------- LOGOUT ---------- */
logoutBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout?')) return;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error(error);
            showToast('Logout failed', 'error');
            return;
        }
        appState.isLoggedIn = false;
        appState.user = null;
        appState.ahtRecords = [];
        updateUI();
        showToast('Logged out successfully 👋', 'info');
    } catch (err) {
        console.error('Logout error', err);
        showToast('Logout error', 'error');
    }
});

/* ---------- UI Update (MODIFIED) ---------- */
function updateUI() {
    if (appState.isLoggedIn) {
        loginScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        ahtNavBtn.classList.remove('hidden');

        updateSummary();
        updateRecordsList();
    } else {
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        ahtNavBtn.classList.add('hidden');

        todayAhtDisplay.textContent = '—';
        overallAhtDisplay.textContent = '—';
        
        // ADDED RESET LOGIC FOR NEW CARDS
        if (overallTotalCallsDisplay) overallTotalCallsDisplay.textContent = '—';
        if (overallTotalTalkTimeDisplay) overallTotalTalkTimeDisplay.textContent = '—';
        // ADDED RESET FOR NEW CARD
        if (avgCallsDisplay) avgCallsDisplay.textContent = '—';
        
        recordsList.innerHTML = '<p class="empty-state">Please login to see records</p>';
    }
}

/* ---------- Summary & Records UI (MODIFIED) ---------- */
function updateSummary() {
    const today = getTodayDate();
    const todayRecord = appState.ahtRecords.find(record => record.date === today);

    // Update Today's AHT
    todayAhtDisplay.textContent = todayRecord ? todayRecord.aht : '—';
    
    // Calculate overall stats
    if (appState.ahtRecords.length === 0) {
        // Reset all overall fields if no records
        overallAhtDisplay.textContent = '—';
        overallTotalCallsDisplay.textContent = '—';
        overallTotalTalkTimeDisplay.textContent = '—';
        // ADDED RESET FOR NEW CARD
        avgCallsDisplay.textContent = '—';
        return;
    }

    let totalCalls = 0;
    let totalTalkTimeSeconds = 0;
    appState.ahtRecords.forEach(record => {
        totalCalls += record.total_calls;
        totalTalkTimeSeconds += record.total_talk_time_seconds;
    });

    // Update Overall AHT (using existing function)
    const overallAht = calculateAHT(totalTalkTimeSeconds, totalCalls);
    overallAhtDisplay.textContent = overallAht || '—';

    // Update new cards
    overallTotalCallsDisplay.textContent = totalCalls;
    overallTotalTalkTimeDisplay.textContent = formatSecondsToTime(totalTalkTimeSeconds);

    // ========================================
    //   ADDED LOGIC FOR NEW CARD
    // ========================================
    const totalRecords = appState.ahtRecords.length;
    let avgCalls = 0;
    if (totalRecords > 0) {
        // round to 1 decimal place
        avgCalls = (totalCalls / totalRecords).toFixed(1);
    }
    
    // Update new card display
    avgCallsDisplay.textContent = avgCalls === 0 ? '—' : avgCalls;
    // ========================================
    //   END OF ADDED LOGIC
    // ========================================
}

function updateRecordsList() {
    if (appState.ahtRecords.length === 0) {
        recordsList.innerHTML = '<p class="empty-state">No records yet. Add your first entry above!</p>';
        return;
    }

    // Sort by date desc
    const sorted = [...appState.ahtRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    recordsList.innerHTML = sorted.map(r => `
        <div class="record-item">
            <span class="record-date">${r.date}</span>
            <span class="record-aht">${r.aht}</span>
        </div>
    `).join('');
}

/* ---------- PARSING & CALCULATION ---------- */
function parseInputData(inputText) {
    const trimmedInput = inputText.trim();
const regex = /Total Calls\s*(\d+)\s*Total Talk Time\s*(\d{1,2}):(\d{2}):(\d{2})/i;
    const match = trimmedInput.match(regex);
    if (!match) return null;

    const totalCalls = parseInt(match[1]);
    const hours = parseInt(match[2]);
    const minutes = parseInt(match[3]);
    const seconds = parseInt(match[4]);
    const totalTalkTimeInSeconds = hours * 3600 + minutes * 60 + seconds;

    // pad the hours if necessary
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return {
        total_calls: totalCalls,
        total_talk_time_seconds: totalTalkTimeInSeconds,
        total_talk_time_formatted: `${hh}:${mm}:${ss}`
    };
}

function calculateAHT(totalTalkTimeSeconds, totalCalls) {
    if (totalCalls === 0) return '00:00:00';
    const ahtSeconds = Math.floor(totalTalkTimeSeconds / totalCalls);
    return formatSecondsToTime(ahtSeconds);
}

function calculateOverallAHT() {
    if (appState.ahtRecords.length === 0) return null;
    let totalCalls = 0, totalTalkTimeSeconds = 0;
    appState.ahtRecords.forEach(record => {
        totalCalls += record.total_calls;
        totalTalkTimeSeconds += record.total_talk_time_seconds;
    });
    return calculateAHT(totalTalkTimeSeconds, totalCalls);
}

function formatSecondsToTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

/* ---------- Data operations with Supabase ---------- */

/* Load records for logged-in user */
async function loadRecordsFromSupabase() {
    if (!appState.user) return;
    try {
        const { data, error } = await supabase
            .from('aht_records')
            .select('id, date, total_calls, total_talk_time_seconds, total_talk_time, aht')
            .order('date', { ascending: false });

        if (error) {
            console.error('Load records error', error);
            showToast('Failed to load records', 'error');
            return;
        }

        // store locally
        appState.ahtRecords = data.map(d => ({
            id: d.id,
            date: d.date,
            total_calls: d.total_calls,
            total_talk_time_seconds: d.total_talk_time_seconds,
            total_talk_time: d.total_talk_time,
            aht: d.aht
        }));

        updateUI();
    } catch (err) {
        console.error('Unexpected load error', err);
        showToast('Error loading records', 'error');
    }
}

/* Save / Upsert today's record */
saveDataBtn.addEventListener('click', async () => {
    if (!appState.user) {
        showToast('Please login first', 'error');
        return;
    }

    const inputText = dataInput.value.trim();
    if (!inputText) {
        showToast('Please enter data before saving', 'error');
        return;
    }

    const parsed = parseInputData(inputText);
    if (!parsed) {
        showToast('Invalid input format. Use: Total Calls 85 Total Talk Time 05:35:37', 'error');
        return;
    }

    const aht = calculateAHT(parsed.total_talk_time_seconds, parsed.total_calls);
    const today = getTodayDate();
    const recordPayload = {
        user_id: appState.user.id,
        date: today,
        total_calls: parsed.total_calls,
        total_talk_time_seconds: parsed.total_talk_time_seconds,
        total_talk_time: parsed.total_talk_time_formatted,
        aht: aht
    };

    try {
        const { data, error } = await supabase
            .from('aht_records')
            .upsert(recordPayload, { onConflict: 'user_id,date' });

        if (error) {
            console.error('Upsert error', error);
            showToast('Failed to save data', 'error');
            return;
        }

        showToast('Data saved successfully!', 'success');
        dataInput.value = '';
        await loadRecordsFromSupabase();
    } catch (err) {
        console.error('Save error', err);
        showToast('Error saving data', 'error');
    }
});

/* Delete single record by selected date */
deleteSingleBtn.addEventListener('click', async () => {
    const selectedDate = deleteDatePicker.value;
    if (!selectedDate) {
        showToast('Please select a date to delete', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the record for ${selectedDate}?`)) return;

    try {
        // delete with both date and user_id safeguard
        const { error } = await supabase
            .from('aht_records')
            .delete()
            .eq('date', selectedDate)
            .eq('user_id', appState.user.id);

        if (error) {
            console.error('Delete error', error);
            showToast('Failed to delete record', 'error');
            return;
        }

        showToast('Record deleted successfully', 'success');
        await loadRecordsFromSupabase();
    } catch (err) { // <-- FIXED: Added curly braces
        console.error('Delete exception', err);
        showToast('Error deleting record', 'error');
    }
});

/* Delete all records till selected date (inclusive) */
deleteTillBtn.addEventListener('click', async () => {
    const selectedDate = deleteDatePicker.value;
    if (!selectedDate) {
        showToast('Please select a date', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete records till ${selectedDate}? This cannot be undone.`)) return;

    try {
        const { error, count } = await supabase
            .from('aht_records')
            .delete()
            .lte('date', selectedDate)
            .eq('user_id', appState.user.id);

        if (error) {
            console.error('Delete till error', error);
            showToast('Failed to delete records', 'error');
            return;
        }

        showToast('Records deleted successfully', 'success');
        await loadRecordsFromSupabase();
    } catch (err) {
        console.error('Delete till exception', err);
        showToast('Error deleting records', 'error');
    }
});

/* ---------- Navigation ---------- */
ahtNavBtn.addEventListener('click', () => {
    dashboard.scrollIntoView({ behavior: 'smooth' });
});

backBtn.addEventListener('click', () => {
    if (confirm('Do you want to go back to the login screen?')) {
        // sign out locally (UI only) — real sign out should be explicit via logoutBtn
        appState.isLoggedIn = false;
        updateUI();
    }
});

/* ---------- THEME (UPDATED) ---------- */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// UPDATED event listener for smooth animation
themeToggle.addEventListener('click', () => {
    const icon = themeToggle.querySelector('.theme-icon');
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';

    // 1. Add fade-out animation class
    if (icon) {
        icon.classList.add('fade-out');
    }

    // 2. Wait for animation to almost finish (500ms)
    setTimeout(() => {
        // 3. Switch the data-theme attribute
        document.documentElement.setAttribute('data-theme', next);
        
        // 4. Update the icon text
        updateThemeIcon(next); 
        
        // 5. Save the new theme to local storage
        localStorage.setItem('theme', next);

        // 6. Remove the class to allow the new icon to fade/rotate in
        if (icon) {
            // Short delay to ensure browser registers the text change
            setTimeout(() => icon.classList.remove('fade-out'), 50); 
        }
    }, 500); // This duration should be slightly less than the CSS transition
});

// UPDATED icon logic to match request (🌙 for dark, 🌞 for light)
function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '🌞';
    }
}


/* ---------- TOAST ---------- */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span class="toast-message">${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ---------- UTILITIES ---------- */
/* Local-date safe getTodayDate */
function getTodayDate() {
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
}

/* ---------- End of script ---------- */
