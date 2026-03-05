import { DIFFICULTIES, SUBJECTS } from './constants.js';

export const subjectLabel = (value) => SUBJECTS.find((s) => s.value === value)?.label ?? value;
export const difficultyLabel = (value) => DIFFICULTIES.find((d) => d.value === value)?.label ?? value;

export function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

export function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function optionLetter(index) {
  return String.fromCharCode(65 + index);
}

export function showToast(message) {
  const root = document.querySelector('#toastRoot');
  if (!root) {
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 220);
  }, 2200);
}
