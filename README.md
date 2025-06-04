# Pressure Cooker Whistle Counter

A Vite + React + TypeScript web app that counts Indian pressure cooker whistles using the microphone and gives an alarm after a set number of whistles. The app features:

- **Audio processing and whistle detection** using a robust multi-algorithm system
- **Microphone access** for real-time whistle counting
- **Sample whistle recording** and template-based detection
- **Live frequency spectrum visualization**
- **Speech recognition assist** (optional)
- **User-friendly UI**
- **Automated tests** with Jest and Testing Library
- **One-click deploy to GitHub Pages**

## 🚀 Live Demo
[https://mkgmadhan.github.io/whistleCounter](https://mkgmadhan.github.io/whistleCounter)

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
```sh
npm install
```

### Development
```sh
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing
```sh
npm test
```

### Build
```sh
npm run build
```

## 🧪 Whistle Detection Algorithm
- Multi-algorithm scoring (peak prominence, sharpness, focus, distribution, temporal consistency, template matching)
- Real-time frequency analysis (FFT)
- Adaptive noise filtering and anti-false-positive logic
- Optional speech recognition for whistle-like sounds

## 🎤 How to Use
1. **Record a sample whistle** (optional, improves accuracy)
2. **Set the alarm threshold** (number of whistles)
3. **Click Start** to begin listening
4. The app will count whistles and alert you when the threshold is reached

## 🌐 Deployment (GitHub Pages)
1. Set the `homepage` field in `package.json` to your repo URL
2. Deploy with:
   ```sh
   npm run deploy
   ```
3. Your app will be live at `https://<your-username>.github.io/<repo-name>`

## 📁 Project Structure
- `src/WhistleCounter.tsx` — Main app logic and UI
- `src/WhistleCounter.test.tsx` — Automated tests
- `public/` — Static assets

## 🙏 Credits
- Built with [Vite](https://vitejs.dev/), [React](https://react.dev/), and [TypeScript](https://www.typescriptlang.org/)

---

MIT License
