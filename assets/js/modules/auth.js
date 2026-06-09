import { getSupabase } from '../data/supabase.js';
import { SITE_URL } from '../data/constants.js';
import { toast } from './toast.js';
import { byId } from '../utils/dom.js';
import { getRaw, setRaw } from '../utils/storage.js';
import { AGE_KEY } from '../data/products.js';

let currentUser = null;
let authInited = false;

/* ── Age gate (auth pages) ── */
export function initAuthGate() {
  const gate = byId('authAgeGate');
  if (!gate) return;
  if (getRaw(AGE_KEY) === 'true') { gate.style.display = 'none'; return; }
  gate.classList.add('is-visible');
  byId('authAgeYes')?.addEventListener('click', () => {
    setRaw(AGE_KEY, 'true');
    gate.classList.remove('is-visible');
  });
  byId('authAgeNo')?.addEventListener('click', () => { window.location.href = '/access-denied.html'; });
}

/* ── Auth state ── */
export function initAuth() {
  if (authInited) return;
  authInited = true;
  getSupabase().then(supabase => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUser = session?.user ?? null;
      updateAuthUI();
    });
    supabase.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user ?? null;
      updateAuthUI();
      if (event === 'PASSWORD_RECOVERY' && !window.location.pathname.includes('update-password')) {
        window.location.href = '/update-password.html';
      }
    });
    setupUpdatePassword();
  }).catch(err => console.error('Auth init failed', err));
}

function updateAuthUI() {
  const link = byId('authHeaderLink');
  const label = byId('authHeaderLabel');
  if (!link || !label) return;
  if (currentUser) {
    const email = currentUser.email || '';
    const display = email.length > 22 ? email.slice(0, 20) + '\u2026' : email;
    link.href = '#';
    label.textContent = display;
    link.onclick = e => { e.preventDefault(); doSignOut(); };
  } else {
    link.href = '/signin.html';
    label.textContent = 'Account';
    link.onclick = null;
  }
}

function doSignOut() {
  getSupabase().then(s => s.auth.signOut().then(() => {
    toast('Signed out', 'You have been signed out.', 'success');
    if (window.location.pathname.includes('update-password')) {
      window.location.href = '/signin.html';
    }
  }).catch(console.error));
}

export function signOut() {
  doSignOut();
}

/* ── Sign in ── */
export function setupSignInForm() {
  const form = byId('signinForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const forgotSection = byId('forgotSection');
    if (forgotSection && forgotSection.style.display !== 'none') return;
    const email = byId('si_email')?.value.trim();
    const password = byId('si_password')?.value;
    const msg = byId('signinMsg');
    const btn = form.querySelector('.auth-submit');
    if (!email || !password) {
      if (msg) { msg.textContent = 'Please fill in all fields.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (msg) msg.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (msg) { msg.textContent = error.message; msg.style.color = 'var(--danger)'; }
        if (btn) btn.disabled = false;
        return;
      }
      toast('Signed in', 'Redirecting\u2026', 'success');
      setTimeout(() => { window.location.href = '/'; }, 600);
    } catch {
      if (msg) { msg.textContent = 'Network error \u2014 please try again.'; msg.style.color = 'var(--danger)'; }
      if (btn) btn.disabled = false;
    }
  });
}

/* ── Sign up ── */
export function setupSignUpForm() {
  const form = byId('signupForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const firstName = byId('su_firstName')?.value.trim();
    const lastName = byId('su_lastName')?.value.trim();
    const email = byId('su_email')?.value.trim();
    const password = byId('su_password')?.value;
    const terms = byId('su_terms')?.checked;
    const research = byId('su_research')?.checked;
    const msg = byId('signupMsg');
    const btn = form.querySelector('.auth-submit');
    if (!firstName || !lastName || !email || !password) {
      if (msg) { msg.textContent = 'Please fill in all fields.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (password.length < 8) {
      if (msg) { msg.textContent = 'Password must be at least 8 characters.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (!terms) {
      if (msg) { msg.textContent = 'Please agree to the Terms of Service.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (!research) {
      if (msg) { msg.textContent = 'Please confirm research use only.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (msg) msg.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } }
      });
      if (error) {
        if (msg) { msg.textContent = error.message; msg.style.color = 'var(--danger)'; }
        if (btn) btn.disabled = false;
        return;
      }
      if (msg) { msg.textContent = 'Check your email for a confirmation link.'; msg.style.color = 'var(--success)'; }
      if (btn) { btn.textContent = 'Account created!'; btn.disabled = true; }
    } catch {
      if (msg) { msg.textContent = 'Network error \u2014 please try again.'; msg.style.color = 'var(--danger)'; }
      if (btn) btn.disabled = false;
    }
  });
}

/* ── Password strength indicator ── */
export function setupPasswordStrength() {
  const pwd = byId('su_password');
  if (!pwd) return;
  pwd.addEventListener('input', () => {
    const val = pwd.value;
    const bars = ['str1', 'str2', 'str3', 'str4'].map(id => byId(id));
    const text = byId('passwordStrengthText');
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;
    bars.forEach((bar, i) => {
      if (!bar) return;
      bar.className = 'password-strength-bar';
      if (val.length === 0) return;
      if (i < score) {
        if (score <= 1) bar.classList.add('is-active');
        else if (score === 2) bar.classList.add('is-medium');
        else bar.classList.add('is-strong');
      }
    });
    if (text) {
      if (val.length === 0) text.textContent = '';
      else if (score <= 1) text.textContent = 'Weak';
      else if (score === 2) text.textContent = 'Fair';
      else if (score === 3) text.textContent = 'Good';
      else text.textContent = 'Strong';
    }
  });
}

/* ── Google OAuth ── */
export function setupGoogleAuth() {
  ['googleSignIn', 'googleSignUp'].forEach(id => {
    const btn = byId(id);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const supabase = await getSupabase();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: SITE_URL }
        });
        if (error) { toast('Sign-in failed', error.message, 'error'); btn.disabled = false; }
      } catch (err) { toast('Sign-in failed', err.message, 'error'); btn.disabled = false; }
    });
  });
}

/* ── Forgot password ── */
export function setupForgotPassword() {
  const link = byId('forgotPwdLink');
  if (!link) return;
  const forgotSection = byId('forgotSection');
  const signinFields = byId('signinFields');
  if (!forgotSection || !signinFields) return;
  link.addEventListener('click', e => {
    e.preventDefault();
    signinFields.style.display = 'none';
    forgotSection.style.display = 'block';
  });
  byId('forgotBackBtn')?.addEventListener('click', () => {
    forgotSection.style.display = 'none';
    signinFields.style.display = '';
  });
  byId('forgotSendBtn')?.addEventListener('click', async () => {
    const email = byId('forgotEmail')?.value.trim();
    const msg = byId('forgotMsg');
    const btn = byId('forgotSendBtn');
    if (!email) {
      if (msg) { msg.textContent = 'Please enter your email.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (msg) msg.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: SITE_URL + '/update-password.html'
      });
      if (error) {
        if (msg) { msg.textContent = error.message; msg.style.color = 'var(--danger)'; }
        if (btn) btn.disabled = false;
        return;
      }
      if (msg) { msg.textContent = 'Check your email for a reset link.'; msg.style.color = 'var(--success)'; }
      if (btn) btn.textContent = 'Email sent!';
    } catch {
      if (msg) { msg.textContent = 'Network error \u2014 please try again.'; msg.style.color = 'var(--danger)'; }
      if (btn) btn.disabled = false;
    }
  });
}

/* ── Update password (after reset) ── */
export function setupUpdatePassword() {
  const form = byId('updatePwdForm');
  if (!form) return;
  const msg = byId('updatePwdMsg');
  const btn = byId('updatePwdBtn');
  getSupabase().then(supabase => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (msg) { msg.textContent = 'Invalid or expired reset link. Please request a new one.'; msg.style.color = 'var(--danger)'; }
        if (btn) btn.disabled = true;
      }
    });
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const password = byId('newPassword')?.value;
    const confirm = byId('confirmPassword')?.value;
    if (!password || password.length < 8) {
      if (msg) { msg.textContent = 'Password must be at least 8 characters.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (password !== confirm) {
      if (msg) { msg.textContent = 'Passwords do not match.'; msg.style.color = 'var(--danger)'; }
      return;
    }
    if (msg) msg.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (msg) { msg.textContent = error.message; msg.style.color = 'var(--danger)'; }
        if (btn) btn.disabled = false;
        return;
      }
      if (msg) { msg.textContent = 'Password updated! Redirecting\u2026'; msg.style.color = 'var(--success)'; }
      setTimeout(() => { window.location.href = '/signin.html?reset=success'; }, 1500);
    } catch {
      if (msg) { msg.textContent = 'Network error \u2014 please try again.'; msg.style.color = 'var(--danger)'; }
      if (btn) btn.disabled = false;
    }
  });
}

/* ── Backward compat ── */
export function setupAuthForms() {
  setupSignInForm();
  setupSignUpForm();
}
