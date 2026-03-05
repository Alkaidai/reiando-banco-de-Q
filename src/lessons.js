import { safeText } from './ui.js';

let lessonsCache = null;

function normalizeLesson(item) {
  return {
    id: String(item?.id ?? ''),
    title: String(item?.title ?? '').trim(),
    url: String(item?.url ?? '').trim(),
    topic: String(item?.topic ?? '').trim(),
    subject: item?.subject ? String(item.subject).trim() : null,
    grade: item?.grade ? String(item.grade).trim() : null,
    provider: item?.provider ? String(item.provider).trim() : null
  };
}

export async function loadLessons() {
  if (lessonsCache) return lessonsCache;
  try {
    const response = await fetch('./data/lessons.seed.json');
    const raw = await response.json();
    lessonsCache = Array.isArray(raw) ? raw.map(normalizeLesson).filter((lesson) => lesson.id && lesson.title && lesson.url && lesson.topic) : [];
  } catch {
    lessonsCache = [];
  }
  return lessonsCache;
}

export function getLessonsForQuestion(question) {
  if (!question) return [];
  const all = lessonsCache ?? [];
  return all.filter((lesson) => {
    if (lesson.topic !== question.topicId) return false;
    if (lesson.subject && lesson.subject !== question.subject) return false;
    if (lesson.grade && lesson.grade !== question.grade) return false;
    return true;
  });
}

export function renderLessons(containerEl, lessons) {
  if (!containerEl) return;
  if (!Array.isArray(lessons) || !lessons.length) {
    containerEl.innerHTML = '<p class="muted">Nenhuma aula cadastrada para este tópico.</p>';
    return;
  }

  containerEl.innerHTML = `<ul>${lessons
    .map(
      (lesson) => `<li><a href="${safeText(lesson.url)}" target="_blank" rel="noopener noreferrer">${safeText(lesson.title)}</a>${lesson.provider ? ` <small>(${safeText(lesson.provider)})</small>` : ''}</li>`
    )
    .join('')}</ul>`;
}
