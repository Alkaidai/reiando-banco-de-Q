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
