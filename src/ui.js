import { DIFFICULTIES, SUBJECTS } from './constants.js';

const SUBJECT_CODE_TO_LABEL = {
  math: SUBJECTS[0],
  physics: SUBJECTS[1]
};

const SUBJECT_LABEL_TO_CODE = {
  [SUBJECTS[0]]: 'math',
  [SUBJECTS[1]]: 'physics'
};

const DIFFICULTY_CODE_TO_LABEL = {
  easy: DIFFICULTIES[0],
  medium: DIFFICULTIES[1],
  hard: DIFFICULTIES[2]
};

const DIFFICULTY_LABEL_TO_CODE = {
  [DIFFICULTIES[0]]: 'easy',
  [DIFFICULTIES[1]]: 'medium',
  [DIFFICULTIES[2]]: 'hard'
};

export const subjectLabel = (value) => SUBJECT_CODE_TO_LABEL[value] ?? value;
export const difficultyLabel = (value) => DIFFICULTY_CODE_TO_LABEL[value] ?? value;

export const subjectCode = (labelOrCode) => SUBJECT_LABEL_TO_CODE[labelOrCode] ?? labelOrCode;
export const difficultyCode = (labelOrCode) => DIFFICULTY_LABEL_TO_CODE[labelOrCode] ?? labelOrCode;

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
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 220);
  }, 2200);
}


const STATUS_LABELS = {
  draft: 'Rascunho',
  published: 'Publicado',
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
  pending: 'Pendente',
  mastered: 'Dominado',
  open: 'Em aberto',
  answered: 'Respondido',
  hidden: 'Oculto',
  resolved: 'Resolvido',
  ignored: 'Ignorado'
};

const ROLE_LABELS = {
  admin: 'administrador',
  student: 'aluno'
};

export function statusLabel(value) {
  return STATUS_LABELS[value] ?? value;
}

export function roleLabel(value) {
  return ROLE_LABELS[value] ?? value;
}
