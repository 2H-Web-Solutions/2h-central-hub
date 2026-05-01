import { db } from '../lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const seedDesignRule = async () => {
    try {
        const docRef = doc(db, 'apps', '2h_web_solutions_central_hub_v1', 'rules', 'design_system_neo_centric');
        
        const content = `---
name: Neo-Centric Industrial
description: A modern, hybrid theme blending deep industrial elements with sharp, high-contrast neon accents.
colors:
  primary: "{primary}"
  secondary: "{secondary}"
  tertiary: "{tertiary}"
  background_dark: "#101010"
  background_light: "#F0F0F3"
typography:
  headings: "Federo"
  body: "Barlow"
---

# Design System Rules

1. Use the hybrid theme (Dark Navigation, Light Content).
2. Buttons should be pill-shaped (rounded-full).
3. Primary actions must use the {primary} color to ensure high visibility and a professional look.
`;

        await setDoc(docRef, {
            id: 'design_system_neo_centric',
            title: "Design System - Neo-Centric Industrial",
            category: "global",
            content: content,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        
        console.log("Design rule seeded successfully!");
    } catch (error) {
        console.error("Error seeding design rule:", error);
        throw error;
    }
};
