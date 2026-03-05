import { createTopic, getTopics, saveQuestionsBulk } from './storage.js';
import { uid } from './ui.js';

const SUBJECT_MAP = {
  matematica: 'math',
  matemática: 'math',
  math: 'math',
  fisica: 'physics',
  física: 'physics',
  physics: 'physics'
};

const DIFFICULTY_MAP = {
  facil: 'easy',
  fácil: 'easy',
  easy: 'easy',
  media: 'medium',
  média: 'medium',
  medium: 'medium',
  dificil: 'hard',
  difícil: 'hard',
  hard: 'hard'
};

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsText(file, 'utf-8');
  });
}

function toSlug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeSubject(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return SUBJECT_MAP[key] ?? '';
}

function normalizeDifficulty(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return DIFFICULTY_MAP[key] ?? '';
}

function normalizeStatus(value, fallback = 'draft') {
  const v = String(value ?? fallback).trim().toLowerCase();
  return v === 'published' ? 'published' : 'draft';
}

function answerLetterToIndex(letter) {
  return ['A', 'B', 'C', 'D', 'E'].indexOf(String(letter ?? '').trim().toUpperCase());
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function mapExternalToRaw(item) {
  const options = Array.isArray(item.options)
    ? item.options
    : [item.A, item.B, item.C, item.D, item.E];
  return {
    id: item.id,
    grade: item.grade,
    subject: item.subject,
    difficulty: item.difficulty,
    topic: item.topic,
    statement: item.statement ?? item.text,
    options,
    answer: item.answer,
    explanation: item.explanation,
    status: item.status
  };
}

export async function parseJsonFile(file) {
  const text = await readFileAsText(file);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('JSON deve ser um array de questões.');
  return parsed.map(mapExternalToRaw);
}

export async function parseCsvFile(file) {
  const text = await readFileAsText(file);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? '';
    });
    return mapExternalToRaw(obj);
  });
}

function splitPdfIntoBlocks(text) {
  const cleaned = text.replace(/\r/g, '\n');
  const parts = cleaned
    .split(/\n(?=(?:Quest[aã]o\s*\d+|\d+[\.)]))/gi)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts;
}

function parsePdfBlock(block) {
  const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const statementLines = [];
  const options = { A: '', B: '', C: '', D: '', E: '' };
  let readingOptions = false;

  lines.forEach((line) => {
    const match = line.match(/^([A-E])[\)\.]\s*(.+)$/i);
    if (match) {
      readingOptions = true;
      options[match[1].toUpperCase()] = match[2].trim();
    } else if (!readingOptions) {
      statementLines.push(line.replace(/^(Quest[aã]o\s*\d+|\d+[\.)])\s*/i, '').trim());
    }
  });

  return {
    grade: '',
    subject: '',
    difficulty: '',
    topic: '',
    statement: statementLines.join(' ').trim(),
    options: [options.A, options.B, options.C, options.D, options.E],
    answer: '',
    explanation: '',
    status: 'draft'
  };
}

export async function parsePdfFile(file) {
  if (!window.pdfjsLib) throw new Error('PDF.js não carregado.');
  if (window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += `${pageText}\n`;
  }

  return splitPdfIntoBlocks(fullText).map(parsePdfBlock);
}

export function mapToInternalQuestion(q) {
  const options = Array.isArray(q.options) ? q.options.map((opt) => String(opt ?? '').trim()) : [];
  const answerIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : answerLetterToIndex(q.answer);

  return {
    id: String(q.id ?? uid('q')),
    grade: String(q.grade ?? '').trim(),
    subject: normalizeSubject(q.subject),
    difficulty: normalizeDifficulty(q.difficulty),
    topic: String(q.topic ?? '').trim(),
    statement: String(q.statement ?? '').trim(),
    options,
    correctIndex: answerIndex,
    explanation: String(q.explanation ?? '').trim(),
    status: normalizeStatus(q.status)
  };
}

export function normalizeAndValidate(rawQuestions) {
  const valid = [];
  const invalid = [];

  rawQuestions.forEach((raw, index) => {
    const mapped = mapToInternalQuestion(raw);
    const errors = [];

    if (!mapped.grade) errors.push('grade obrigatório');
    if (!mapped.subject) errors.push('subject inválido/obrigatório');
    if (!mapped.difficulty) errors.push('difficulty inválido/obrigatório');
    if (!mapped.topic) errors.push('topic obrigatório');
    if (!mapped.statement) errors.push('statement obrigatório');
    if (mapped.options.length !== 5 || mapped.options.some((opt) => !opt)) errors.push('faltou alternativa A-E');
    if (!(mapped.correctIndex >= 0 && mapped.correctIndex <= 4)) errors.push('answer/correctIndex inválido');

    if (errors.length) {
      invalid.push({ index, raw, mapped, errors });
    } else {
      valid.push(mapped);
    }
  });

  return { valid, invalid };
}

function resolveTopicId(questionTopic, questionSubject, questionGrade, autoCreateTopics) {
  const topics = getTopics();
  const topicRaw = String(questionTopic ?? '').trim();
  if (!topicRaw) return '';

  const byId = topics.find((topic) => topic.id === topicRaw);
  if (byId) return byId.id;

  const byName = topics.find((topic) => String(topic.name ?? '').trim().toLowerCase() === topicRaw.toLowerCase());
  if (byName) return byName.id;

  if (!autoCreateTopics) return topicRaw;

  const id = toSlug(topicRaw) || uid('topic');
  createTopic({
    id,
    name: topicRaw,
    subject: questionSubject,
    grade: questionGrade || 'all',
    status: 'active'
  });
  return id;
}

export function importQuestions(validQuestions, options = {}) {
  const autoCreateTopics = Boolean(options.autoCreateTopics);
  const importStatus = normalizeStatus(options.importStatus ?? 'draft');

  const normalized = validQuestions.map((q) => ({
    id: q.id,
    grade: q.grade,
    subject: q.subject,
    difficulty: q.difficulty,
    topicId: resolveTopicId(q.topic, q.subject, q.grade, autoCreateTopics),
    statement: q.statement,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    status: importStatus,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  return saveQuestionsBulk(normalized);
}
