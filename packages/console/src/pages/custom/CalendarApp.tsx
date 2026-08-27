/**
 * CalendarApp — Concrete implementation of the Calendar Page Archetype
 * Inspired by apps-calendar.html from the Aquiry reference suite.
 * Built with pure Vanilla CSS, BEM, and SAILS design tokens.
 */
import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, Clock, MapPin, Video, Users, CheckCircle, AlertCircle, X
} from 'lucide-react';
import {
  UiCard,
  UiCardHeader,
  UiCardBody,
  UiAvatar,
  UiAvatarGroup,
  UiBadge,
  UiPillTabs,
  Button
} from '../../components/ui';
import CalendarPageShell from '../../components/layout/page-templates/CalendarPageShell';
import './CalendarApp.css';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  location?: string;
  category: 'Meeting' | 'Important' | 'Confirmed' | 'Casual' | 'Learning' | 'Webinar';
  tone: 'primary' | 'danger' | 'success' | 'warning' | 'info';
  attendees?: { name: string; initials?: string }[];
}

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Architecture & Schema Sync',
    date: '2026-08-27',
    time: '10:00 AM - 11:00 AM',
    location: 'Conference Room Alpha',
    category: 'Meeting',
    tone: 'primary',
    attendees: [
      { name: 'Alice Johnson', initials: 'AJ' },
      { name: 'Bob Carter', initials: 'BC' },
      { name: 'Charlie Lee', initials: 'CL' },
      { name: 'Diana Prince', initials: 'DP' },
    ],
  },
  {
    id: '2',
    title: 'Q3 Enterprise Release Gate',
    date: '2026-08-28',
    time: '2:00 PM - 3:30 PM',
    location: 'Zoom Video Bridge',
    category: 'Important',
    tone: 'danger',
  },
  {
    id: '3',
    title: 'Client Demo: Apex Systems',
    date: '2026-08-29',
    time: '11:30 AM - 12:00 PM',
    location: 'Zoom',
    category: 'Confirmed',
    tone: 'success',
  },
  {
    id: '4',
    title: 'Team Coffee & Casual Sync',
    date: '2026-08-30',
    time: '1:00 PM - 2:00 PM',
    location: 'Cafeteria / Lounge',
    category: 'Casual',
    tone: 'warning',
  },
  {
    id: '5',
    title: 'Design System & UX Workshop',
    date: '2026-08-31',
    time: '3:00 PM - 4:30 PM',
    location: 'Hall B',
    category: 'Learning',
    tone: 'info',
  },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const CalendarApp: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 27)); // Aug 27, 2026
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-27');
  const [viewMode, setViewMode] = useState<string>('month');
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('2026-08-27');
  const [newEventCategory, setNewEventCategory] = useState<CalendarEvent['category']>('Meeting');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date(2026, 7, 27);
    setCurrentDate(today);
    setSelectedDate('2026-08-27');
  };

  // Generate calendar grid days for current month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Prev month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, isCurrentMonth: false, isToday: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === '2026-08-27';
      days.push({ day: d, dateStr, isCurrentMonth: true, isToday });
    }

    // Next month padding days to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [year, month]);

  const handleAddEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const toneMap: Record<CalendarEvent['category'], CalendarEvent['tone']> = {
      Meeting: 'primary',
      Important: 'danger',
      Confirmed: 'success',
      Casual: 'warning',
      Learning: 'info',
      Webinar: 'info',
    };

    const newEv: CalendarEvent = {
      id: String(Date.now()),
      title: newEventTitle,
      date: newEventDate,
      time: '09:00 AM - 10:00 AM',
      category: newEventCategory,
      tone: toneMap[newEventCategory] || 'primary',
    };

    setEvents((prev) => [...prev, newEv]);
    setNewEventTitle('');
    setIsModalOpen(false);
  };

  const todayFormatted = currentDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <CalendarPageShell
      title="Team Schedule & Operations Calendar"
      breadcrumbs={<span>Apps / Operations / Calendar</span>}
      sidebar={
        <div className="sails-cal-sidebar-card sails-card">
          {/* Header & Add Button */}
          <div className="sails-cal-sidebar-header">
            <div className="sails-cal-sidebar-date">{todayFormatted}</div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={14} className="me-1" />
              Add Event
            </Button>
          </div>

          {/* Mini Month Datepicker Navigator */}
          <div className="sails-cal-mini-picker">
            <div className="sails-cal-mini-picker__header">
              <span className="sails-cal-mini-picker__title">
                {MONTHS[month]} {year}
              </span>
              <div className="sails-cal-mini-picker__nav">
                <button type="button" className="sails-cal-mini-nav-btn" onClick={handlePrevMonth} aria-label="Previous Month">
                  <ChevronLeft size={14} />
                </button>
                <button type="button" className="sails-cal-mini-nav-btn" onClick={handleNextMonth} aria-label="Next Month">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="sails-cal-mini-grid">
              {WEEKDAYS.map((w) => (
                <span key={w} className="sails-cal-mini-grid__weekday">{w[0]}</span>
              ))}
              {calendarDays.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`sails-cal-mini-grid__day ${
                    !d.isCurrentMonth ? 'sails-cal-mini-grid__day--outside' : ''
                  } ${d.isToday ? 'sails-cal-mini-grid__day--today' : ''} ${
                    selectedDate === d.dateStr ? 'sails-cal-mini-grid__day--selected' : ''
                  }`}
                >
                  {d.day}
                </button>
              ))}
            </div>
          </div>

          {/* Current Active Event Card */}
          <div className="sails-cal-current-card">
            <div className="sails-cal-current-card__top">
              <UiBadge tone="primary">Meeting</UiBadge>
              <UiAvatarGroup size="2xs" max={3}>
                <UiAvatar initials="AJ" />
                <UiAvatar initials="BC" />
                <UiAvatar initials="CL" />
                <UiAvatar initials="DP" />
              </UiAvatarGroup>
            </div>
            <h5 className="sails-cal-current-card__title">Architecture & Schema Sync</h5>
            <p className="sails-cal-current-card__meta">
              <Clock size={12} className="me-1" /> 10:00 AM - 11:00 AM at Conference Hall
            </p>
            <Button variant="primary" size="sm" className="sails-cal-join-btn">
              <Video size={13} className="me-1" />
              Join Meeting Bridge
            </Button>
          </div>

          {/* Upcoming Events Feed */}
          <div className="sails-cal-upcoming">
            <h6 className="sails-cal-upcoming__title">Upcoming Agenda</h6>
            <div className="sails-cal-upcoming__list sails-scroll-area">
              {events.map((ev) => (
                <div key={ev.id} className="sails-cal-agenda-card">
                  <div className="sails-cal-agenda-card__header">
                    <UiBadge tone={ev.tone}>{ev.category}</UiBadge>
                    <span className="sails-cal-agenda-card__date">{ev.date.slice(5)}</span>
                  </div>
                  <div className="sails-cal-agenda-card__title">{ev.title}</div>
                  <div className="sails-cal-agenda-card__time">
                    <Clock size={11} className="me-1" /> {ev.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      {/* Main Interactive Calendar Board */}
      <UiCard>
        {/* Calendar Toolbar */}
        <UiCardHeader>
          <div className="sails-cal-toolbar">
            <div className="sails-cal-toolbar__left">
              <div className="sails-cal-nav-group">
                <button type="button" className="sails-cal-nav-arrow" onClick={handlePrevMonth} aria-label="Previous">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="sails-cal-today-btn" onClick={handleToday}>
                  Today
                </button>
                <button type="button" className="sails-cal-nav-arrow" onClick={handleNextMonth} aria-label="Next">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <h3 className="sails-cal-toolbar__title">
              {MONTHS[month]} {year}
            </h3>

            <div className="sails-cal-toolbar__right">
              <UiPillTabs
                tabs={[
                  { id: 'month', label: 'Month' },
                  { id: 'week', label: 'Week' },
                  { id: 'day', label: 'Day' },
                ]}
                activeTab={viewMode}
                onChange={setViewMode}
                size="sm"
              />
            </div>
          </div>
        </UiCardHeader>

        {/* 7-Column Month Grid */}
        <UiCardBody style={{ padding: 0 }}>
          <div className="sails-cal-grid">
            {/* Weekday Header Row */}
            <div className="sails-cal-grid__weekdays">
              {WEEKDAYS.map((w) => (
                <div key={w} className="sails-cal-grid__weekday-cell">{w}</div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div className="sails-cal-grid__days">
              {calendarDays.map((d, index) => {
                const dayEvents = events.filter((e) => e.date === d.dateStr);

                return (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedDate(d.dateStr);
                      setNewEventDate(d.dateStr);
                      setIsModalOpen(true);
                    }}
                    className={`sails-cal-cell ${
                      !d.isCurrentMonth ? 'sails-cal-cell--outside' : ''
                    } ${d.isToday ? 'sails-cal-cell--today' : ''} ${
                      selectedDate === d.dateStr ? 'sails-cal-cell--selected' : ''
                    }`}
                  >
                    <div className="sails-cal-cell__header">
                      <span className="sails-cal-cell__num">{d.day}</span>
                    </div>

                    <div className="sails-cal-cell__events">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={`sails-cal-event-pill sails-cal-event-pill--${ev.tone}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            alert(`Event: ${ev.title}\nTime: ${ev.time}\nCategory: ${ev.category}`);
                          }}
                          title={`${ev.title} (${ev.time})`}
                        >
                          <span className="sails-cal-event-pill__dot"></span>
                          <span className="sails-cal-event-pill__text">{ev.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </UiCardBody>
      </UiCard>

      {/* Add Event Modal */}
      {isModalOpen && (
        <div className="sails-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="sails-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="m-0 fs-16 fw-bold">Schedule New Event</h3>
              <button type="button" className="btn btn-icon text-muted" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit}>
              <div className="sails-form-group">
                <label>Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sprint Review & Retrospective"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="sails-form-row">
                <div className="sails-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    required
                  />
                </div>
                <div className="sails-form-group">
                  <label>Category</label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value as any)}
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Important">Important</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Casual">Casual</option>
                    <option value="Learning">Learning</option>
                    <option value="Webinar">Webinar</option>
                  </select>
                </div>
              </div>

              <div className="sails-modal__footer" style={{ marginTop: '20px' }}>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Event
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CalendarPageShell>
  );
};

export default CalendarApp;
