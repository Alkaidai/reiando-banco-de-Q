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

  const byTopic = all.filter((lesson) => lesson.topic === question.topicId);
  if (byTopic.length) return byTopic;

  const bySubject = all.filter((lesson) => lesson.subject === question.subject);
  if (bySubject.length) return bySubject;

  return all.filter((lesson) => lesson.grade === question.grade);
}

export function renderLessons(containerEl, lessons) {
  if (!containerEl) return;

  if (!Array.isArray(lessons) || !lessons.length) {
    containerEl.innerHTML = '<p class="muted">Ainda não há aulas cadastradas para este tópico.</p>';
    return;
  }

  containerEl.innerHTML = `<div class="lessons-list">${lessons
    .map((lesson) => `<article class="review-item"><p><strong>${safeText(lesson.title)}</strong></p><a class="btn-secondary" href="${safeText(lesson.url)}" target="_blank" rel="noopener noreferrer">Assistir</a></article>`)
    .join('')}</div>`;
}
