/**
 * senior-editor-data.js — Data layer for Senior Editor pages.
 * All methods call /api/senior-editor directly. Errors propagate to the caller.
 */
(function () {
  'use strict';
  if (window.__seniorEditorData) return;
  window.__seniorEditorData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor';
  const TIMEOUT_MS = 8000;

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include', signal: controller.signal }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  window.SeniorEditorData = {
    /* Dashboard */
    getDashboard() {
      return callBackend('/dashboard');
    },
    /* Review Queue */
    getReviewQueue() {
      return callBackend('/review-queue');
    },
    updateReviewItem(id, action, feedback) {
      return callBackend('/review-queue/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback }),
      });
    },
    /* Authors */
    getAuthors() {
      return callBackend('/authors');
    },
    /* Featured Stories */
    getFeaturedStories() {
      return callBackend('/featured-stories');
    },
    /* Editor's Picks */
    getEditorsPicks() {
      return callBackend('/editors-picks');
    },
    /* Announcements */
    getAnnouncements() {
      return callBackend('/announcements');
    },
    createAnnouncement(data) {
      return callBackend('/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    /* Story Analytics */
    getStoryAnalytics() {
      return callBackend('/story-analytics');
    },
    /* Reports & Compliance */
    getReports() {
      return callBackend('/reports');
    },
    /* Communication */
    getMessages() {
      return callBackend('/messages');
    },
    /* Author Messages (conversations) */
    getAuthorMessages() {
      return callBackend('/author-messages');
    },
    /* Activity Logs */
    getActivityLogs() {
      return callBackend('/activity-logs');
    },
  };
})();
