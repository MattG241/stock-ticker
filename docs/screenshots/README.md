# Screenshots

Captured via headless Chromium against a fresh build with seed orders, an
RSA refusal logged, and a 30% / 90s crash triggered. The images below render
on GitHub directly.

## Customer-facing displays

### Main display - normal trading
![Main display](./02-display-main.png)
Drink name leads, ticker chip below. "Recent prints" strip shows live sales,
"5-min mover" callout highlights the biggest mover of the last 5 minutes.

### Main display - crash mode
![Crash mode](./04-display-crash.png)
HALT banner with countdown, every dynamic drink shows strikethrough +
discounted price, ticker tape in red.

### Featured display (tabletop, three-up rotation)
![Featured display](./03-display-featured.png)

### Tape display (narrow screen, scrolling ticker only)
![Tape display](./16-display-tape.png)

## POS

### POS desktop - cart with quantity inputs and +4/+6/+8 shortcuts
![POS cart](./05-pos-cart.png)

### Tab modal with ID-checked toggle
![POS tab modal](./05b-pos-tab-modal.png)

### POS on an iPad-sized viewport
![POS iPad](./15-pos-ipad.png)

## Bar queue

### `/bar` - what the person making drinks sees
![Bar queue](./18-bar-queue.png)

## Admin

### Overview
![Admin overview](./07-admin-overview.png)

### Crash Centre - manual + scheduled crashes + social webhook
![Crash centre](./06-admin-crash.png)

### Menu - 14 row table with ticker symbols
![Menu](./08-admin-menu.png)

### Market parameters
![Market](./09-admin-market.png)

### Staff
![Staff](./10-admin-staff.png)

### Shifts and Z-report
![Shifts with Z-report](./11-admin-shifts-zreport.png)

### Audit log
![Audit log](./13-admin-audit.png)

### RSA refusals
![Refusals](./17-admin-refusals.png)

## Dashboard

### Desktop
![Dashboard desktop](./12-dashboard.png)

### Phone (iPhone 14 width)
![Dashboard phone](./14-dashboard-phone.png)

## Receipts

### ATO-compliant tax invoice
![Receipt](./19-receipt.png)
Business name, ABN, address, ex-GST subtotal, GST 10%, cash adjustment,
total inc GST, payment method, charge id. Cash totals are rounded to the
nearest 5c per AU convention.

## Landing

![Landing](./01-landing.png)
