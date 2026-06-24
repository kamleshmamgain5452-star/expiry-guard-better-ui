# 🔑 API Key Setup Guide

This app uses the **Groq API** to read text from product label images.
For it to work, you need your **own free Groq API key**.

The key is **not** included in this code (for security). Each person who runs
the app provides their own key. It takes about 2 minutes to set up.

---

## Step 1 — Create a Groq account

1. Go to **https://console.groq.com**
2. Click **Sign Up** (you can use Google or email).
3. Verify your email if asked.

> It's free. No credit card is required to get started.

---

## Step 2 — Generate your API key

1. Once logged in, go to **https://console.groq.com/keys**
2. Click **Create API Key**.
3. Give it any name (for example: `expiry-guard`).
4. Click **Submit**.
5. **Copy the key immediately** — it starts with `gsk_...`

> ⚠️ You can only see the key **once**. If you lose it, just delete it and
> create a new one — that's totally fine.

---

## Step 3 — Add the key to the project

1. In the project folder, find the file named **`.env.example`**.
2. Make a copy of it and rename the copy to **`.env.local`**.

   On Mac/Linux you can do this in the terminal:
   ```bash
   cp .env.example .env.local
   ```

3. Open **`.env.local`** in any text editor.
4. Replace the placeholder with your real key:

   ```bash
   NEXT_PUBLIC_API_URL=/api
   GROQ_API_KEY=gsk_paste_your_real_key_here
   ```

   > Leave `NEXT_PUBLIC_API_URL` as `/api`. The scan API runs inside this
   > Next.js app, so this relative path works on localhost and on Vercel
   > with no changes.

5. Save the file.

> ✅ `.env.local` is private — it is ignored by Git and will **never** be
> uploaded to GitHub. Your key stays safe on your own computer.

---

## Step 4 — Run the app

Install dependencies (only needed the first time):

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. 🎉

The scanner will now use your Groq key to read labels.

---

## Deploying online (Vercel)

The whole app — frontend **and** the scan API — runs together on Vercel.
You do **not** need a separate backend server or any URL setup. The only
thing Vercel needs from you is your Groq key.

1. Push your code to GitHub (already done if you're reading this).
2. Go to **https://vercel.com** and click **Add New → Project**.
3. Import your GitHub repo and click **Deploy**.
4. After it deploys, go to **Settings → Environment Variables** and add:
   - **Name:** `GROQ_API_KEY`
   - **Value:** your `gsk_...` key
   - (Optional) **Name:** `NEXT_PUBLIC_API_URL`  **Value:** `/api`
5. Go to the **Deployments** tab and click **Redeploy** so the key takes effect.

That's it — your app is live. 🚀

> ❗ Never upload your `.env.local` file. It stays on your computer. Vercel gets
> the key only through the Environment Variables screen above.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Error: `GROQ_API_KEY is not set` | You forgot Step 3, or named the file wrong. It must be exactly `.env.local`. |
| Changes to `.env.local` not working | Stop the app (Ctrl + C) and run `npm run dev` again. The key is only read on startup. |
| Key stopped working | Delete it at https://console.groq.com/keys and create a new one. |
| Don't want to lose your key | Save it in a password manager. Never paste it directly into the code. |

---

## ❌ Never do this

Do **not** paste your key directly into a code file like:

```ts
const key = "gsk_abc123...";   // ❌ BAD — anyone can steal it
```

Always keep it in `.env.local`. That's the whole point of this setup. 🔒
