export const STORAGE_PREFIX = 'qb_';

export const STORAGE_KEYS = {
  currentUser: `${STORAGE_PREFIX}currentUser`,
  questionBank: `${STORAGE_PREFIX}questionBank`,
  topicsBank: `${STORAGE_PREFIX}topicsBank`,
  version: `${STORAGE_PREFIX}seedVersion`,
  attempts: 'bq_attempts',
  notebook: 'bq_notebook',
  reports: 'bq_question_reports'
};

export const SEED_VERSION = '2.0.0';

export const USERS = [
  { username: 'aluno', password: 'aluno123', role: 'student' },
  { username: 'admin', password: 'admin123', role: 'admin' }
];

export const GRADES = ['7EF', '8EF', '9EF', '1EM'];
export const SUBJECTS = [
  { value: 'math', label: 'Matemática' },
  { value: 'physics', label: 'Física' }
];
export const DIFFICULTIES = [
  { value: 'easy', label: 'Fácil' },
  { value: 'medium', label: 'Média' },
  { value: 'hard', label: 'Difícil' }
];

export const COMMENT_STATUS = {
  open: 'open',
  answered: 'answered',
  hidden: 'hidden'
};
