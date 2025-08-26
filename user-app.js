// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const navBtns = document.querySelectorAll('.nav-btn');
const screenContents = document.querySelectorAll('.screen-content');
const profileBtn = document.getElementById('profile-btn');
const logoutBtn = document.getElementById('logout-btn');
const updateProfileBtn = document.getElementById('update-profile');
const claimDailyBtn = document.getElementById('claim-daily');
const copyReferralBtn = document.getElementById('copy-referral');
const withdrawMethod = document.getElementById('withdraw-method');
const methodFields = document.querySelectorAll('.method-fields');
const submitWithdrawBtn = document.getElementById('submit-withdraw');
const contactSupportBtn = document.getElementById('contact-support');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

// User data
let currentUser = null;
let userData = null;
let dailyCheckinTime = null;
let currentTask = null;
let taskTimer = null;

// Firebase Auth State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authScreen.classList.remove('active');
        appScreen.classList.add('active');
        loadUserData();
        setupNavigation();
    } else {
        currentUser = null;
        authScreen.classList.add('active');
        appScreen.classList.remove('active');
    }
});

// Authentication Functions
showSignupBtn.addEventListener('click', () => {
    loginForm.classList.remove('active');
    signupForm.classList.add('active');
});

showLoginBtn.addEventListener('click', () => {
    signupForm.classList.remove('active');
    loginForm.classList.add('active');
});

loginBtn.addEventListener('click', loginUser);
signupBtn.addEventListener('click', registerUser);
logoutBtn.addEventListener('click', logoutUser);

function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showModal('Error', 'Please enter both email and password');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            // Login successful
        })
        .catch(error => {
            showModal('Login Error', error.message);
        });
}

function registerUser() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const referral = document.getElementById('signup-referral').value;
    
    if (!name || !email || !password || !confirm) {
        showModal('Error', 'Please fill all required fields');
        return;
    }
    
    if (password !== confirm) {
        showModal('Error', 'Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showModal('Error', 'Password should be at least 6 characters');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Create user document in Firestore
            return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                balance: 0,
                referralCode: generateReferralCode(),
                joinedAt: new Date(),
                lastCheckin: null
            });
        })
        .then(() => {
            if (referral) {
                processReferral(referral);
            }
        })
        .catch(error => {
            showModal('Registration Error', error.message);
        });
}

function logoutUser() {
    auth.signOut()
        .then(() => {
            currentUser = null;
            userData = null;
        })
        .catch(error => {
            showModal('Logout Error', error.message);
        });
}

// Load user data from Firestore
function loadUserData() {
    if (!currentUser) return;
    
    db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        if (doc.exists) {
            userData = doc.data();
            updateUI();
        }
    });
}

function updateUI() {
    if (!userData) return;
    
    // Update balance
    document.getElementById('user-balance').textContent = `$${userData.balance.toFixed(3)}`;
    document.getElementById('withdraw-balance').textContent = `$${userData.balance.toFixed(3)}`;
    
    // Update profile fields
    document.getElementById('profile-name').value = userData.name || '';
    document.getElementById('profile-email').value = userData.email || '';
    
    // Update referral code
    document.getElementById('user-referral-code').textContent = userData.referralCode || '';
    document.getElementById('referral-link').value = `${window.location.origin}?ref=${userData.referralCode}`;
    
    // Update daily checkin
    updateDailyCheckin();
    
    // Load tasks
    loadTasks();
    
    // Load withdrawal history
    loadWithdrawalHistory();
}

function updateDailyCheckin() {
    const now = new Date();
    const lastCheckin = userData.lastCheckin ? userData.lastCheckin.toDate() : null;
    
    // Check if user can claim daily reward
    if (lastCheckin) {
        const timeDiff = now.getTime() - lastCheckin.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);
        
        if (hoursDiff < 24) {
            const nextCheckin = new Date(lastCheckin.getTime() + 24 * 60 * 60 * 1000);
            const timeLeft = nextCheckin.getTime() - now.getTime();
            
            claimDailyBtn.disabled = true;
            document.getElementById('checkin-timer').textContent = `Next check-in available in ${formatTime(timeLeft)}`;
            
            // Start countdown if needed
            if (timeLeft > 0) {
                startDailyCountdown(timeLeft);
            }
        } else {
            claimDailyBtn.disabled = false;
            document.getElementById('checkin-timer').textContent = 'Available now';
        }
    } else {
        claimDailyBtn.disabled = false;
        document.getElementById('checkin-timer').textContent = 'Available now';
    }
    
    // Get daily reward amount from admin settings
    db.collection('settings').doc('dailyReward').get()
        .then(doc => {
            if (doc.exists) {
                const reward = doc.data().amount || 0;
                claimDailyBtn.textContent = `Claim $${reward.toFixed(2)}`;
            }
        });
}

function startDailyCountdown(timeLeft) {
    // Clear existing timer
    if (dailyCheckinTime) {
        clearInterval(dailyCheckinTime);
    }
    
    dailyCheckinTime = setInterval(() => {
        timeLeft -= 1000;
        
        if (timeLeft <= 0) {
            clearInterval(dailyCheckinTime);
            claimDailyBtn.disabled = false;
            document.getElementById('checkin-timer').textContent = 'Available now';
        } else {
            document.getElementById('checkin-timer').textContent = `Next check-in available in ${formatTime(timeLeft)}`;
        }
    }, 1000);
}

function formatTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// Navigation
function setupNavigation() {
    // Bottom nav buttons
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            
            // Update active button
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show target screen
            screenContents.forEach(screen => screen.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
    
    // Profile button
    profileBtn.addEventListener('click', () => {
        screenContents.forEach(screen => screen.classList.remove('active'));
        document.getElementById('profile').classList.add('active');
        
        // Update nav buttons
        navBtns.forEach(b => b.classList.remove('active'));
    });
}

// Profile Update
updateProfileBtn.addEventListener('click', () => {
    const name = document.getElementById('profile-name').value;
    const email = document.getElementById('profile-email').value;
    
    if (!name || !email) {
        showModal('Error', 'Please fill all fields');
        return;
    }
    
    // Update user profile
    currentUser.updateEmail(email)
        .then(() => {
            return db.collection('users').doc(currentUser.uid).update({
                name: name,
                email: email
            });
        })
        .then(() => {
            showModal('Success', 'Profile updated successfully');
        })
        .catch(error => {
            showModal('Update Error', error.message);
        });
});

// Daily Check-in
claimDailyBtn.addEventListener('click', () => {
    db.collection('settings').doc('dailyReward').get()
        .then(doc => {
            if (doc.exists) {
                const reward = doc.data().amount || 0;
                
                // Update user balance and last checkin time
                return db.collection('users').doc(currentUser.uid).update({
                    balance: firebase.firestore.FieldValue.increment(reward),
                    lastCheckin: new Date()
                });
            }
        })
        .then(() => {
            showModal('Success', 'Daily reward claimed successfully');
        })
        .catch(error => {
            showModal('Error', error.message);
        });
});

// Copy Referral Link
copyReferralBtn.addEventListener('click', () => {
    const referralLink = document.getElementById('referral-link');
    referralLink.select();
    document.execCommand('copy');
    showModal('Success', 'Referral link copied to clipboard');
});

// Withdrawal Methods
withdrawMethod.addEventListener('change', () => {
    const method = withdrawMethod.value;
    
    // Hide all method fields
    methodFields.forEach(field => field.classList.add('hidden'));
    
    // Show selected method fields
    document.getElementById(`${method}-fields`).classList.remove('hidden');
});

// Submit Withdrawal
submitWithdrawBtn.addEventListener('click', () => {
    const method = withdrawMethod.value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    
    if (!amount || amount < 10) {
        showModal('Error', 'Minimum withdrawal amount is $10');
        return;
    }
    
    if (amount > userData.balance) {
        showModal('Error', 'Insufficient balance');
        return;
    }
    
    let details = {};
    
    if (method === 'jazzcash') {
        details = {
            accountName: document.getElementById('jazzcash-name').value,
            accountNumber: document.getElementById('jazzcash-number').value
        };
    } else if (method === 'easypaisa') {
        details = {
            accountName: document.getElementById('easypaisa-name').value,
            accountNumber: document.getElementById('easypaisa-number').value
        };
    } else if (method === 'usdt') {
        details = {
            walletName: document.getElementById('usdt-wallet-name').value,
            walletAddress: document.getElementById('usdt-address').value
        };
    }
    
    // Validate details
    if (!details.accountName || !details.accountNumber) {
        showModal('Error', 'Please fill all required fields');
        return;
    }
    
    // Create withdrawal request
    db.collection('withdrawals').add({
        userId: currentUser.uid,
        userName: userData.name,
        userEmail: userData.email,
        method: method,
        amount: amount,
        details: details,
        status: 'pending',
        createdAt: new Date()
    })
    .then(() => {
        // Deduct balance from user
        return db.collection('users').doc(currentUser.uid).update({
            balance: firebase.firestore.FieldValue.increment(-amount)
        });
    })
    .then(() => {
        showModal('Success', 'Withdrawal request submitted successfully');
        document.getElementById('withdraw-amount').value = '';
    })
    .catch(error => {
        showModal('Error', error.message);
    });
});

// Load Tasks
function loadTasks() {
    const tasksContainer = document.getElementById('tasks-container');
    tasksContainer.innerHTML = '<p class="no-data">Loading tasks...</p>';
    
    // Get user's completed tasks
    db.collection('userTasks').where('userId', '==', currentUser.uid).get()
        .then(snapshot => {
            const completedTaskIds = [];
            snapshot.forEach(doc => {
                completedTaskIds.push(doc.data().taskId);
            });
            
            // Get all active tasks that user hasn't completed
            return db.collection('tasks')
                .where('active', '==', true)
                .where('id', 'not-in', completedTaskIds)
                .get();
        })
        .then(snapshot => {
            if (snapshot.empty) {
                tasksContainer.innerHTML = '<p class="no-data">No tasks available at the moment</p>';
                return;
            }
            
            tasksContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const task = doc.data();
                const taskElement = createTaskElement(task);
                tasksContainer.appendChild(taskElement);
            });
        })
        .catch(error => {
            tasksContainer.innerHTML = '<p class="no-data">Error loading tasks</p>';
            console.error('Error loading tasks:', error);
        });
}

function createTaskElement(task) {
    const element = document.createElement('div');
    element.className = 'task-item';
    element.innerHTML = `
        <div class="task-header">
            <h3>${task.title}</h3>
            <span class="task-timer">${formatTaskTime(task.duration)}</span>
        </div>
        <p>Reward: $${task.reward.toFixed(3)}</p>
        <button class="btn-primary start-task" data-id="${task.id}">Start Task</button>
    `;
    
    element.querySelector('.start-task').addEventListener('click', () => {
        startTask(task);
    });
    
    return element;
}

function formatTaskTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function startTask(task) {
    currentTask = task;
    
    // Show task view
    document.getElementById('task-title').textContent = task.title;
    document.getElementById('task-timer').textContent = formatTaskTime(task.duration);
    document.getElementById('task-iframe').src = task.url;
    document.getElementById('claim-task').classList.add('hidden');
    
    document.getElementById('earn').classList.add('hidden');
    document.getElementById('task-view').classList.remove('hidden');
    
    // Start timer
    let timeLeft = task.duration;
    updateTaskTimer(timeLeft);
    
    if (taskTimer) {
        clearInterval(taskTimer);
    }
    
    taskTimer = setInterval(() => {
        timeLeft--;
        updateTaskTimer(timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(taskTimer);
            document.getElementById('claim-task').classList.remove('hidden');
        }
    }, 1000);
}

function updateTaskTimer(seconds) {
    document.getElementById('task-timer').textContent = formatTaskTime(seconds);
}

// Claim Task Reward
document.getElementById('claim-task').addEventListener('click', () => {
    if (!currentTask) return;
    
    // Mark task as completed for user
    db.collection('userTasks').add({
        userId: currentUser.uid,
        taskId: currentTask.id,
        completedAt: new Date(),
        reward: currentTask.reward
    })
    .then(() => {
        // Add reward to user balance
        return db.collection('users').doc(currentUser.uid).update({
            balance: firebase.firestore.FieldValue.increment(currentTask.reward)
        });
    })
    .then(() => {
        showModal('Success', `Task completed! $${currentTask.reward.toFixed(3)} added to your balance`);
        closeTaskView();
        loadTasks(); // Reload tasks
    })
    .catch(error => {
        showModal('Error', error.message);
    });
});

function closeTaskView() {
    document.getElementById('task-view').classList.add('hidden');
    document.getElementById('earn').classList.remove('hidden');
    document.getElementById('task-iframe').src = 'about:blank';
    
    if (taskTimer) {
        clearInterval(taskTimer);
        taskTimer = null;
    }
    
    currentTask = null;
}

// Load Withdrawal History
function loadWithdrawalHistory() {
    const historyContainer = document.getElementById('withdrawal-history');
    historyContainer.innerHTML = '<p class="no-data">Loading history...</p>';
    
    db.collection('withdrawals')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                historyContainer.innerHTML = '<p class="no-data">No withdrawal requests yet</p>';
                return;
            }
            
            historyContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const withdrawal = doc.data();
                const element = createWithdrawalElement(withdrawal);
                historyContainer.appendChild(element);
            });
        })
        .catch(error => {
            historyContainer.innerHTML = '<p class="no-data">Error loading history</p>';
            console.error('Error loading withdrawal history:', error);
        });
}

function createWithdrawalElement(withdrawal) {
    const element = document.createElement('div');
    element.className = 'withdrawal-item';
    
    const date = withdrawal.createdAt.toDate().toLocaleDateString();
    const statusClass = `status-${withdrawal.status}`;
    
    element.innerHTML = `
        <div class="withdrawal-header">
            <h3>$${withdrawal.amount.toFixed(2)}</h3>
            <span class="${statusClass}">${withdrawal.status}</span>
        </div>
        <p>Method: ${withdrawal.method}</p>
        <p>Date: ${date}</p>
    `;
    
    return element;
}

// Contact Support
contactSupportBtn.addEventListener('click', () => {
    // Get support URL from admin settings
    db.collection('settings').doc('supportUrl').get()
        .then(doc => {
            if (doc.exists) {
                window.open(doc.data().value, '_blank');
            } else {
                showModal('Info', 'Support URL not configured');
            }
        });
});

// Utility Functions
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function processReferral(code) {
    // Find user with this referral code and reward them
    db.collection('users').where('referralCode', '==', code).get()
        .then(snapshot => {
            if (!snapshot.empty) {
                const referrerId = snapshot.docs[0].id;
                
                // Get referral reward amount
                return db.collection('settings').doc('referralReward').get()
                    .then(doc => {
                        const reward = doc.exists ? doc.data().amount : 0;
                        
                        // Reward the referrer
                        return db.collection('users').doc(referrerId).update({
                            balance: firebase.firestore.FieldValue.increment(reward)
                        });
                    });
            }
        })
        .catch(error => {
            console.error('Error processing referral:', error);
        });
}

function showModal(title, message) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    modalOverlay.classList.remove('hidden');
}

modalClose.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
});

// Handle referral code from URL
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        document.getElementById('signup-referral').value = refCode;
    }
});