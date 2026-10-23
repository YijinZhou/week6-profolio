/* ==========================================================================
   Personal Website — Shared JavaScript
   Handles: mobile nav toggle, active nav link, contact form submission
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Mobile navigation toggle ---------- */
  function initNav() {
    var toggle = document.querySelector('.nav__toggle');
    var links  = document.querySelector('.nav__links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('is-open');
      toggle.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu when a link is clicked (mobile UX)
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!links.contains(e.target) && !toggle.contains(e.target)) {
        links.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Highlight active nav link ---------- */
  function highlightActive() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === '') path = 'index.html';
    document.querySelectorAll('.nav__links a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === path) a.classList.add('is-active');
    });
  }

  /* ---------- Contact form (demo handler) ---------- */
  function initContactForm() {
    var form = document.querySelector('#contact-form');
    if (!form) return;

    var notice = document.querySelector('.form__notice');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var name = (form.querySelector('#name') || {}).value || 'there';
      notice.textContent = 'Thanks, ' + name + '! Your message is on its way. I\u2019ll get back to you soon. \u2728';
      notice.classList.add('is-visible');
      form.reset();

      // Auto-hide after a while
      setTimeout(function () { notice.classList.remove('is-visible'); }, 6000);
    });
  }

  /* ---------- To-do list app (projects page) ---------- */
  async function initTodo() {
    var form  = document.querySelector('#todo-form');
    var list  = document.querySelector('#todo-list');
    var empty = document.querySelector('#todo-empty');
    if (!form || !list) return;

    var textInput = form.querySelector('#todo-text');
    var dateInput = form.querySelector('#todo-date');
    var prioInput = form.querySelector('#todo-priority');
    var counter  = document.querySelector('#todo-counter');

    /* ---------- Supabase client ---------- */
    var SUPABASE_URL = 'https://zqpurfpxrvzptcqyuwyy.supabase.co';
    var SUPABASE_KEY = 'sb_publishable___V-DQ0bHX8-OIzNNhYcUA_en0QfRqx';
    var sb = (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
      : null;
    var TABLE = 'todos';

    var tasks = [];

    /* ---------- DB helpers ---------- */
    async function loadTasks() {
      if (!sb) { console.warn('Supabase client not available'); return []; }
      try {
        var res = await sb.from(TABLE).select('*').order('created-at', { ascending: true });
        if (res.error) { console.error('Supabase load error:', res.error); return []; }
        return (res.data || []).map(function (row) {
          return {
            id: row.id,
            text: row.task || '',
            date: row.date || '',
            priority: normalizePriority(row.priority),
            done: !!row['is-complete']
          };
        });
      } catch (e) {
        console.error('Supabase load exception:', e);
        return [];
      }
    }

    async function dbAdd(task) {
      try {
        var res = await sb.from(TABLE).insert({
          task: task.text,
          date: task.date || null,
          'is-complete': false
        }).select();
        if (res.error) {
          console.error('Supabase insert error:', res.error);
          return { ok: false, error: res.error.message };
        }
        if (!res.data || !res.data[0]) return { ok: false, error: 'No row returned from insert' };
        return { ok: true, id: res.data[0].id };
      } catch (e) {
        console.error('Supabase insert exception:', e);
        return { ok: false, error: e.message };
      }
    }

    async function dbDelete(id) {
      var res = await sb.from(TABLE).delete().eq('id', id);
      if (res.error) console.error('Supabase delete error:', res.error);
    }

    async function dbUpdate(id, patch) {
      var res = await sb.from(TABLE).update(patch).eq('id', id);
      if (res.error) console.error('Supabase update error:', res.error);
    }

    function fmtDate(iso) {
      if (!iso) return '';
      var d = new Date(iso + 'T00:00:00');
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function normalizePriority(p) {
      return (p === 'low' || p === 'high') ? p : 'medium';
    }
    function makeEditable(span, i) {
      var original = '';

      span.title = 'Click to edit';

      span.addEventListener('click', function () {
        if (span.isContentEditable) return;
        original = span.textContent;
        span.setAttribute('contenteditable', 'true');
        span.focus();
        var range = document.createRange();
        range.selectNodeContents(span);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });

      span.addEventListener('keydown', function (e) {
        if (!span.isContentEditable) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          span.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          span.textContent = original;
          span.blur();
        }
      });

      span.addEventListener('blur', function () {
        if (!span.isContentEditable) return;
        var next = span.textContent.trim();
        span.removeAttribute('contenteditable');
        if (next && next !== tasks[i].text) {
          var taskId = tasks[i].id;
          tasks[i].text = next;
          dbUpdate(taskId, { task: next });
        } else {
          span.textContent = tasks[i].text;
        }
      });
    }
    function updateCounter() {
      if (!counter) return;
      var done = tasks.filter(function (t) { return t.done; }).length;
      var total = tasks.length;
      var word = total === 1 ? 'task' : 'tasks';
      counter.textContent = done + ' of ' + total + ' ' + word + ' completed';
    }

    function render() {
      list.innerHTML = '';
      tasks.forEach(function (t, i) {
        var li = document.createElement('li');
        li.className = 'todo__item' + (t.done ? ' is-done' : '');

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'todo__checkbox';
        cb.checked = t.done;
        cb.setAttribute('aria-label', 'Mark task done');
        cb.addEventListener('change', function () {
          var taskId = tasks[i].id;
          tasks[i].done = cb.checked;
          dbUpdate(taskId, { 'is-complete': cb.checked });
          li.classList.toggle('is-done', cb.checked);
          updateCounter();
        });

        var span = document.createElement('span');
        span.className = 'todo__text';
        span.textContent = t.text;
        makeEditable(span, i);

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'todo__delete';
        del.setAttribute('aria-label', 'Delete task');
        del.innerHTML = '&times;';
        del.addEventListener('click', function () {
          var taskId = tasks[i].id;
          tasks.splice(i, 1);
          render();
          dbDelete(taskId);
        });

        li.appendChild(cb);
        li.appendChild(span);

        var prio = normalizePriority(t.priority);
        var prioPill = document.createElement('span');
        prioPill.className = 'todo__priority todo__priority--' + prio;
        prioPill.textContent = prio;
        li.appendChild(prioPill);

        if (t.date) {
          var date = document.createElement('span');
          date.className = 'todo__date';
          date.textContent = fmtDate(t.date);
          li.appendChild(date);
        }
        li.appendChild(del);
        list.appendChild(li);
      });
      if (empty) empty.style.display = tasks.length ? 'none' : 'block';
      updateCounter();
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = textInput.value.trim();
      if (!text) { form.reportValidity(); return; }

      var taskData = {
        text: text,
        date: dateInput.value,
        priority: normalizePriority(prioInput ? prioInput.value : 'medium'),
        done: false
      };

      var result = await dbAdd(taskData);
      if (!result.ok) {
        alert('Failed to add task:\n' + result.error);
        return;
      }

      tasks.push({
        id: result.id,
        text: taskData.text,
        date: taskData.date,
        priority: taskData.priority,
        done: false
      });

      textInput.value = '';
      dateInput.value = '';
      if (prioInput) prioInput.value = 'medium';
      textInput.focus();
      render();
    });

    tasks = await loadTasks();
    render();
  }

  /* ---------- Init on DOM ready ---------- */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initNav();
    highlightActive();
    initContactForm();
    initTodo();
  });
})();
