// Google Calendar Sync

// helper date function, convert 1 index month to 0 index
function date(year, month, day) {
    return new Date(year, month - 1, day);
}

// ============================================
// set dates
// ============================================
const SET_DATES = {
    year: 2026,
    month: 3,
    events: [
        {
            id: 'set-open',
            title: 'Itch.io jam page live',
            start: date(2026, 3, 1),
            end: date(2026, 3, 1),
            type: 'open',
            location: '',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-jam-launch',
            title: 'JAM! Launch',
            start: date(2026, 3, 21),
            end: date(2026, 3, 21),
            type: 'launch',
            location: 'ALL NODES',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-jam-period',
            title: 'Jam Period',
            start: date(2026, 3, 22),
            end: date(2026, 3, 25),
            type: 'jam',
            location: '',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-deadline',
            title: 'Submissions Due',
            start: date(2026, 3, 25),
            end: date(2026, 3, 25),
            type: 'deadline',
            location: '23:59 UTC',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-play-1',
            title: 'PLAY! Launch',
            start: date(2026, 3, 28),
            end: date(2026, 3, 28),
            type: 'play',
            location: 'ALL NODES',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-play-2',
            title: 'PLAY!',
            start: date(2026, 3, 29),
            end: date(2026, 3, 29),
            type: 'play',
            location: 'ALL NODES',
            isAllDay: true,
            isSetDate: true
        }
    ]
};

// Event type mappings
const EVENT_TYPES = {
    'jam': { class: 'jam-period', label: null },
    'launch': { class: 'launch', label: 'JAM!' },
    'play': { class: 'launch', label: 'PLAY' },
    'deadline': { class: 'has-event', label: 'DUE' },
    'open': { class: 'has-event', label: 'OPEN' },
    'default': { class: 'has-event', label: null }
};

class CalendarSync {
    constructor() {
        // Check if config is loaded
        this.config = typeof CALENDAR_CONFIG !== 'undefined' ? CALENDAR_CONFIG : {
            apiKey: '',
            calendarId: '',
            enableSync: false,
            monthsAhead: 3
        };

        this.events = [];
        this.syncedEvents = [];
        this.isConfigured = this.config.enableSync &&
            this.config.apiKey &&
            this.config.apiKey !== 'YOUR_API_KEY_HERE' &&
            this.config.calendarId &&
            this.config.calendarId !== 'YOUR_CALENDAR_ID_HERE';
    }

    async fetchEvents() {
        // Always start with hardcoded set dates
        this.events = [...SET_DATES.events];

        // If sync is configured, fetch additional events
        if (this.isConfigured) {
            try {
                const synced = await this.fetchFromGoogle();
                this.syncedEvents = synced;
                // Merge: synced events add to set dates, don't replace
                this.events = this.mergeEvents(this.events, synced);
                console.log(`Calendar sync: loaded ${synced.length} events from Google Calendar`);
            } catch (error) {
                console.error('Calendar sync failed, using set dates only:', error);
            }
        } else {
            console.log('Calendar sync not configured, using hardcoded set dates');
        }

        return this.events;
    }

    async fetchFromGoogle() {
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + this.config.monthsAhead, 0).toISOString();

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.config.calendarId)}/events?` +
            `key=${this.config.apiKey}` +
            `&timeMin=${timeMin}` +
            `&timeMax=${timeMax}` +
            `&singleEvents=true` +
            `&orderBy=startTime`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Calendar API error: ${response.status}`);
        }
        const data = await response.json();
        return this.parseEvents(data.items || []);
    }

    parseEvents(items) {
        return items.map(item => {
            const start = item.start.dateTime || item.start.date;
            const end = item.end.dateTime || item.end.date;
            const title = item.summary || 'Untitled';
            const colorId = item.colorId || null;
            const creator = item.creator?.email || '';
            const type = this.detectEventType(title, item.description || '', colorId);

            return {
                id: item.id,
                title: title,
                description: item.description || '',
                location: item.location || '',
                start: new Date(start),
                end: new Date(end),
                isAllDay: !item.start.dateTime,
                type: type,
                colorId: colorId,
                creator: creator,
                isSetDate: false,
                raw: item
            };
        });
    }

    mergeEvents(setDates, synced) {
        // Combine both, sort by start date
        const all = [...setDates, ...synced];
        return all.sort((a, b) => new Date(a.start) - new Date(b.start));
    }

    detectEventType(title, description, colorId) {
        // Google Calendar color IDs:
        // 1 = Lavender, 2 = Sage, 3 = Grape, 4 = Flamingo, 5 = Banana
        // 6 = Tangerine, 7 = Peacock, 8 = Graphite, 9 = Blueberry, 10 = Basil, 11 = Tomato
        const colorMap = {
            '11': 'deadline',  // Tomato/Red = deadline
            '6': 'launch',     // Tangerine/Orange = launch
            '5': 'open',       // Banana/Yellow = open
            '10': 'play',      // Basil/Green = play
            '9': 'jam',        // Blueberry = jam
            '7': 'jam',        // Peacock/Cyan = jam
        };

        // First check color
        if (colorId && colorMap[colorId]) {
            return colorMap[colorId];
        }

        // Fall back to text detection
        const text = (title + ' ' + description).toLowerCase();
        if (text.includes('jam period') || text.includes('jam-period')) return 'jam';
        if (text.includes('launch') || text.includes('kickoff')) return 'launch';
        if (text.includes('play')) return 'play';
        if (text.includes('deadline') || text.includes('due')) return 'deadline';
        if (text.includes('open') || text.includes('live')) return 'open';
        return 'default';
    }

    getEventsForDate(date) {
        return this.events.filter(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            eventStart.setHours(0, 0, 0, 0);
            eventEnd.setHours(23, 59, 59, 999);
            const checkDate = new Date(date);
            checkDate.setHours(12, 0, 0, 0);
            return checkDate >= eventStart && checkDate <= eventEnd;
        });
    }

    getEventsForMonth(year, month) {
        return this.events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.getFullYear() === year && eventDate.getMonth() === month;
        });
    }
}

class CalendarRenderer {
    constructor(calendarSync) {
        this.sync = calendarSync;
    }

    renderMiniCalendar(containerId, year, month) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        let html = `<h2>${monthNames[month]} ${year}</h2>`;
        html += '<div class="calendar">';

        // Day headers
        ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(day => {
            html += `<div class="calendar-header">${day}</div>`;
        });

        // Empty cells before first day
        for (let i = 0; i < startPadding; i++) {
            const prevMonth = new Date(year, month, 0);
            const day = prevMonth.getDate() - startPadding + i + 1;
            html += `<div class="calendar-day inactive"><span class="day-num">${day}</span></div>`;
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const events = this.sync.getEventsForDate(date);
            const dayClasses = ['calendar-day'];
            let label = '';

            if (events.length > 0) {
                const primaryEvent = events[0];
                const typeConfig = EVENT_TYPES[primaryEvent.type] || EVENT_TYPES.default;
                dayClasses.push(typeConfig.class);
                if (typeConfig.label) {
                    label = `<div class="day-label">${typeConfig.label}</div>`;
                }
            }

            html += `<div class="${dayClasses.join(' ')}"><span class="day-num">${day}</span>${label}</div>`;
        }

        // Empty cells after last day
        const endPadding = (7 - ((startPadding + daysInMonth) % 7)) % 7;
        for (let i = 1; i <= endPadding; i++) {
            html += `<div class="calendar-day inactive"><span class="day-num">${i}</span></div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    renderLargeCalendar(containerId, year, month) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        let html = '';

        // Day headers
        ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(day => {
            html += `<div class="cal-header">${day}</div>`;
        });

        // Empty cells before first day
        for (let i = 0; i < startPadding; i++) {
            html += `<div class="cal-day inactive"></div>`;
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const events = this.sync.getEventsForDate(date);
            const dayClasses = ['cal-day'];

            if (events.length > 0) {
                dayClasses.push('has-events');
                // Add type class for triangle color (based on first event)
                const primaryType = events[0].type || 'default';
                dayClasses.push(`type-${primaryType}`);
            }

            // Build event list HTML
            let eventsHtml = '';
            events.forEach(event => {
                const tagClass = `tag-${event.type}`;
                eventsHtml += `
                    <div class="cal-event">
                        <span class="cal-event-tag ${tagClass}"></span>
                        <span class="cal-event-name">${event.title}</span>
                    </div>
                `;
            });

            html += `
                <div class="${dayClasses.join(' ')}">
                    <span class="cal-day-num">${day}</span>
                    <div class="cal-events-list">${eventsHtml}</div>
                </div>
            `;
        }

        // Empty cells after last day
        const endPadding = (7 - ((startPadding + daysInMonth) % 7)) % 7;
        for (let i = 0; i < endPadding; i++) {
            html += `<div class="cal-day inactive"></div>`;
        }

        container.innerHTML = html;
    }

    renderEventsList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const upcomingEvents = this.sync.events
            .filter(e => new Date(e.start) >= new Date())
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 5);

        if (upcomingEvents.length === 0) {
            container.innerHTML = '<li class="event-item"><div class="event-header"><span class="event-title">No upcoming events</span></div></li>';
            return;
        }

        const html = upcomingEvents.map(event => {
            const dateStr = event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const location = event.location || 'TBA';
            return `
                <li class="event-item${event.isSetDate ? ' set-date' : ''}">
                    <div class="event-header">
                        <span class="event-title">${event.title}</span>
                        <span class="event-location">${location}</span>
                    </div>
                    <div class="event-meta">
                        <span>${dateStr}</span>
                        <span>${event.isAllDay ? 'All day' : event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                </li>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderTimeline(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const events = this.sync.events
            .sort((a, b) => new Date(a.start) - new Date(b.start));

        const now = new Date();

        const html = events.map(event => {
            const startDate = event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const isHighlight = event.type === 'launch' || event.type === 'play';
            const isActive = now >= event.start && now <= event.end;
            const isPast = now > event.end;

            let classes = 'timeline-item';
            if (isHighlight) classes += ' highlight';
            if (isActive) classes += ' active';
            if (isPast) classes += ' past';
            if (event.isSetDate) classes += ' set-date';

            return `
                <div class="${classes}">
                    <div class="timeline-date">${startDate}</div>
                    <div class="timeline-title">${event.title}</div>
                    ${event.location ? `<div class="timeline-desc">${event.location}</div>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderEventsGrid(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const events = this.sync.events
            .sort((a, b) => new Date(a.start) - new Date(b.start));

        const html = events.map((event, index) => {
            const dateStr = event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            const tagStyle = this.getTagStyle(event.type);
            const tagLabel = this.getTagLabel(event.type);

            return `
                <div class="chaos-item${event.isSetDate ? ' set-date' : ''}" data-num="${String(index + 1).padStart(2, '0')}">
                    <h3>${event.title}</h3>
                    <div class="meta">${dateStr}${event.location ? ` — ${event.location}` : ''}</div>
                    <span class="tag" ${tagStyle}>${tagLabel}</span>
                </div>
            `;
        }).join('');

        // Add the "+ Add Event" card
        const addCard = `
            <div class="chaos-item" data-num="${String(events.length + 1).padStart(2, '0')}">
                <h3>+ Add Event</h3>
                <div class="meta">Organizers only</div>
                <span class="tag" style="background: #444; color: var(--white);">ADD</span>
            </div>
        `;

        container.innerHTML = html + addCard;
    }

    getTagStyle(type) {
        const styles = {
            'launch': 'style="background: var(--orange); color: var(--black);"',
            'play': 'style="background: var(--lime); color: var(--black);"',
            'deadline': 'style="background: var(--blue); color: var(--white);"',
            'open': '',
            'jam': 'style="background: var(--magenta); color: var(--white);"',
            'default': ''
        };
        return styles[type] || styles.default;
    }

    getTagLabel(type) {
        const labels = {
            'launch': 'LAUNCH',
            'play': 'PLAY',
            'deadline': 'DEADLINE',
            'open': 'OPEN',
            'jam': 'JAM',
            'default': 'EVENT'
        };
        return labels[type] || labels.default;
    }
}

// Initialize
const calendarSync = new CalendarSync();
const calendarRenderer = new CalendarRenderer(calendarSync);

// Auto-initialize when DOM is ready
async function initCalendar() {
    await calendarSync.fetchEvents();

    // Always show March 2026 for the set dates
    const displayYear = SET_DATES.year;
    const displayMonth = SET_DATES.month - 1; // convert to 0-indexed for JS Date API

    // Render mini calendar (index.html sidebar)
    if (document.getElementById('mini-calendar')) {
        calendarRenderer.renderMiniCalendar('mini-calendar', displayYear, displayMonth);
    }

    // Render events list (index.html sidebar)
    if (document.getElementById('events-list')) {
        calendarRenderer.renderEventsList('events-list');
    }

    // Render large calendar (calendar.html)
    if (document.getElementById('large-calendar')) {
        calendarRenderer.renderLargeCalendar('large-calendar', displayYear, displayMonth);
    }

    // Render timeline (calendar.html)
    if (document.getElementById('timeline')) {
        calendarRenderer.renderTimeline('timeline');
    }

    // Render events grid (calendar.html)
    if (document.getElementById('events-grid')) {
        calendarRenderer.renderEventsGrid('events-grid');
    }

    // Update the month title if present
    const monthTitle = document.getElementById('calendar-month-title');
    if (monthTitle) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        monthTitle.textContent = `${monthNames[displayMonth].toUpperCase()} ${displayYear}`;
    }
}

document.addEventListener('DOMContentLoaded', initCalendar);

// Export for manual use
window.CalendarSync = CalendarSync;
window.CalendarRenderer = CalendarRenderer;
window.calendarSync = calendarSync;
window.calendarRenderer = calendarRenderer;
window.refreshCalendar = initCalendar;
window.SET_DATES = SET_DATES;
