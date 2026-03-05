import { SUBJECTS } from './constants.js';
import { createTopic, deleteTopic, getTopics, initTopicsFromSeed, saveTopic, toggleTopicStatus, updateTopic } from './storage.js';
import { subjectCode } from './ui.js';

export async function ensureTopicsCatalogReady() {
  await initTopicsFromSeed();
}

export function getTopicsCatalog({ activeOnly = false, subject = 'all', status = 'all', search = '' } = {}) {
  let topics = getTopics({ activeOnly });
  if (subject !== 'all') topics = topics.filter((topic) => topic.subject === subject);
  if (status !== 'all') topics = topics.filter((topic) => topic.status === status);
  if (search) {
    const needle = search.toLowerCase();
    topics = topics.filter((topic) => `${topic.name} ${topic.subject} ${topic.grade}`.toLowerCase().includes(needle));
  }
  return topics;
}

export function canCreateTopic({ name, subject, ignoreId = null }) {
  const normalizedName = String(name ?? '').trim().toLowerCase();
  const normalizedSubject = String(subject ?? '').trim();
  if (!normalizedName) return false;

  return !getTopics().some(
    (topic) =>
      topic.id !== ignoreId &&
      topic.subject === normalizedSubject &&
      String(topic.name ?? '').trim().toLowerCase() === normalizedName
  );
}

export function saveCatalogTopic(payload) {
  return saveTopic(payload);
}

export function createCatalogTopic(payload) {
  return createTopic(payload);
}

export function updateCatalogTopic(topicId, patch) {
  return updateTopic(topicId, patch);
}

export function toggleCatalogTopicStatus(topicId) {
  const topic = getTopics().find((item) => item.id === topicId);
  if (!topic) return null;
  return toggleTopicStatus(topicId, topic.status === 'active' ? 'inactive' : 'active');
}

export function deleteCatalogTopic(topicId) {
  deleteTopic(topicId);
}

export function subjectFilterOptions() {
  return SUBJECTS.map((label) => ({ value: subjectCode(label), label }));
}
