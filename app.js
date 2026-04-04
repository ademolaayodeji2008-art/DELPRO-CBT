// app.js

// ==========================================
// 1. FIREBASE & PAYSTACK CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBFrbQMjOKzgvMIWBcMmgp7fwa3RlxIEUs",
  authDomain: "cbt-app-b7233.firebaseapp.com",
  projectId: "cbt-app-b7233",
  storageBucket: "cbt-app-b7233.firebasestorage.app",
  messagingSenderId: "98158010166",
  appId: "1:98158010166:web:a92569b3f1b0018ed59d97"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const PAYSTACK_PUBLIC_KEY = '    pk_test_dd596d986540e7b65dc06ecc37ad03b9465a660f';

// ==========================================
// 2. STATE VARIABLES
// ==========================================
let currentUserData = null;
let selectedExamType = "";
let quizData = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timeRemaining = 600;
let timerInterval;

// Modifiers
let isLoginMode = true;
let isStudyMode = false;

// Theory Variables
let isTheoryMode = false;
let theoryData = [];
let theoryAnswers = {};

const authScreen = document.getElementById('auth-screen');
const examSelectionScreen = document.getElementById('exam-selection-screen');
const jambDrillScreen = document.getElementById('jamb-drill-screen');
const subjectSelectionScreen = document.getElementById('subject-selection-screen');
const paywallScreen = document.getElementById('paywall-screen');
const examInterface = document.getElementById('exam-interface');
const theoryInterface = document.getElementById('theory-interface');
const reviewScreen = document.getElementById('review-screen');
const theoryReviewScreen = document.getElementById('theory-review-screen');
const headerNav = document.querySelector('.header-nav');
const subjectTabsContainer = document.getElementById('subject-tabs-container');

// MOCK THEORY DATABASE
const MOCK_THEORY_DB = {
    "Biology": [
        { question: "a) Explain the process of photosynthesis.<br>b) State three conditions necessary for it.", marking_scheme: "<b>Part A:</b> Process by which green plants manufacture organic food...<br><b>Part B:</b> Sunlight, Chlorophyll, CO2, Water." }
    ],
    "English": [
        { question: "Write an essay (about 450 words) on: The Danger of Cultism in Nigerian Universities.", marking_scheme: "<b>Points:</b> Content (10m), Organization (10m), Expression (20m), Accuracy (10m)." }
    ],
    "Chemistry": [
        { question: "Give different types of metals.", marking_scheme: "<b>Points:</b> Content (10m), Organization (10m), Expression (20m), Accuracy (10m)." }
    ]
};

// ==========================================
// 3. AUTH LOGIC (CORRECTED)
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) fetchUserData(user);
    else { authScreen.style.display = 'block'; examSelectionScreen.style.display = 'none'; document.getElementById('logged-out-nav').style.display = 'flex'; document.getElementById('user-profile-badge').style.display = 'none'; }
});

async function fetchUserData(user) {
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            currentUserData = doc.data();
        } else {
            currentUserData = {
                email: user.email,
                trialsLeft: 2,
                isSubscribed: false,
                highScore: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(user.uid).set(currentUserData);
        }
        authScreen.style.display = 'none';
        examSelectionScreen.style.display = 'block';
        document.getElementById('logged-out-nav').style.display = 'none';
        document.getElementById('user-profile-badge').style.display = 'flex';
        document.getElementById('user-name-display').innerText = currentUserData.email.split('@')[0];
        updateTrialBadge();
    } catch (e) { console.error(e); alert("Firebase Error."); auth.signOut(); }
}

document.getElementById('auth-toggle-link').addEventListener('click', (e) => { e.preventDefault(); isLoginMode = !isLoginMode; document.getElementById('auth-btn').innerText = isLoginMode ? "Sign In" : "Create Account"; });
document.getElementById('nav-login-btn').addEventListener('click', () => { authScreen.style.display = 'flex'; examSelectionScreen.style.display = 'none'; isLoginMode = true; });
document.getElementById('nav-signup-btn').addEventListener('click', () => { authScreen.style.display = 'flex'; examSelectionScreen.style.display = 'none'; isLoginMode = false; });

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const email = document.getElementById('auth-email').value; const pwd = document.getElementById('auth-password').value;
    try { if (isLoginMode) await auth.signInWithEmailAndPassword(email, pwd); else await auth.createUserWithEmailAndPassword(email, pwd); } catch (err) { alert(err.message.replace("Firebase: ", "")); }
});
document.getElementById('logout-btn').addEventListener('click', () => { auth.signOut(); location.reload(); });

function updateTrialBadge() {
    const badge = document.getElementById('trial-counter-badge');
    if (currentUserData.isSubscribed) { badge.innerText = "Premium Member"; badge.style.background = "#fff3e0"; badge.style.color = "#ef6c00"; }
    else { badge.innerText = `Free Trials Left: ${currentUserData.trialsLeft}`; }
}

// ==========================================
// 4. PAYSTACK LOGIC
// ==========================================
document.getElementById('subscribe-btn').addEventListener('click', () => {
    if (!auth.currentUser) return;
    let handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY, email: currentUserData.email, amount: 1500 * 100, currency: 'NGN', ref: 'CBT_' + Math.floor(Math.random() * 1000000000),
        callback: function (res) {
            db.collection('users').doc(auth.currentUser.uid).update({ isSubscribed: true }).then(() => { currentUserData.isSubscribed = true; paywallScreen.style.display = 'none'; examSelectionScreen.style.display = 'block'; updateTrialBadge(); alert('Payment complete!'); });
        }, onClose: function () { }
    }); handler.openIframe();
});
document.getElementById('cancel-paywall-btn').addEventListener('click', () => { paywallScreen.style.display = 'none'; examSelectionScreen.style.display = 'block'; });

// ==========================================
// 5. EXAM SELECTION & JAMB DRILL COMBINATION
// ==========================================
const examCards = document.querySelectorAll('.exam-card');
examCards.forEach(card => {
    card.addEventListener('click', () => {
        selectedExamType = card.getAttribute('data-exam');
        if (selectedExamType === "JAMB-DRILL") { examSelectionScreen.style.display = 'none'; jambDrillScreen.style.display = 'block'; return; }

        document.getElementById('selected-exam-display').innerText = `Showing subjects for ${selectedExamType}`;
        const theoryBtns = document.querySelectorAll('.start-theory-btn');
        if (selectedExamType === "WAEC" || selectedExamType === "NECO") theoryBtns.forEach(btn => btn.style.display = "flex"); else theoryBtns.forEach(btn => btn.style.display = "none");

        document.querySelectorAll('.subject-card').forEach(subCard => {
            subCard.style.display = subCard.getAttribute('data-available-for').includes(selectedExamType) ? 'block' : 'none';
        });
        examSelectionScreen.style.display = 'none'; subjectSelectionScreen.style.display = 'block';
    });
});
document.getElementById('back-to-exams-btn').addEventListener('click', () => { subjectSelectionScreen.style.display = 'none'; examSelectionScreen.style.display = 'block'; });
document.getElementById('back-to-exams-drill-btn').addEventListener('click', () => { jambDrillScreen.style.display = 'none'; examSelectionScreen.style.display = 'block'; });

const drillCheckboxes = document.querySelectorAll('.drill-subject input[type="checkbox"]');
const startDrillBtn = document.getElementById('start-jamb-drill-btn');
drillCheckboxes.forEach(box => {
    box.addEventListener('change', () => {
        const checkedCount = document.querySelectorAll('.drill-subject input[type="checkbox"]:checked').length;
        if (checkedCount >= 3) { drillCheckboxes.forEach(b => { if (!b.checked) b.disabled = true; }); startDrillBtn.disabled = false; startDrillBtn.innerText = "Start 2-Hour JAMB Drill"; }
        else { drillCheckboxes.forEach(b => b.disabled = false); startDrillBtn.disabled = true; startDrillBtn.innerText = `Select ${3 - checkedCount} more subjects to start`; }
    });
});

function getAlocSubjectCode(sub) { const map = { "English": "english", "Mathematics": "mathematics", "Biology": "biology", "Physics": "physics", "Chemistry": "chemistry", "Agricultural Science": "agriculture", "Government": "government", "Literature-in-English": "englishlit", "Geography": "geography", "CRK": "crk", "Economics": "economics", "Financial Accounting": "accounting", "Commerce": "commerce", "Civic Education": "civiledu", "Data Processing": "dataprocessing", "Further Mathematics": "furthermaths" }; return map[sub] || sub.toLowerCase().replace(/\s+/g, ''); }

// ==========================================
// 6. OBJECTIVE EXAM ENGINE (STUDY, EXAM & DRILL)
// ==========================================

document.querySelectorAll('.start-study-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!currentUserData.isSubscribed && currentUserData.trialsLeft <= 0) { currentUserData.trialsLeft = 0; updateTrialBadge(); subjectSelectionScreen.style.display = 'none'; paywallScreen.style.display = 'block'; return; }
        isStudyMode = true;
        startLiveApiExamFlow(selectedExamType, e.target.closest('.card-actions').querySelector('.start-exam-btn').getAttribute('data-subject'), e.target);
    });
});

document.querySelectorAll('.start-exam-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!currentUserData.isSubscribed && currentUserData.trialsLeft <= 0) { currentUserData.trialsLeft = 0; updateTrialBadge(); subjectSelectionScreen.style.display = 'none'; paywallScreen.style.display = 'block'; return; }
        isStudyMode = false;
        startLiveApiExamFlow(selectedExamType, e.target.closest('.card-actions').querySelector('.start-exam-btn').getAttribute('data-subject'), e.target);
    });
});

async function startLiveApiExamFlow(exam, subject, btn) {
    const origText = btn.innerHTML; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`; btn.disabled = true;
    try {
        const res = await fetch(`https://questions.aloc.com.ng/api/v2/m?subject=${getAlocSubjectCode(subject)}`, { headers: { 'AccessToken': 'QB-4d2b57b3201f27e78169' } });
        if (!res.ok) throw new Error("API Blocked");
        const data = await res.json();
        if (!data.data || data.data.length === 0) { alert("No questions."); return; }

        if (!currentUserData.isSubscribed && currentUserData.trialsLeft > 0) { currentUserData.trialsLeft--; db.collection('users').doc(auth.currentUser.uid).update({ trialsLeft: currentUserData.trialsLeft }); updateTrialBadge(); }

        let limit = (exam === "JAMB" && subject !== "English") ? 40 : 60;
        quizData = data.data.slice(0, limit).map(q => ({ exam, subject, question: q.question, options: [`A. ${q.option.a}`, `B. ${q.option.b}`, `C. ${q.option.c}`, `D. ${q.option.d}`], answer: { "a": "0", "b": "1", "c": "2", "d": "3" }[q.answer] || "0" }));

        subjectTabsContainer.style.display = 'none';
        launchExamInterface(3600);
    } catch (e) { alert("API Error. Please check your internet."); } finally { btn.innerHTML = origText; btn.disabled = false; }
}

startDrillBtn.addEventListener('click', async () => {
    if (!currentUserData.isSubscribed && currentUserData.trialsLeft <= 0) { currentUserData.trialsLeft = 0; updateTrialBadge(); jambDrillScreen.style.display = 'none'; paywallScreen.style.display = 'block'; return; }

    isStudyMode = false;
    const selectedSubjects = ["English"];
    document.querySelectorAll('.drill-subject input[type="checkbox"]:checked').forEach(box => selectedSubjects.push(box.value));

    const originalBtnText = startDrillBtn.innerText;
    startDrillBtn.disabled = true;

    try {
        quizData = [];
        subjectTabsContainer.innerHTML = '';
        subjectTabsContainer.style.display = 'flex';

        for (let i = 0; i < selectedSubjects.length; i++) {
            const subjectName = selectedSubjects[i];
            startDrillBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Fetching ${subjectName} (${i + 1}/4)...`;

            const response = await fetch(`https://questions.aloc.com.ng/api/v2/m?subject=${getAlocSubjectCode(subjectName)}`, { headers: { 'AccessToken': 'QB-4d2b57b3201f27e78169' } });
            if (!response.ok) throw new Error(`Server blocked request for ${subjectName}`);
            const apiResponse = await response.json();

            if (apiResponse.data && apiResponse.data.length > 0) {
                const limit = (subjectName === "English") ? 60 : 40;
                const startingIndex = quizData.length;

                const tabBtn = document.createElement('button');
                tabBtn.className = 'subject-tab-btn';
                if (i === 0) tabBtn.classList.add('active');
                tabBtn.innerText = subjectName;
                tabBtn.onclick = () => { if (!isStudyMode) saveAnswer(); currentQuestionIndex = startingIndex; loadQuestion(); };
                subjectTabsContainer.appendChild(tabBtn);

                const formattedQ = apiResponse.data.slice(0, limit).map(q => ({ exam: "JAMB Simulator", subject: subjectName, question: q.question, options: [`A. ${q.option.a}`, `B. ${q.option.b}`, `C. ${q.option.c}`, `D. ${q.option.d}`], answer: { "a": "0", "b": "1", "c": "2", "d": "3" }[q.answer] || "0" }));
                quizData = quizData.concat(formattedQ);
            }
        }

        if (quizData.length === 0) throw new Error("No questions were returned.");
        if (!currentUserData.isSubscribed && currentUserData.trialsLeft > 0) { currentUserData.trialsLeft--; await db.collection('users').doc(auth.currentUser.uid).update({ trialsLeft: currentUserData.trialsLeft }); updateTrialBadge(); }

        jambDrillScreen.style.display = "none";
        launchExamInterface(7200);

    } catch (e) { console.error(e); alert(`Failed to load the drill.\n\nThe free API might be overloaded. Please wait 10 seconds and try again.`); } finally { startDrillBtn.innerHTML = originalBtnText; startDrillBtn.disabled = false; }
});

// ==========================================
// 7. CBT CANVAS & INSTANT FEEDBACK LOGIC (CORRECTED)
// ==========================================

function calculateScore() {
    clearInterval(timerInterval);
    let s = 0;
    quizData.forEach((q, i) => s += (userAnswers[i] === q.answer ? 1 : 0));

    // Update Firebase with High Score if it's the user's best performance
    if (auth.currentUser) {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        if (!currentUserData.highScore || s > currentUserData.highScore) {
            userRef.update({ highScore: s }).then(() => {
                currentUserData.highScore = s;
                console.log("New High Score saved to Firebase!");
            }).catch(err => console.error("Error saving score:", err));
        }
    }

    document.querySelector('.cbt-main').style.display = "none";
    document.querySelector('.cbt-footer').style.display = "none";
    document.querySelector('.cbt-topbar').style.display = "none";
    subjectTabsContainer.style.display = "none";
    document.getElementById('result-area').style.display = "block";
    headerNav.style.display = "flex";
    document.getElementById('score-display').innerText = `${s}/${quizData.length}`;
}

function launchExamInterface(timeLimitSeconds) {
    document.querySelector('.cbt-main').style.display = "block"; document.querySelector('.cbt-footer').style.display = "flex"; document.querySelector('.cbt-topbar').style.display = "flex"; document.getElementById('result-area').style.display = "none"; headerNav.style.display = "none"; subjectSelectionScreen.style.display = "none"; examInterface.style.display = "block";
    currentQuestionIndex = 0; userAnswers = {}; timeRemaining = timeLimitSeconds; loadQuestion(); startTimer();
}

const qText = document.getElementById('question-text');
const opts = [document.getElementById('option-a'), document.getElementById('option-b'), document.getElementById('option-c'), document.getElementById('option-d')];
const radios = document.querySelectorAll('input[name="option"]');
const optionLabels = document.querySelectorAll('.custom-option');

document.getElementById('quit-btn').addEventListener('click', () => { clearInterval(timerInterval); examInterface.style.display = 'none'; subjectSelectionScreen.style.display = 'block'; headerNav.style.display = "flex"; });

function startTimer() {
    if (isStudyMode) {
        document.getElementById('time-display').innerText = "Study Mode";
        document.querySelector('.cbt-timer').style.background = "#278168";
        return;
    }

    document.querySelector('.cbt-timer').style.background = "#d9534f";
    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) { clearInterval(timerInterval); calculateScore(); }
        else { let m = Math.floor(timeRemaining / 60), s = timeRemaining % 60; document.getElementById('time-display').innerText = `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`; timeRemaining--; }
    }, 1000);
}

radios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
        if (isStudyMode) {
            const selectedVal = e.target.value;
            const correctVal = quizData[currentQuestionIndex].answer;
            userAnswers[currentQuestionIndex] = selectedVal;

            radios.forEach(r => r.disabled = true);

            optionLabels.forEach((label, idx) => {
                if (idx.toString() === correctVal) label.classList.add('study-correct');
                else if (idx.toString() === selectedVal && selectedVal !== correctVal) label.classList.add('study-wrong');
            });
        }
    });
});

function saveAnswer() {
    if (!isStudyMode) {
        radios.forEach(r => { if (r.checked) userAnswers[currentQuestionIndex] = r.value; });
    }
}

function loadQuestion() {
    const q = quizData[currentQuestionIndex];
    document.getElementById('subject-title').innerText = `${q.exam} - ${q.subject}`;
    document.getElementById('question-tracker').innerText = `Question ${currentQuestionIndex + 1} of ${quizData.length}`;
    qText.innerHTML = q.question;

    if (q.exam === "JAMB Simulator") {
        document.querySelectorAll('.subject-tab-btn').forEach(btn => btn.classList.toggle('active', btn.innerText === q.subject));
    }

    optionLabels.forEach(label => label.classList.remove('study-correct', 'study-wrong'));
    radios.forEach(r => { r.disabled = false; r.checked = false; });

    if (userAnswers[currentQuestionIndex] !== undefined) {
        const selectedVal = userAnswers[currentQuestionIndex];
        radios[selectedVal].checked = true;

        if (isStudyMode) {
            radios.forEach(r => r.disabled = true);
            const correctVal = q.answer;
            optionLabels.forEach((label, idx) => {
                if (idx.toString() === correctVal) label.classList.add('study-correct');
                else if (idx.toString() === selectedVal && selectedVal !== correctVal) label.classList.add('study-wrong');
            });
        }
    }

    opts.forEach((opt, i) => opt.innerText = q.options[i]);
    document.getElementById('prev-btn').style.display = currentQuestionIndex === 0 ? "none" : "flex";
    document.getElementById('next-btn').style.display = currentQuestionIndex === quizData.length - 1 ? "none" : "flex";
    document.getElementById('submit-btn').style.display = currentQuestionIndex === quizData.length - 1 ? "flex" : "none";
}

document.getElementById('next-btn').addEventListener('click', () => { saveAnswer(); currentQuestionIndex++; loadQuestion(); });
document.getElementById('prev-btn').addEventListener('click', () => { saveAnswer(); currentQuestionIndex--; loadQuestion(); });
document.getElementById('submit-btn').addEventListener('click', () => { saveAnswer(); calculateScore(); });

document.getElementById('review-btn').addEventListener('click', () => { examInterface.style.display = 'none'; reviewScreen.style.display = 'block'; generateReview(); });
document.getElementById('back-to-results-btn').addEventListener('click', () => { reviewScreen.style.display = 'none'; examInterface.style.display = 'block'; });
function generateReview() { const rc = document.getElementById('review-content'); rc.innerHTML = ''; quizData.forEach((q, i) => { let h = ''; q.options.forEach((o, oi) => { let c = 'review-option', ic = ''; if (oi.toString() === q.answer) { c += ' correct'; ic = ' <i class="fas fa-check-circle"></i>'; } else if (oi.toString() === userAnswers[i] && userAnswers[i] !== q.answer) { c += ' wrong'; ic = ' <i class="fas fa-times-circle"></i>'; } h += `<div class="${c}"><span>${o}</span> ${ic}</div>`; }); rc.innerHTML += `<div class="review-card"><div class="review-q-text"><span style="color:#278168;font-size:0.9rem;">[${q.subject}]</span><br>Q${i + 1}: ${q.question}</div>${h}</div>`; }); }


// ==========================================
// 8. THEORY EXAM ENGINE (WAEC/NECO)
// ==========================================
document.querySelectorAll('.start-theory-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!currentUserData.isSubscribed && currentUserData.trialsLeft <= 0) { currentUserData.trialsLeft = 0; updateTrialBadge(); subjectSelectionScreen.style.display = 'none'; paywallScreen.style.display = 'block'; return; }
        const subject = e.target.closest('.card-actions').querySelector('.start-exam-btn').getAttribute('data-subject');
        if (!MOCK_THEORY_DB[subject]) { alert(`Theory questions not yet available for ${subject}. Test it with Biology or English!`); return; }

        theoryData = MOCK_THEORY_DB[subject]; theoryAnswers = {}; currentQuestionIndex = 0; timeRemaining = 5400;
        subjectSelectionScreen.style.display = "none"; headerNav.style.display = "none"; theoryInterface.style.display = "block"; document.getElementById('theory-result-area').style.display = "none"; document.querySelector('#theory-interface .cbt-main').style.display = "block"; document.querySelector('#theory-interface .cbt-footer').style.display = "flex";
        loadTheoryQuestion(subject); startTheoryTimer();
    });
});

const theoryTextBox = document.getElementById('theory-answer-box');
function startTheoryTimer() { timerInterval = setInterval(() => { if (timeRemaining <= 0) { clearInterval(timerInterval); submitTheory(); } else { let m = Math.floor(timeRemaining / 60), s = timeRemaining % 60; document.getElementById('theory-time-display').innerText = `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`; timeRemaining--; } }, 1000); }
function saveTheoryAnswer() { theoryAnswers[currentQuestionIndex] = theoryTextBox.value; }
function loadTheoryQuestion(subjectName) {
    const q = theoryData[currentQuestionIndex]; document.getElementById('theory-subject-title').innerText = `${selectedExamType} Theory - ${subjectName}`; document.getElementById('theory-question-tracker').innerText = `Question ${currentQuestionIndex + 1} of ${theoryData.length}`; document.getElementById('theory-question-text').innerHTML = q.question; theoryTextBox.value = theoryAnswers[currentQuestionIndex] || "";
    document.getElementById('theory-prev-btn').style.display = currentQuestionIndex === 0 ? "none" : "flex"; if (currentQuestionIndex === theoryData.length - 1) { document.getElementById('theory-next-btn').style.display = "none"; document.getElementById('theory-submit-btn').style.display = "flex"; } else { document.getElementById('theory-next-btn').style.display = "flex"; document.getElementById('theory-submit-btn').style.display = "none"; }
}
document.getElementById('theory-next-btn').addEventListener('click', () => { saveTheoryAnswer(); currentQuestionIndex++; loadTheoryQuestion(); });
document.getElementById('theory-prev-btn').addEventListener('click', () => { saveTheoryAnswer(); currentQuestionIndex--; loadTheoryQuestion(); });
document.getElementById('theory-quit-btn').addEventListener('click', () => { clearInterval(timerInterval); theoryInterface.style.display = 'none'; subjectSelectionScreen.style.display = 'block'; headerNav.style.display = "flex"; });
document.getElementById('theory-submit-btn').addEventListener('click', () => { saveTheoryAnswer(); submitTheory(); });
function submitTheory() { clearInterval(timerInterval); document.querySelector('#theory-interface .cbt-main').style.display = "none"; document.querySelector('#theory-interface .cbt-footer').style.display = "none"; document.getElementById('theory-result-area').style.display = "block"; headerNav.style.display = "flex"; }
document.getElementById('theory-review-btn').addEventListener('click', () => { theoryInterface.style.display = 'none'; theoryReviewScreen.style.display = 'block'; generateTheoryReview(); });
document.getElementById('back-to-theory-results-btn').addEventListener('click', () => { theoryReviewScreen.style.display = 'none'; theoryInterface.style.display = 'block'; });
function generateTheoryReview() { const rc = document.getElementById('theory-review-content'); rc.innerHTML = ''; theoryData.forEach((q, i) => { const userAnswer = theoryAnswers[i] || "<i>No answer provided.</i>"; rc.innerHTML += `<div class="theory-review-card"><div class="theory-q-text">Q${i + 1}: ${q.question}</div><p><b>Your Answer:</b></p><div class="theory-answer-box">${userAnswer.replace(/\n/g, '<br>')}</div><div class="theory-marking-scheme"><h4><i class="fas fa-check-double"></i> Official Marking Scheme</h4><p>${q.marking_scheme}</p></div></div>`; }); }