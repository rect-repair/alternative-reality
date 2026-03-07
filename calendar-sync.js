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
        // {
        //     id: 'set-open',
        //     title: 'event live!',
        //     start: date(2026, 3, 1),
        //     end: date(2026, 3, 1),
        //     type: 'open',
        //     location: '',
        //     isAllDay: true,
        //     isSetDate: true
        // },
        // {
        //     id: 'set-jam-launch',
        //     title: 'JAM!',
        //     start: date(2026, 3, 21),
        //     end: date(2026, 3, 21),
        //     type: 'launch',
        //     location: 'ALL NODES',
        //     isAllDay: true,
        //     isSetDate: true
        // },
        {
            id: 'set-jam-period',
            title: 'JAM!',
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
            location: ' ',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-play-1',
            title: 'PLAY! launch',
            start: date(2026, 3, 28),
            end: date(2026, 3, 28),
            type: 'play',
            location: 'online',
            isAllDay: true,
            isSetDate: true
        },
        {
            id: 'set-play-2',
            title: 'PLAY!',
            start: date(2026, 3, 29),
            end: date(2026, 4, 10),
            type: 'play',
            location: 'online',
            isAllDay: true,
            isSetDate: true
        }
    ]
};

// Event type mappings (used by mini calendar on index.html)
const EVENT_TYPES = {
    'jam': { class: 'jam-day', label: 'JAM!' },
    'launch': { class: 'jam-day', label: 'JAM!' },
    'deadline': { class: 'jam-day', label: 'DUE' },
    'play': { class: 'play-day', label: 'PLAY!' },
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
        const todayD = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const allEvents = this.sync.getEventsForDate(date);
            const events = allEvents.filter(e => typeof eventMatchesFilter === 'function' ? eventMatchesFilter(e) : true);
            const dayClasses = ['cal-day'];

            const isToday = todayD.getFullYear() === year && todayD.getMonth() === month && todayD.getDate() === day;
            if (isToday) dayClasses.push('today');

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
                <div class="${dayClasses.join(' ')}" data-date="${year}-${month}-${day}" onclick="selectCalendarDay(${year}, ${month}, ${day})">
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

        const tz = window.selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

        const upcomingEvents = this.sync.events
            .filter(e => new Date(e.start) >= new Date())
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 3);

        if (upcomingEvents.length === 0) {
            container.innerHTML = '<li class="event-item"><div class="event-header"><span class="event-title">No upcoming events</span></div></li>';
            return;
        }

        // color group?? tbd
        // play = yellow, jam/deadline/open = blue
        const typeColorClass = (type) => {
            if (type === 'play') return 'event-color-play';
            if (type === 'jam' || type === 'launch') return 'event-color-jam';
            return '';
        };

        const html = upcomingEvents.map(event => {
            const dateStr = event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = typeof formatEventTime === 'function' ? formatEventTime(event, tz) : (event.isAllDay ? 'all day' : '');
            const mode = typeof getEventMode === 'function' ? getEventMode(event) : 'irl';
            const locStr = (event.location || '').trim();
            const showLoc = locStr && locStr.toLowerCase() !== 'online';
            const colorClass = typeColorClass(event.type);
            return `
                <li class="event-item${event.isSetDate ? ' set-date' : ''}${colorClass ? ' ' + colorClass : ''}">
                    <div class="event-header">
                        <span class="event-title">${event.title}</span>
                    </div>
                    <div class="event-meta">
                        <span>${dateStr}</span>
                        <span>${timeStr}</span>
                    </div>
                    ${showLoc ? `<div class="event-loc ${mode}">${locStr}</div>` : ''}
                </li>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderTimeline(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const tz = window.selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = new Date();

        const events = this.sync.events
            .filter(e => typeof eventMatchesFilter === 'function' ? eventMatchesFilter(e) : true)
            .sort((a, b) => new Date(a.start) - new Date(b.start));

        if (events.length === 0) {
            container.innerHTML = '<div class="day-no-events">no events match filter</div>';
            return;
        }

        // group events by start date
        const groups = [];
        const seenDates = {};
        events.forEach(event => {
            const dateKey = event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            if (!(dateKey in seenDates)) {
                seenDates[dateKey] = groups.length;
                groups.push({ dateKey, label: event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(), events: [] });
            }
            groups[seenDates[dateKey]].events.push(event);
        });

        let html = '';
        groups.forEach(group => {
            html += `<div class="timeline-date-header">${group.label}</div>`;
            group.events.forEach(event => {
                const timeStr = typeof formatEventTime === 'function' ? formatEventTime(event, tz) : '';
                const mode = typeof getEventMode === 'function' ? getEventMode(event) : 'irl';
                const isHighlight = event.type === 'launch' || event.type === 'play';
                const isActive = now >= event.start && now <= event.end;
                const isPast = now > event.end;

                let classes = 'timeline-item';
                if (isHighlight) classes += ' highlight';
                if (isActive) classes += ' active';
                if (isPast) classes += ' past';
                if (event.isSetDate) classes += ' set-date';

                const timeHtml = timeStr && timeStr !== 'all day' ? `<div class="timeline-time">${timeStr}</div>` : '';
                const locStr = (event.location || '').trim();
                // only show location if different
                const showLoc = locStr && locStr.toLowerCase() !== 'online';
                const locHtml = showLoc ? `<div class="timeline-loc ${mode}">${locStr}</div>` : '';

                html += `
                    <div class="${classes}">
                        ${timeHtml}
                        <div class="timeline-title">${event.title}</div>
                        ${locHtml}
                    </div>
                `;
            });
        });

        container.innerHTML = html;
    }

    // renderEventsGrid(containerId) {
    //     const container = document.getElementById(containerId);
    //     if (!container) return;

    //     const events = this.sync.events
    //         .sort((a, b) => new Date(a.start) - new Date(b.start));

    //     const html = events.map((event, index) => {
    //         const dateStr = event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    //         const tagStyle = this.getTagStyle(event.type);
    //         const tagLabel = this.getTagLabel(event.type);

    //         return `
    //             <div class="chaos-item${event.isSetDate ? ' set-date' : ''}" data-num="${String(index + 1).padStart(2, '0')}">
    //                 <h3>${event.title}</h3>
    //                 <div class="meta">${dateStr}${event.location ? ` — ${event.location}` : ''}</div>
    //                 <span class="tag" ${tagStyle}>${tagLabel}</span>
    //             </div>
    //         `;
    //     }).join('');

    //     // Add the "+ Add Event" card
    //     const addCard = `
    //         <div class="chaos-item" data-num="${String(events.length + 1).padStart(2, '0')}">
    //             <span class="tag" style="background: #444; color: var(--white);">ADD</span>
    //         </div>
    //     `;

    //     container.innerHTML = html + addCard;
    // }

    getTagStyle(type) {
        const styles = {
            'launch': 'style="background: var(--blue); color: var(--white);"',
            'play': 'style="background: var(--lime); color: var(--black);"',
            'deadline': 'style="background: #ff4444; color: var(--white);"',
            'open': 'style="background: var(--yellow); color: var(--black);"',
            'jam': 'style="background: var(--cyan); color: var(--black);"',
            'default': 'style="background: #666; color: var(--white);"'
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

    // init timezone selector
    initTimezoneSelector();
}

document.addEventListener('DOMContentLoaded', initCalendar);


// ============================================
// event filters
// ============================================

function getEventMode(event) {
    const loc = (event.location || '').trim().toLowerCase();
    if (!loc) return 'online';
    if (loc === 'all nodes' || loc.includes('all nodes')) return 'hybrid';
    if (loc === 'online' || loc.startsWith('http') || loc.includes('discord') || loc.includes('zoom') || loc.includes('meet.')) {
        return 'online';
    }
    return 'irl';
}

window.activeFilter = 'all';

function eventMatchesFilter(event) {
    if (window.activeFilter === 'all') return true;
    const mode = getEventMode(event);
    if (mode === 'hybrid') return true; // hybrid shows under all filters
    return mode === window.activeFilter;
}

function setFilter(filter) {
    window.activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    // re-render calendar and timeline
    if (typeof window.currentYear !== 'undefined') {
        calendarRenderer.renderLargeCalendar('large-calendar', window.currentYear, window.currentMonth);
    }
    showTimeline();
}

// ============================================
// timezone selector
// ============================================

window.selectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function initTimezoneSelector() {
    const tzSelect = document.getElementById('tz-select');
    if (!tzSelect) return;

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = [
        { value: userTz, label: `local — ${userTz}` },
        { value: 'UTC', label: 'UTC' },
        { value: 'America/New_York', label: 'New York (ET)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
        { value: 'Europe/London', label: 'London (GMT)' },
        { value: 'Europe/Berlin', label: 'Berlin (CET)' },
        { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
        { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    ];

    // deduplicate if local tz matches a named zone
    const seen = new Set();
    const unique = zones.filter(z => {
        if (seen.has(z.value)) return false;
        seen.add(z.value);
        return true;
    });

    tzSelect.innerHTML = unique.map(z =>
        `<option value="${z.value}" ${z.value === userTz ? 'selected' : ''}>${z.label}</option>`
    ).join('');
}

function changeTimezone(tz) {
    window.selectedTimezone = tz;
    const backBtn = document.getElementById('sidebar-back');
    if (backBtn && backBtn.style.display === 'block') {
        // Day detail is showing — re-render it
        const selected = document.querySelector('.cal-day.selected');
        if (selected) {
            const [y, m, d] = selected.dataset.date.split('-').map(Number);
            selectCalendarDay(y, m, d);
        }
    } else {
        // Timeline is showing — re-render it
        calendarRenderer.renderTimeline('timeline');
    }
}

function formatEventTime(event, timezone) {
    if (event.isAllDay) return 'all day';
    try {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timezone,
            hour12: false,
            timeZoneName: 'short'
        }).format(new Date(event.start));
    } catch (e) {
        return '';
    }
}

function selectCalendarDay(year, month, day) {
    // Update selected state
    document.querySelectorAll('.cal-day.selected').forEach(d => d.classList.remove('selected'));
    const key = `${year}-${month}-${day}`;
    const dayEl = document.querySelector(`.cal-day[data-date="${key}"]`);
    if (dayEl) dayEl.classList.add('selected');

    const date = new Date(year, month, day);
    const events = calendarSync.getEventsForDate(date);

    const dateLabel = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric'
    }).toUpperCase();

    // switch sidebar to day detail mode
    document.getElementById('sidebar-title').textContent = dateLabel;
    document.getElementById('sidebar-back').style.display = 'block';

    const container = document.getElementById('timeline');
    container.className = 'day-detail';

    if (events.length === 0) {
        container.innerHTML = `<div class="day-no-events">no events</div>`;
        return;
    }

    container.innerHTML = events.map(ev => {
        const timeStr = formatEventTime(ev, window.selectedTimezone);
        const tagStyle = calendarRenderer.getTagStyle(ev.type);
        const tagLabel = calendarRenderer.getTagLabel(ev.type);
        return `
            <div class="day-event-item">
                <div class="day-event-time">${timeStr}</div>
                <div class="day-event-title">${ev.title}</div>
                ${ev.location ? `<div class="day-event-loc">${ev.location}</div>` : ''}
                ${ev.description ? `<div class="day-event-desc">${ev.description}</div>` : ''}
                <span class="day-event-tag" ${tagStyle}>${tagLabel}</span>
            </div>
        `;
    }).join('');
}

function showTimeline() {
    document.getElementById('sidebar-title').textContent = 'TIMELINE';
    document.getElementById('sidebar-back').style.display = 'none';
    document.querySelectorAll('.cal-day.selected').forEach(d => d.classList.remove('selected'));
    const container = document.getElementById('timeline');
    container.className = 'timeline';
    calendarRenderer.renderTimeline('timeline');
}

// Export for manual use
window.CalendarSync = CalendarSync;
window.CalendarRenderer = CalendarRenderer;
window.calendarSync = calendarSync;
window.calendarRenderer = calendarRenderer;
window.refreshCalendar = initCalendar;
window.SET_DATES = SET_DATES;
