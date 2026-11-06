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

## Orders app

- `/app` is the Cynthia Orders app: new orders live (with alerts) and order history. It can be installed from the browser.
- `/download` is the download page for the app.
- `android/` is the Android app. Every change in `android/` is built by GitHub Actions (`.github/workflows/android.yml`) and the APK is published to `/download/cynthia-orders.apk`.
- To keep the same signing key between Android builds, add repository secrets `CFF_KEYSTORE_BASE64` and `CFF_KEYSTORE_PASSWORD`. Without them, each build gets a new key and the old app must be uninstalled before installing a new build.

## Ordering and Bolt Food

- Website orders are placed directly on the site (saved to Firestore). WhatsApp is only a fallback if saving fails.
- `api/bolt/webhook.js` receives Bolt Food orders and saves them as `orders/BOLT-<id>` with `source: "bolt"`.
  - Needs `FIREBASE_SERVICE_ACCOUNT` (service-account JSON) set in Vercel.
  - Bolt authenticates with the token created in the admin panel (Settings → Bolt Food), stored in Firestore `config/bolt`.
  - The original Bolt message is kept in `rawBolt` so the field mapping can be adjusted once Bolt sends real orders.
- `menu.json` is the menu feed (also downloadable as CSV from admin Settings → Bolt Food). Regenerate it when the menu in `index.html` changes.
