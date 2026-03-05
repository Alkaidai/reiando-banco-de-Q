import { getLessons } from './storage.js';
import { safeText } from './ui.js';

let lessonsCache = [];

export async function loadLessons() {
  lessonsCache = getLessons();
  return lessonsCache;
}

export function getLessonsForQuestion(question) {
  if (!question) return [];
  const all = lessonsCache.length ? lessonsCache : getLessons();

  const p1 = all.filter((lesson) => lesson.topic === question.topicId && lesson.subject === question.subject);
  if (p1.length) return p1;

  const p2 = all.filter((lesson) => lesson.subject === question.subject && lesson.grade === question.grade);
  if (p2.length) return p2;

  return all.filter((lesson) => lesson.subject === question.subject);
}

export function renderLessons(containerEl, lessons) {
  if (!containerEl) return;

  if (!Array.isArray(lessons) || !lessons.length) {
    containerEl.innerHTML = '<p class="muted">Nenhuma aula recomendada para este tópico.</p>';
    return;
  }

  containerEl.innerHTML = `<ul>${lessons
    .map((lesson) => `<li><a href="${safeText(lesson.url)}" target="_blank" rel="noopener noreferrer">▶ ${safeText(lesson.title)}</a></li>`)
    .join('')}</ul>`;
}
