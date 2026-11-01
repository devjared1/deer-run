# Time clock iPad

A shared iPad where employees clock in and out without signing in: tap your name, enter your time clock PIN, then
**Clock in**, **Start break**, **End break** or **Clock out**. Punches use the server's time, the same as the staff
portal's Time Clock page, and show up on timesheets the same way.

## Before you start

- The database has migration `13_timeclock_kiosk` (TODO.md → Housekeeping).
- Every employee who'll use it needs a **time clock PIN** (4–6 digits, separate from the register manager PIN):
  - an admin sets it in **Admin → Employees → ⋮ → Set time clock PIN** (the only way for staff without a login), or
  - the employee sets it on the staff portal's **Time Clock** page (**Set a PIN**).
  
  Five wrong tries lock that employee's PIN for 15 minutes. A forgotten PIN: an admin sets a new one.

## Set up the iPad

1. On the iPad, open Safari to **https://deerrun.golf/timeclock**.
2. Tap **Admin sign in**, sign in with an admin account, and you're brought back.
3. Give it a name (e.g. "Pro shop iPad") and tap **Set up this device**. You're signed out right away; the iPad keeps
   only its own time clock key (in Safari's storage for the site).
4. **Share → Add to Home Screen**. The icon opens the time clock full screen.
5. Keep it on the time clock:
   - **Settings → Display & Brightness → Auto-Lock → Never** (the page also asks to keep the screen awake, iPadOS 16.4+).
   - **Settings → Accessibility → Guided Access → On**, set a passcode. Open the time clock from the Home Screen
     icon, triple-click the top (or Home) button and tap **Start**. People can't leave the app until the passcode is
     entered.
   - Keep it on a charger, and on the course Wi-Fi.

Clearing Safari's website data (or "Private Browsing") forgets the key; set it up again from step 1.

## Managing time clocks

**Admin → Settings → Payroll → Time clock iPads** lists each one with when it was last used. **Remove** signs that
device out at once (it shows the set-up screen); punches already made are kept. A lost or replaced iPad: remove it
here and set up the new one.

## How it behaves

- Names are every active employee, by first name, with a search box. A green timer / coffee cup on a name means
  they're on the clock / on break.
- After 30 seconds without a touch on a PIN or action screen, it goes back to the names and forgets the PIN.
  After a punch, a confirmation shows for 6 seconds.
- Clocking out asks to confirm; it ends a break in progress.
- Nothing about the employee is stored on the iPad. Each punch sends the PIN again and the server checks it.
- Corrections (a forgotten clock-out, a wrong punch) are made by a manager in **Admin → Timesheets**, as before.
