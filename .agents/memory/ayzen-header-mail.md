---
name: AYZEN Header Mail Dropdown
description: Email icon in top-right header shows AYZEN mail inbox with unread count
---

## Implementation
- `MailDropdown` component in `app-layout.tsx` (same file as AppLayout)
- Placed next to `NotificationBell` in both mobile and desktop headers
- Fetches from `/api/ayzen-mail` (NOT `/api/ayzen-mail/inbox`) with `?limit=10`
- Shows unread count badge on mail icon; marks individual messages read via PATCH `/api/ayzen-mail/:id/read`
- Auto-refreshes every 30 seconds; closes on outside click via mousedown listener
- "Open Full Mailbox" links to `/ayzen-email` page

**Why:** User wanted email icon in top-right so they can see emails without navigating away.
