// Firebase modular SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  increment,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// State Management
let app = null;
let db = null;
let auth = null;
let currentUser = null;
let unsubscribeFirestore = null;
let posts = [];
let currentCategory = 'all';
let searchQuery = '';
let selectedColor = 'yellow';

// Default initial sample posts for kids
const initialSamplePosts = [
  {
    id: 'sample-1',
    author: '지우 🚀',
    category: '💡 아이디어',
    content: '우주 정거장에 도서관을 만들면 무중력 상태에서 둥둥 떠다니며 책을 읽을 수 있을 것 같아요!',
    color: 'yellow',
    likes: 5,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-2',
    author: '민수 🎨',
    category: '🎨 그림 & 창작',
    content: '오늘 미술 시간에 미래의 친환경 자동차를 그려봤어요. 태양빛을 받으면 무지개색으로 변하는 자동차예요!',
    color: 'blue',
    likes: 8,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'sample-3',
    author: '하은 🌱',
    category: '📚 오늘의 배움',
    content: '식물도 클래식 음악을 들려주면 더 튼튼하게 자란다는 사실을 배웠어요! 우리 교실 화분에도 음악을 들려줘요.',
    color: 'green',
    likes: 12,
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'sample-4',
    author: '서준 🐶',
    category: '🎉 칭찬해요',
    content: '오늘 급식 시간에 식판 쏟았을 때 바로 휴지 가져와서 같이 닦아준 도윤아 정말 고마워!',
    color: 'pink',
    likes: 15,
    createdAt: new Date(Date.now() - 10800000).toISOString()
  }
];

// Elements
const postsGrid = document.getElementById('postsGrid');
const postModal = document.getElementById('postModal');
const configModal = document.getElementById('configModal');
const openNewPostBtn = document.getElementById('openNewPostBtn');
const fabNewPostBtn = document.getElementById('fabNewPostBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeConfigModalBtn = document.getElementById('closeConfigModalBtn');
const resetConfigBtn = document.getElementById('resetConfigBtn');
const postForm = document.getElementById('postForm');
const configForm = document.getElementById('configForm');
const authorInput = document.getElementById('authorInput');
const categorySelect = document.getElementById('categorySelect');
const contentInput = document.getElementById('contentInput');
const palettePicker = document.getElementById('palettePicker');
const searchInput = document.getElementById('searchInput');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const syncStatusText = document.getElementById('syncStatusText');
const postCountBadge = document.getElementById('postCountBadge');

// Google Auth Elements
const googleLoginBtn = document.getElementById('googleLoginBtn');
const googleLogoutBtn = document.getElementById('googleLogoutBtn');
const userProfileArea = document.getElementById('userProfileArea');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

// Local storage keys
const STORAGE_POSTS_KEY = 'm3_padlet_local_posts';
const STORAGE_CONFIG_KEY = 'm3_padlet_firebase_config';

// Initialize App
function init() {
  loadThemePreference();
  setupEventListeners();
  setupColorPicker();
  setupCategoryFilters();
  initFirebaseOrLocal();
}

// Setup Event Listeners
function setupEventListeners() {
  openNewPostBtn.addEventListener('click', () => {
    if (currentUser && !authorInput.value) {
      authorInput.value = currentUser.displayName || '';
    }
    openModal(postModal);
  });
  fabNewPostBtn.addEventListener('click', () => {
    if (currentUser && !authorInput.value) {
      authorInput.value = currentUser.displayName || '';
    }
    openModal(postModal);
  });
  closeModalBtn.addEventListener('click', () => closeModal(postModal));
  cancelModalBtn.addEventListener('click', () => closeModal(postModal));

  settingsBtn.addEventListener('click', () => {
    loadSavedConfigToInputs();
    openModal(configModal);
  });
  closeConfigModalBtn.addEventListener('click', () => closeModal(configModal));

  // Google Login & Logout Events
  googleLoginBtn.addEventListener('click', handleGoogleLogin);
  googleLogoutBtn.addEventListener('click', handleGoogleLogout);

  // Form Submissions
  postForm.addEventListener('submit', handleNewPostSubmit);
  configForm.addEventListener('submit', handleConfigSubmit);
  resetConfigBtn.addEventListener('click', handleResetConfig);

  // Search filter
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderPosts();
  });

  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Category filter chip handling
function setupCategoryFilters() {
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      renderPosts();
    });
  });
}

// Color Palette selection
function setupColorPicker() {
  const colorOptions = palettePicker.querySelectorAll('.color-option');
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      colorOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedColor = option.dataset.color;
    });
  });
}

// Modal helper
function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

// Theme handling
function loadThemePreference() {
  const savedTheme = localStorage.getItem('m3_padlet_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('m3_padlet_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
}

// Firebase Init or Local Fallback
function initFirebaseOrLocal() {
  const savedConfigStr = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (savedConfigStr) {
    try {
      const config = JSON.parse(savedConfigStr);
      if (config.apiKey && config.projectId) {
        app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);

        // Auth state listener
        onAuthStateChanged(auth, (user) => {
          currentUser = user;
          updateAuthUI(user);
        });

        syncStatusText.textContent = `Firebase Cloud DB 연결됨 (${config.projectId})`;
        listenToFirestore();
        return;
      }
    } catch (err) {
      console.error('Firebase 초기화 실패, 로컬 모드로 전환합니다:', err);
    }
  }

  // Fallback to LocalStorage
  syncStatusText.textContent = '로컬 브라우저 저장소 모드 (상단 [DB 설정]에서 Firebase 연결 가능)';
  loadLocalPosts();
}

// Google Login Handler
async function handleGoogleLogin() {
  if (!auth) {
    alert('Firebase가 아직 설정되지 않았습니다. 상단 [DB 설정]에서 먼저 키를 연결하거나 구글 콘솔에서 Auth를 활성화해 주세요!');
    openModal(configModal);
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    updateAuthUI(currentUser);
    alert(`환영합니다, ${currentUser.displayName}님! 🎉`);
  } catch (error) {
    console.error("Google 로그인 실패:", error);
    alert(`로그인 실패: ${error.message}`);
  }
}

// Google Logout Handler
async function handleGoogleLogout() {
  if (!auth) return;
  try {
    await signOut(auth);
    currentUser = null;
    updateAuthUI(null);
    alert('로그아웃되었습니다.');
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

// Update Auth UI
function updateAuthUI(user) {
  if (user) {
    userProfileArea.style.display = 'flex';
    userAvatar.src = user.photoURL || 'https://www.gstatic.com/images/branding/product/1x/avatar_square_blue_512dp.png';
    userName.textContent = user.displayName || '구글 사용자';
    googleLoginBtn.style.display = 'none';
    googleLogoutBtn.style.display = 'flex';
    if (authorInput) {
      authorInput.value = user.displayName || '';
    }
  } else {
    userProfileArea.style.display = 'none';
    googleLoginBtn.style.display = 'flex';
    googleLogoutBtn.style.display = 'none';
  }
}

function loadLocalPosts() {
  const raw = localStorage.getItem(STORAGE_POSTS_KEY);
  if (raw) {
    try {
      posts = JSON.parse(raw);
    } catch (e) {
      posts = initialSamplePosts;
    }
  } else {
    posts = initialSamplePosts;
    localStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(posts));
  }
  renderPosts();
}

function saveLocalPosts() {
  localStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(posts));
}

// Firestore Realtime Listener
function listenToFirestore() {
  if (!db) return;
  try {
    const q = query(collection(db, "board_posts"), orderBy("createdAt", "desc"));
    if (unsubscribeFirestore) unsubscribeFirestore();

    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach(docSnap => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      posts = fetched;
      renderPosts();
    }, (error) => {
      console.warn("Firestore 실시간 리스너 오류, 로컬 모드로 복구합니다:", error);
      syncStatusText.textContent = "Firebase 권한 대기 중 (로컬 저장소로 자동 동기화)";
      loadLocalPosts();
    });
  } catch (err) {
    console.error("Firestore 연결 오류:", err);
  }
}

// Handle Form Submission
async function handleNewPostSubmit(e) {
  e.preventDefault();
  const author = authorInput.value.trim();
  const category = categorySelect.value;
  const content = contentInput.value.trim();

  if (!author || !content) return;

  const newPost = {
    author,
    category,
    content,
    color: selectedColor,
    likes: 0,
    createdAt: new Date().toISOString()
  };

  if (db) {
    try {
      await addDoc(collection(db, "board_posts"), {
        ...newPost,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Firestore 저장 실패, 로컬에 저장합니다:", err);
      posts.unshift({ id: 'local-' + Date.now(), ...newPost });
      saveLocalPosts();
      renderPosts();
    }
  } else {
    posts.unshift({ id: 'local-' + Date.now(), ...newPost });
    saveLocalPosts();
    renderPosts();
  }

  // Reset form & close modal
  postForm.reset();
  closeModal(postModal);
}

// Handle Reactions (Likes)
async function handleLikePost(postId) {
  if (db && !postId.startsWith('sample-') && !postId.startsWith('local-')) {
    try {
      const postRef = doc(db, "board_posts", postId);
      await updateDoc(postRef, {
        likes: increment(1)
      });
      return;
    } catch (err) {
      console.warn("Firebase 좋아요 업데이트 실패, 로컬 반영:", err);
    }
  }

  // Local update
  const target = posts.find(p => p.id === postId);
  if (target) {
    target.likes = (target.likes || 0) + 1;
    saveLocalPosts();
    renderPosts();
  }
}

// Handle Delete Post
async function handleDeletePost(postId) {
  if (!confirm('이 포스트잇을 삭제하시겠어요?')) return;

  if (db && !postId.startsWith('sample-') && !postId.startsWith('local-')) {
    try {
      await deleteDoc(doc(db, "board_posts", postId));
      return;
    } catch (err) {
      console.warn("Firestore 삭제 실패, 로컬 삭제 진행:", err);
    }
  }

  posts = posts.filter(p => p.id !== postId);
  saveLocalPosts();
  renderPosts();
}

// Config Modal Handlers
function loadSavedConfigToInputs() {
  const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      document.getElementById('apiKeyInput').value = cfg.apiKey || '';
      document.getElementById('projectIdInput').value = cfg.projectId || '';
      document.getElementById('appIdInput').value = cfg.appId || '';
    } catch (e) {}
  }
}

function handleConfigSubmit(e) {
  e.preventDefault();
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  const projectId = document.getElementById('projectIdInput').value.trim();
  const appId = document.getElementById('appIdInput').value.trim();

  if (apiKey && projectId) {
    const config = { apiKey, projectId, appId };
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    closeModal(configModal);
    location.reload();
  } else {
    alert('API Key와 Project ID를 입력해 주세요!');
  }
}

function handleResetConfig() {
  localStorage.removeItem(STORAGE_CONFIG_KEY);
  closeModal(configModal);
  location.reload();
}

// Render Board Cards
function renderPosts() {
  postsGrid.innerHTML = '';

  const filteredPosts = posts.filter(post => {
    const matchCategory = currentCategory === 'all' || post.category === currentCategory;
    const matchSearch = !searchQuery || 
      post.author.toLowerCase().includes(searchQuery) || 
      post.content.toLowerCase().includes(searchQuery) ||
      (post.category && post.category.toLowerCase().includes(searchQuery));
    return matchCategory && matchSearch;
  });

  postCountBadge.textContent = `총 ${filteredPosts.length}개의 게시물`;

  if (filteredPosts.length === 0) {
    postsGrid.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">auto_awesome</span>
        <h3>아직 등록된 이야기가 없어요!</h3>
        <p>첫 번째로 멋진 생각이나 이야기를 포스트잇으로 붙여보세요.</p>
      </div>
    `;
    return;
  }

  filteredPosts.forEach(post => {
    const card = createPostCardElement(post);
    postsGrid.appendChild(card);
  });
}

function createPostCardElement(post) {
  const card = document.createElement('div');
  card.className = `post-card color-${post.color || 'yellow'}`;

  // Tonal theme colors
  const colorMap = {
    yellow: { bg: 'var(--card-pastel-yellow)', border: 'var(--card-pastel-yellow-border)' },
    blue: { bg: 'var(--card-pastel-blue)', border: 'var(--card-pastel-blue-border)' },
    pink: { bg: 'var(--card-pastel-pink)', border: 'var(--card-pastel-pink-border)' },
    green: { bg: 'var(--card-pastel-green)', border: 'var(--card-pastel-green-border)' },
    purple: { bg: 'var(--card-pastel-purple)', border: 'var(--card-pastel-purple-border)' }
  };

  const currentThemeColor = colorMap[post.color] || colorMap.yellow;
  card.style.setProperty('--card-bg', currentThemeColor.bg);
  card.style.setProperty('--card-border', currentThemeColor.border);

  // Avatar initial
  const initial = post.author ? post.author.charAt(0).toUpperCase() : '😊';
  
  // Date formatting
  let formattedDate = '방금 전';
  if (post.createdAt) {
    const dateObj = typeof post.createdAt.toDate === 'function' ? post.createdAt.toDate() : new Date(post.createdAt);
    if (!isNaN(dateObj.getTime())) {
      formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    }
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="author-info">
        <div class="author-avatar">${initial}</div>
        <div class="author-meta">
          <span class="author-name">${escapeHtml(post.author)}</span>
          <span class="post-date">${formattedDate}</span>
        </div>
      </div>
      <span class="post-tag">${escapeHtml(post.category || '💡 아이디어')}</span>
    </div>

    <div class="card-body">
      ${escapeHtml(post.content)}
    </div>

    <div class="card-footer">
      <button class="reaction-btn" data-post-id="${post.id}">
        <span>❤️</span>
        <span class="like-count">${post.likes || 0}</span>
      </button>

      <button class="card-delete-btn" data-post-id="${post.id}" title="삭제">
        <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
      </button>
    </div>
  `;

  // Attach card event listeners
  const likeBtn = card.querySelector('.reaction-btn');
  likeBtn.addEventListener('click', () => handleLikePost(post.id));

  const deleteBtn = card.querySelector('.card-delete-btn');
  deleteBtn.addEventListener('click', () => handleDeletePost(post.id));

  return card;
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start
init();
