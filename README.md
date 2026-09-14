# Kaunter Digital MDK

Kiosk mock for Majlis Daerah Kerian. Built for counter replacement, especially older residents who will not use the mobile app.

## Three ways in

1. **MyKad** — insert card, see assessment and compounds, pay.
2. **Voice** — live agent (always listening, speaks back), then pay.
3. **Scan** — hold a paper bill or summons to the kiosk camera.
4. **Key in** — type account, notice, plate, or MyKad on the on-screen keyboard.

Payment is **DuitNow QR** or the **card terminal**. This is a frontend mock: hardware (reader, terminal, camera, printer) is simulated.

## Run

```bash
npm install
npm run dev
```

Open the local URL and use the kiosk at a large viewport (around 1440×900 or 1920×1080).

For the live voice assistant, copy `.env.example` to `.env` and set `OPENAI_API_KEY`. The key stays on the local Vite server and is not published to GitHub Pages.

## GitHub Pages

https://rushdantech.github.io/mdk-kiosk-app/
