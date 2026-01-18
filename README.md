# 2H Central Hub

The main dashboard for 2H Websolutions to manage clients, view global tasks, and control AI agents.

## 🎯 App Information

- **APP_ID**: `2h_hub_v1`
- **Purpose**: Central dashboard for 2H Websolutions operations
- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Firebase project configured

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Firebase:
   - Copy the `.env` file and replace placeholders with your Firebase credentials
   - Required environment variables:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`

4. Run the development server:
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
2h-central-hub/
├── src/
│   ├── components/
│   │   ├── DashboardShell.tsx   # Main layout wrapper
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   └── Header.tsx           # Sticky header
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # Entry point
│   └── index.css                # Tailwind directives
├── .env                         # Environment variables
├── vite.config.ts               # Vite configuration
└── tailwind.config.js           # Tailwind configuration
```

## 🎨 Design System

Following the 2H Websolutions brand identity:

- **Background**: `bg-slate-950` (Deep Dark)
- **Cards/Panels**: `bg-slate-900` with `border-slate-800`
- **Text**: Primary `text-slate-100`, Secondary `text-slate-400`
- **Brand Accent**: `bg-blue-700` hover: `bg-blue-600`
- **Icons**: Lucide React (stroke width 1.5)

## 📊 Features

### Current

- ✅ Dashboard Shell (Sidebar + Header + Main Content)
- ✅ Navigation menu (Dashboard, Clients, Tasks, Agents, Settings)
- ✅ Placeholder metrics cards
- ✅ Responsive layout

### Planned

- 🔄 Firebase Authentication
- 🔄 Client management
- 🔄 Global task tracking
- 🔄 AI agent chat interface
- 🔄 Real-time updates

## 🔒 Database Scope

All data is scoped under: `apps/2h_hub_v1/`

Following the data schema standards:
- **Tasks**: `apps/2h_hub_v1/tasks/{taskId}`
- **Memory**: `apps/2h_hub_v1/memory/{docId}`
- **Actions**: `apps/2h_hub_v1/actions/{actionId}`

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🛠 Tech Stack

- **React** 18.2.0
- **TypeScript** 5.2.2
- **Vite** 5.0.8
- **Tailwind CSS** 3.4.0
- **Firebase** 10.7.1
- **Lucide React** 0.294.0
- **React Router** 6.21.0

## 📄 License

Proprietary - 2H Websolutions

Last Update: App Factory Feature - 2026-01-18T17:51:56+01:00
