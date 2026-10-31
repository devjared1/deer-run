# Register Setup Guide

How to set up a Deer Run point-of-sale register PC. Each register is a Windows PC running Chrome with:

- an **80 mm thermal receipt printer** (e.g. Epson TM-m30 or Star TSP100 series), installed as a normal Windows printer
- a **cash drawer** plugged into the printer's drawer (DK) port
- a **USB barcode scanner** in keyboard mode
- a **Stripe Reader S700** or BBPOS WisePOS E (internet-connected smart reader) for cards. Bluetooth/USB readers
  (M2, WisePad 3) won't work with the web register.

Time needed: about 30–45 minutes per register.

---

## 1. Receipt printer

1. Install the manufacturer's Windows driver (Epson "Advanced Printer Driver" / Star "TSP100 futurePRNT"), not the
   generic Windows driver. The generic one can't open the drawer or use 80 mm roll paper.
2. **Set it as the default printer**: Settings → Bluetooth & devices → Printers & scanners → turn **off** "Let
   Windows manage my default printer", then select the receipt printer → **Set as default**.
3. **Paper size**: Printer properties → Preferences (Printing preferences) → Paper size **80 mm × Receipt**
   (Epson: "Roll Paper 80 x 297 mm"; Star: "72mm x Receipt"). Leave margins at 0 if the driver offers them.
4. **Paper cut**: in the same preferences, set **cut at end of document** (Epson: "Paper Cut: Cut at end of
   document"; Star: "Page Cut Type: Partial Cut / Document").
5. **Cash drawer**: set the driver to **open the drawer at the start of every print job** (Epson: Printer
   properties → Peripherals / "Cash Drawer" → "Open drawer #1 before printing"; Star: "Peripheral Unit Type: Cash
   Drawer", "Cash Drawer 1 Action: Document Top"). The register prints on every completed sale, refund and No Sale,
   so this is what opens the drawer.
6. Print a Windows **test page** and check that the drawer pops open.

## 2. Chrome kiosk printing

The register prints receipts with the browser's print command. Chrome's `--kiosk-printing` flag sends those prints
straight to the default printer with no dialog.

1. Install Google Chrome and sign in to nothing (a plain local profile is fine).
2. Right-click the desktop → New → Shortcut. For the location, enter (one line):

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\DeerRunRegister" https://deerrun.golf/staff/register
   ```

   Name it **Deer Run Register**.
   - `--kiosk-printing` prints silently to the default printer.
   - `--user-data-dir` gives the register its own Chrome profile, so the flag applies (Chrome ignores new flags
     while another Chrome window using the same profile is open) and the register's settings stay separate.
   - Add `--kiosk` too if you want a full-screen window with no address bar. Leave it off until setup is done:
     exiting needs Alt+F4.
3. Close **all** Chrome windows, then open Chrome only from this shortcut.
4. Optional: put the shortcut in the Startup folder (Win+R → `shell:startup`) so it opens at sign-in.

**Check it:** sign in, open the register, ring up a $0 test item (or use **No Sale** with a manager) and confirm it
prints with no dialog and the drawer opens. If a print dialog appears, Chrome was already running when you used the
shortcut: close every Chrome window (check the system tray) and try again.

Schedules and timesheets printed from the same PC use the normal print dialog's page size. Receipt pages set an
80 mm page size only while a receipt is printing.

## 3. Pick the register

The first time the register page opens on a PC, it asks which register this is (e.g. "Pro Shop"). The choice is saved
in this browser and sent with every sale. Registers are managed in **Admin → Registers**; add one there first if
you're setting up a second station.

Switching a PC to a different register later needs a manager's approval. Clearing the browser's data (or using a
different `--user-data-dir`) also clears the choice.

## 4. Barcode scanner

1. Plug in the USB scanner. Most scanners default to **USB keyboard (HID)** mode; if not, scan the "USB Keyboard"
   setup barcode from the scanner's manual.
2. Make sure the scanner sends **Enter** after each code (the "suffix CR" or "Add Enter" setting in the manual).
3. **Test in Notepad**: scan a product. The barcode digits should appear followed by a new line.
4. **Test at the register**: the search box is focused automatically. Scan a product whose barcode or SKU is in
   **Admin → Products**; an exact match adds it to the cart. "Nothing matches" means the code isn't on any
   active variant yet: add it on the product's variant in Admin → Products.

## 5. Card reader (Stripe Terminal)

1. Power on the reader and connect it to the clubhouse Wi-Fi (or Ethernet with the S700 dock).
2. On the reader open **Settings → Generate pairing code**.
3. In **Admin → Registers**, click **+ Pair a reader** next to the register, enter the code, and keep or change the
   reader name. This creates the course's Stripe Terminal location the first time and assigns the reader to the
   register. The page then shows the reader as **Online**.
4. At the register, **Card** and **Split** are now enabled in the payment dialog. The customer taps, inserts or
   swipes on the reader; the sale completes by itself when the payment is approved.

To try it before the hardware arrives, use Stripe **test keys** and pair code `simulated-wpe`: that creates a simulated
reader, and the card dialog shows **Simulate card** / **Simulate decline** buttons.

Card refunds go back to the card from the register's Refund screen (no drawer needed). Cash refunds can't hand out more
than was paid in cash.

## 6. House accounts at the register

- **Charging:** attach the member, then choose **Account** in the payment dialog and turn the screen so the member can
  type their 4–6 digit PIN (they set it in My Account on the website). Five wrong tries lock it until an admin resets
  it in Admin → House Accounts.
- **Payments:** **Account payment** in the register header takes cash (into the drawer, with change and a receipt)
  or a card on the reader toward a member's balance.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Print dialog appears | Chrome wasn't started from the kiosk shortcut, or another Chrome window was open first. Close all Chrome windows (including the tray) and use the shortcut. |
| Receipt prints on letter paper / tiny text | The receipt printer isn't the Windows default, or the driver's paper size isn't 80 mm. |
| Drawer doesn't open | Check the drawer cable is in the printer's DK port (not a phone jack), and the driver's "open drawer before printing" setting. |
| Long blank tail after the receipt | Set the driver's paper cut to "end of document" and leave the length on "Receipt" (not a fixed page length). |
| Scanner types into the wrong place | Click the register's search box once. If codes run together, enable the scanner's Enter suffix. |
| Card dialog says the reader is offline | Check the reader's power and Wi-Fi; **Admin → Registers** shows its status. Then press **Try again**. |
| Card dialog says the reader is busy | Another payment is on the reader. Cancel it on the reader screen, then **Try again**. |
| "Card" is greyed out in the payment dialog | The register has no reader paired (Admin → Registers), or Stripe isn't configured. |
| "Your position is not set up to use the register" | Admin → Settings → Point of Sale: add the employee's position to the register positions. |
