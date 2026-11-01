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

`/admin` is the sales dashboard. Orders placed on the website are saved through `api/orders.js` into a private Vercel Blob store (`cynthia-orders`) and show up in the admin panel automatically.

The admin password is the `ADMIN_PASSWORD` environment variable in Vercel (Project → Settings → Environment Variables). Change it there and redeploy to change the password.
