# Flowstate Frontend

**Flowstate** is an AI-powered personal secretary that transforms your messy todo list into a perfectly structured Google Calendar schedule. By leveraging the power of Google AI (Gemini/Gemma), it intelligently negotiates your constraints, preferences, and existing commitments to find the flow in your day.

[Flowstate Preview](https://www.flowstate-calendar.work/)

## 🌟 Features

- **Natural Language Input:** Just type what you need to do (e.g., "Gym for an hour", "Meeting with Sarah at 2pm") and let the AI handle the placement.
- **Dynamic Day Calendar:** A beautiful, responsive calendar view that syncs in real-time with your Google Calendar.
- **Smart Constraints:**
  - **Break Time:** Automatically inserts buffers between tasks.
  - **Burnout Protection:** Splits long tasks into manageable sessions.
  - **Context Switching:** Groups similar tasks to keep you in the zone.
  - **No-Work Zones:** Define windows where you are absolutely unavailable.
- **Theming:** Choose between **Midnight**, **Warm**, and **Light** modes to suit your workspace.
- **Interactive Workspace:** Drag and resize your view to focus on your schedule or your list.

## 🚀 Tech Stack

- **Framework:** React 19
- **Styling:** Vanilla CSS with a custom design system and multi-theme support.
- **Authentication:** Google OAuth 2.0 (via `@react-oauth/google`).
- **State Management:** React Hooks (useMemo, useCallback, useRef).

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A running instance of the [Flowstate Backend](https://github.com/xckev/flowstate-backend)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/xckev/flowstate-ai.git
   cd flowstate-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

4. **Run the development server:**
   ```bash
   npm start
   ```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🎨 Themes

Flowstate comes with three curated themes:
- 🌌 **Midnight:** A sleek, deep-space dark mode (Default).
- 🪵 **Warm:** A cozy, earth-toned dark mode for late-night planning.
- ☀️ **Light:** A crisp, high-contrast mode for bright environments.

## 🤝 Backend Integration

This frontend communicates with the **[Flowstate Backend](https://github.com/xckev/flowstate-backend)** via a RESTful API. It uses JWT authentication stored in `localStorage` to maintain secure sessions.
