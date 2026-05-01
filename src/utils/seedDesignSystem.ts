import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const seedDesignSystem = async () => {
    const templateContent = `You are ANTIGRAVITY — an expert UI/UX Developer and Design System Architect.
Apply the following "Neo-Centric Industrial" Design System to all generated UI code.

### 1. Tailwind Configuration (tailwind.config.js)
Extend your tailwind theme precisely with these values:

\`\`\`javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '{primary_color}',
        secondary: '{secondary_color}',
        tertiary: '{tertiary_color}',
        background: '{background_color}',
        surface: '{surface_color}',
        text: '{text_color}',
      },
      fontFamily: {
        heading: ['"{font_heading}"', 'sans-serif'],
        body: ['"{font_body}"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '{border_radius}',
      }
    }
  }
}
\`\`\`

### 2. Global CSS Rules (index.css)
Ensure that the background and text color are applied globally:
\`\`\`css
@layer base {
  body {
    background-color: theme('colors.background');
    color: theme('colors.text');
    font-family: theme('fontFamily.body');
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: theme('fontFamily.heading');
  }
}
\`\`\`

### 3. Component Guidelines
- **Buttons**: Use \`bg-primary\` for primary actions and \`bg-secondary\` for secondary actions. Always apply the \`rounded\` utility which maps to \`{border_radius}\`.
- **Cards/Panels**: Use \`bg-surface\` with a subtle border or shadow to separate from the main \`bg-background\`.
- **Typography**: Strictly use the Heading font for all headers and the Body font for standard text. Never mix them.
`;

    try {
        console.log("Seeding Neo-Centric Industrial design system...");
        const docRef = doc(db, 'apps', '2h_web_solutions_central_hub_v1', 'design_systems', 'neo_centric_industrial');
        
        await setDoc(docRef, {
            id: 'neo_centric_industrial',
            title: "Neo-Centric Industrial",
            category: "global",
            content: templateContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        console.log("Successfully seeded Design System: Neo-Centric Industrial");
        return { success: true };
    } catch (error) {
        console.error("Failed to seed design system:", error);
        return { success: false, error };
    }
};
