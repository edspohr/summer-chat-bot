# Summer ChatBot

Welcome to the Summer ChatBot project! This repository contains the fullstack code for a clinical training platform developed for Fundación Summer, designed to teach and practice Emotional First Aid using the OASIS methodology.

## Recent Updates & Upgrades

The platform recently underwent a significant upgrade in both its content and UX/UI:

### 1. New Simulation Scenario: Martina Cáceres
- **Profile**: A 16-year-old student showing signs of passive suicidal ideation and emotional withdrawal.
- **Goal**: Trainees must practice the OASIS methodology (Observe, Accommodate, Support) without triggering her resistance or breaking trust.
- **Data Layer**: A new seed script \`seed-scenario-03-martina.ts\` was created to load her profile, psychological triggers, and specific tags (like \`T_01_OBSERVA_SENALES_S03\`) into Firestore. Older test scenarios were deactivated.
- **Avatar**: Integrated a custom high-resolution avatar image (\`/avatar-martina.png\`) to increase empathy and character presence during the session.

### 2. Time-boxed Coach Sessions
- **Session Timer**: In the Coach Session, a strict 5-minute interaction window is enforced. 
- **Auto-Redirect**: When the timer expires, the session is locked and the user is automatically redirected to the feedback report.

### 3. Structured Performance Feedback
- The \`SessionReport\` view was completely redesigned.
- Calculates an objective **"Nivel de logro" (%)** based on the matched behavioral tags.
- Provides a detailed breakdown of:
  - **Competencias Demostradas**: Behaviors the user successfully applied.
  - **Oportunidades de Mejora**: Behaviors that were missed, along with actionable recommendations.
  - **Conclusión General**: A tailored summary dynamically generated based on the final percentage.

### 4. Global UX/UI & Branding Overhaul
- Shifted the design to match the Summer brand identity, using a pastel palette.
- **Summer ChatBot Identity**: Renamed the virtual assistant from "Salvador" to **Summer ChatBot** across all modes.
- **Mentor Mode Upgrade**:
  - Implemented a new design for the Mentor Mode with a clean, containerized chat interface.
  - Added a dedicated avatar for the mentor (\`/avatar-mentor.jpg\`).
  - Updated the system prompt to reflect the new identity and tone.
- **Unified Auth Design**: The Login, Register, and Forgot Password screens now use the brand's typography and color system.
- **Typography**: Replaced standard typography with an expressive modern font stack: **Montserrat**, **Be Vietnam Pro**, and **Anton**.
- **Unified Components**: Applied organic UI components with highly rounded corners (\`rounded-2xl\`, \`rounded-3xl\`), subtle shadows, and smooth hover interactions across the entire application (Home, Auth, Scenarios, Session, Mentor, and Report screens).
- See \`docs/design_guidelines.md\` for a complete overview of the design system.

## Setup & Deployment

### Local Development
1. Install dependencies: \`pnpm install\`
2. Start the web package: \`cd packages/web && pnpm run dev\`

### Deployment
To deploy the web application:
\`\`\`bash
cd packages/web
pnpm run build
cd ../..
npx firebase-tools deploy --only hosting
\`\`\`
