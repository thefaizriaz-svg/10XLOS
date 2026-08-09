# LOS — Life Operating System (V1)

A compass, not a manager. Five tabs: Home, Goals, Blueprint, Brain, System.

## What this is right now
Plain HTML / CSS / vanilla JS ES modules. No build step, no framework.
Data lives in **Firestore** (project `10XLOS`), synced live via
`onSnapshot`, with offline persistence so it still works with no signal.
Auth is anonymous — no login screen, the device just gets a stable
identity on first open.

## Run it locally
Firestore requires a real origin (not `file://`). Serve the folder instead
of double-clicking `index.html`:
```
npx serve .
```

## Deploy to GitHub Pages
1. Push this folder's *contents* to a GitHub repo (index.html, css/, js/,
   icons/, manifest.json, sw.js all at the repo root).
2. Repo → Settings → Pages → Deploy from branch → `main` → `/ (root)`.
3. Your app is live at `https://<username>.github.io/<repo>/`.
4. In the Firebase console → Authentication → Settings → Authorized
   domains → add your `github.io` URL (Firebase blocks unlisted origins).

## Firestore rules
Paste into Firebase console → Firestore Database → Rules — locks every
user to their own document only:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/los/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Philosophy
> LOS is not where I manage my life. LOS is where I remember who I am, why
> I am doing what I am doing, and whether I am moving in the right direction.

If a feature makes you spend more time inside LOS instead of living your
life, it doesn't belong here.
