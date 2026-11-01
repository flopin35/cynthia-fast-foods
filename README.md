# Cynthia Fast Foods

Website for Cynthia Fast Foods: menu, meal deals and online ordering through WhatsApp.

- **Orders go to:** WhatsApp 024 010 4225
- **Call:** 050 873 9020
- **Open:** daily, 8am to 7pm

## Editing

Everything is in `index.html`. Near the top of the script you'll find:

- `BUSINESS`: phone, WhatsApp number, address, delivery fee, opening hours
- `BOOSTERS`: meal deals, "Make it a meal" offer, checkout offer, rewards, lunch deal, welcome code
- `MENU`: dish names, descriptions and prices

Commit a change to `main` and GitHub Pages republishes the site within a minute or two.

## Live site

Hosted on Vercel: https://cynthia-fast-foods.vercel.app (redeploys automatically on every push to `main`).

## Admin panel

`/admin` is the sales dashboard. Orders placed on the website are saved to Firebase (Cloud Firestore, project `cynthia-a3d2b`, collection `orders`) and appear in the admin panel instantly.

- Log in with the admin email and password created in Firebase → Authentication.
- Who can read or change orders is controlled by the Firestore security rules (Firebase console → Firestore → Rules).
- The admin panel keeps a copy of orders on the device, so it keeps working with a weak connection and syncs when back online.
