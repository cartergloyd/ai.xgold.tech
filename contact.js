/* ═══════════════════════════════════════════════════════════════════
   BOOKING PAGE — contact.js
   Three-step flow: date picker → details form → confirmation.

   API (served by server/index.js):
     GET  /api/availability           → { dates: ["YYYY-MM-DD", …] }
     GET  /api/availability?date=…    → { slots: [{ id, start_time, end_time }] }
     POST /api/bookings               → { name, email, topic, slotId }
                                      ← 201 { ok: true, booking: {…} }

   Set window.BOOKING_API_BASE before this script loads to point at
   a deployed server. Falls back to http://localhost:3001.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ───────────────────────────────────────────────────── */
  var API = (typeof window.BOOKING_API_BASE === 'string')
    ? window.BOOKING_API_BASE.replace(/\/$/, '')
    : 'http://localhost:3001';

  var EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── State ────────────────────────────────────────────────────── */
  var state = {
    selectedDate: null,           // "YYYY-MM-DD"
    selectedSlot: null,           // { id, start_time, end_time }
    currentStep: 1,
  };

  /* ── DOM refs ─────────────────────────────────────────────────── */
  var step1El      = document.getElementById('step-1');
  var step2El      = document.getElementById('step-2');
  var step3El      = document.getElementById('step-3');
  var dateGrid     = document.getElementById('date-grid');
  var slotSection  = document.getElementById('slot-section');
  var slotGrid     = document.getElementById('slot-grid');
  var slotHeading  = document.getElementById('slot-heading');
  var step1Next    = document.getElementById('step1-next');
  var step2Back    = document.getElementById('step2-back');
  var bookingForm  = document.getElementById('booking-form');
  var btnSubmit    = document.getElementById('btn-submit');
  var formErrorEl  = document.getElementById('form-error');
  var confirmTime  = document.getElementById('confirm-time');
  var confirmEmail = document.getElementById('confirm-email');

  /* ── Step transitions ─────────────────────────────────────────── */
  // Initialize: only step 1 visible
  step2El.style.display = 'none';
  step3El.style.display = 'none';

  function goToStep(n, direction) {
    var from = [null, step1El, step2El, step3El][state.currentStep];
    var to   = [null, step1El, step2El, step3El][n];
    var dir  = direction || (n > state.currentStep ? 'forward' : 'back');
    var outY = dir === 'forward' ? '-10px' : '10px';
    var inY  = dir === 'forward' ? '10px'  : '-10px';

    if (reduced) {
      from.style.display = 'none';
      to.style.display = '';
      state.currentStep = n;
      return;
    }

    from.style.transition = 'opacity 340ms ' + EASE + ', transform 340ms ' + EASE;
    from.style.opacity    = '0';
    from.style.transform  = 'translateY(' + outY + ')';

    setTimeout(function () {
      from.style.display = 'none';
      from.style.cssText = '';

      to.style.opacity   = '0';
      to.style.transform = 'translateY(' + inY + ')';
      to.style.display   = '';

      void to.offsetHeight; // force reflow before transition

      to.style.transition = 'opacity 420ms ' + EASE + ', transform 420ms ' + EASE;
      to.style.opacity    = '1';
      to.style.transform  = 'translateY(0)';
      state.currentStep   = n;
    }, 360);
  }

  /* ── Date / time formatters ───────────────────────────────────── */
  // Parse "YYYY-MM-DD" at noon to avoid DST edge-cases
  function parseDate(dateStr) {
    return new Date(dateStr + 'T12:00:00');
  }

  function fmtDateBtn(dateStr) {
    var d = parseDate(dateStr);
    return {
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      label:   d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  }

  function fmtDateLong(dateStr) {
    var d = parseDate(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function fmtTime(isoStr) {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }

  /* ── Load available dates ─────────────────────────────────────── */
  function loadDates() {
    setDateState('<p class="state-msg state-msg--loading">Loading available dates…</p>');

    fetch(API + '/api/availability')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) { renderDates(data.dates || []); })
      .catch(function () {
        setDateState('<p class="state-msg state-msg--error">Couldn\'t load dates. Please refresh or <a href="mailto:hello@xgold.tech">email us</a>.</p>');
      });
  }

  function setDateState(html) {
    dateGrid.innerHTML = html;
  }

  function renderDates(dates) {
    if (!dates.length) {
      setDateState('<p class="state-msg state-msg--empty">No available dates right now — check back soon.</p>');
      return;
    }

    dateGrid.innerHTML = '';
    dates.forEach(function (dateStr) {
      var parts = fmtDateBtn(dateStr);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'date-btn';
      btn.dataset.date = dateStr;
      btn.setAttribute('aria-label', fmtDateLong(dateStr));

      var wkEl = document.createElement('span');
      wkEl.className = 'date-weekday';
      wkEl.textContent = parts.weekday;

      var dayEl = document.createElement('span');
      dayEl.className = 'date-day';
      dayEl.textContent = parts.label;

      btn.appendChild(wkEl);
      btn.appendChild(dayEl);
      btn.addEventListener('click', function () { onDateClick(dateStr, btn); });
      dateGrid.appendChild(btn);
    });
  }

  /* ── Date selection → load slots ──────────────────────────────── */
  function onDateClick(dateStr, btn) {
    document.querySelectorAll('.date-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');

    state.selectedDate = dateStr;
    state.selectedSlot = null;
    setNextEnabled(false);

    loadSlots(dateStr);
  }

  function loadSlots(dateStr) {
    slotHeading.textContent = fmtDateLong(dateStr);
    slotGrid.innerHTML = '<p class="state-msg state-msg--loading">Loading times…</p>';
    slotSection.classList.add('visible');

    fetch(API + '/api/availability?date=' + dateStr)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) { renderSlots(data.slots || []); })
      .catch(function () {
        slotGrid.innerHTML = '<p class="state-msg state-msg--error">Couldn\'t load times. Try another date.</p>';
      });
  }

  function renderSlots(slots) {
    if (!slots.length) {
      slotGrid.innerHTML = '<p class="state-msg state-msg--empty">No open times for this date.</p>';
      return;
    }

    slotGrid.innerHTML = '';
    slots.forEach(function (slot) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = fmtTime(slot.start_time);
      btn.addEventListener('click', function () { onSlotClick(slot, btn); });
      slotGrid.appendChild(btn);
    });
  }

  function onSlotClick(slot, btn) {
    document.querySelectorAll('.slot-btn').forEach(function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    state.selectedSlot = slot;
    setNextEnabled(true);
  }

  function setNextEnabled(yes) {
    step1Next.disabled = !yes;
    step1Next.setAttribute('aria-disabled', yes ? 'false' : 'true');
  }

  /* ── Step 1 → 2 ───────────────────────────────────────────────── */
  step1Next.addEventListener('click', function () {
    if (!state.selectedSlot) return;
    goToStep(2);
  });

  /* ── Step 2 → 1 ───────────────────────────────────────────────── */
  step2Back.addEventListener('click', function () {
    clearErrors();
    goToStep(1, 'back');
  });

  /* ── Form submit: step 2 → 3 ──────────────────────────────────── */
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var name  = bookingForm.elements.name.value.trim();
    var email = bookingForm.elements.email.value.trim();
    var topic = (bookingForm.elements.topic.value || '').trim();

    var valid = true;
    if (!name) {
      showFieldError(bookingForm.elements.name, 'Please enter your name.');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(bookingForm.elements.email, 'Please enter a valid email address.');
      valid = false;
    }
    if (!state.selectedSlot) {
      setFormError('No time slot selected — please go back and pick a time.');
      valid = false;
    }
    if (!valid) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Booking…';

    fetch(API + '/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:   name,
        email:  email,
        topic:  topic,
        slotId: state.selectedSlot.id,
      }),
    })
      .then(function (r) {
        return r.json().then(function (body) { return { status: r.status, body: body }; });
      })
      .then(function (res) {
        if (res.status !== 201) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Book meeting';
          var msg = res.body.error || 'Something went wrong — please try again.';
          if (res.status === 409) {
            msg += ' Please go back and choose a different time.';
          }
          setFormError(msg);
          return;
        }

        var booking = res.body.booking;
        confirmTime.textContent  = fmtDateLong(state.selectedDate) + ' at ' + fmtTime(booking.start_time);
        confirmEmail.textContent = 'A calendar invite is on its way to ' + email + '.';
        goToStep(3);
      })
      .catch(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Book meeting';
        setFormError('Connection error — please check your network and try again.');
      });
  });

  /* ── Error helpers ────────────────────────────────────────────── */
  function showFieldError(input, msg) {
    input.classList.add('is-invalid');
    var existing = input.parentNode.querySelector('.field-error');
    if (!existing) {
      existing = document.createElement('p');
      existing.className = 'field-error';
      input.parentNode.appendChild(existing);
    }
    existing.textContent = msg;
    input.addEventListener('input', function clear() {
      input.classList.remove('is-invalid');
      existing.textContent = '';
      input.removeEventListener('input', clear);
    });
  }

  function setFormError(msg) {
    formErrorEl.textContent = msg;
  }

  function clearErrors() {
    formErrorEl.textContent = '';
    bookingForm.querySelectorAll('.booking-input').forEach(function (el) {
      el.classList.remove('is-invalid');
    });
    bookingForm.querySelectorAll('.field-error').forEach(function (el) {
      el.textContent = '';
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────── */
  loadDates();

}());
