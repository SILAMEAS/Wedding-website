# Running the wedding: operations guide

For the couple and the helpers at the door. Everything here happens in the admin
(`/admin`), which works on a phone.

## Before sending invitations

1. **Wedding details**: names in Khmer and English, story, schedule, venues (with map links),
   gallery, gift details (KHQR image, bank account). Check every page on a phone in both languages.
2. **Guests and families**: add them one by one or import a CSV (**Guests → Import**).
   A family gets *one* invitation that covers all its members.
3. **Invitations**: create one per guest or family. Each has a private link and a QR code.
   Send the link privately (Telegram, Messenger…). Anyone with the link can open that invitation.
4. Open two or three invitations yourself on a phone to check them before sending to everyone.

If a link is sent to the wrong person, open the invitation and press **Generate new link**.
The old link stops working immediately.

## While replies come in

- **Dashboard**: replies, people attending, gifts to check, wishes to approve.
- **Wishes**: new wishes are hidden until you approve them.
- **Gifts received**: a guest saying "I sent a gift" is only a notification. Check your bank or
  KHQR app, then press **Confirm received** (with the amount actually received) or
  **Not received**. Only confirmed gifts count in the totals. USD and KHR are always separate.
- **Analytics**: replies over time, invitations opened, gifts per currency.

## The day before the wedding

1. **Downloads → Guests / Invitations / Replies** (Excel): print a guest list as a paper backup
   in case the venue has no internet.
2. Charge the phones that will be used at the door, and sign in to the admin on each one
   (the shared account can be signed in on several phones at once).
3. On each phone, open **Check-in → Start camera** once and allow camera access.
4. Take a database backup (see [DEPLOYMENT.md](DEPLOYMENT.md), section 4).

## At the door (check-in)

1. Open **Check-in** and press **Start camera**.
2. Scan the QR code on the guest's phone or printed invitation. If scanning fails (cracked
   screen, glare), type part of the name or phone number in **Find by name**.
3. The party card shows who is invited, how many seats, and their reply. Set **Arriving now**
   to the number of people actually at the door and press **Welcome**.
4. If the party has **already arrived** (for example a second car), the button is locked.
   Tick **Check in anyway** and write a short reason. The same applies to a switched-off or
   cancelled invitation: the couple decides.
5. A mistake? In **Recent arrivals**, press the undo arrow and give a reason. Nothing is deleted;
   the history stays in the activity log.

Two phones scanning the same QR at the same moment is safe: only one check-in is recorded and the
other phone is told the party already arrived.

## After the wedding

1. **Gifts received**: confirm any remaining notifications against your bank and KHQR history.
2. **Downloads → Gifts** (Excel) for your records; **Downloads → Arrivals** for who came.
3. Take a final backup and keep it encrypted.
4. When you no longer need the site, switch invitations off, or delete the deployment. Delete
   downloaded files you no longer need: they contain guests' personal information.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Camera does not start | Allow camera access in the browser settings; the site must be opened over https. Use **Find by name** meanwhile. |
| Guest says the link does not work | Search for them in **Invitations**. If the link was regenerated or the invitation switched off, send the current link. |
| Too many sign-in attempts | Sign-in is locked for a while after repeated wrong passwords. Wait 15 minutes. |
| The site is down | Check `/api/health`. If it says the database is unreachable, check the database provider's status page. Use the printed guest list at the door. |
| Signed out unexpectedly | Sessions end after 12 hours of inactivity or 7 days in total, and when the password is changed. Sign in again. |
