import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const migrateDesignSystems = async () => {
    try {
        console.log("Starting migration of design rules to design_systems collection...");
        const rulesRef = collection(db, 'apps', '2h_web_solutions_central_hub_v1', 'rules');
        const rulesSnap = await getDocs(rulesRef);
        
        let migratedCount = 0;
        
        for (const ruleDoc of rulesSnap.docs) {
            const ruleData = ruleDoc.data();
            
            // Check if the rule is actually a design system
            if (ruleData.category === 'design') {
                console.log(`Migrating design system: ${ruleData.title} (${ruleDoc.id})`);
                
                // Write to design_systems collection
                const newDesignRef = doc(db, 'apps', '2h_web_solutions_central_hub_v1', 'design_systems', ruleDoc.id);
                await setDoc(newDesignRef, {
                    ...ruleData,
                    id: ruleDoc.id // Keep the same ID to maintain project associations
                });
                
                // Delete from rules collection
                await deleteDoc(ruleDoc.ref);
                migratedCount++;
            }
        }
        
        console.log(`Migration completed successfully! Migrated ${migratedCount} design systems.`);
        return { success: true, count: migratedCount };
    } catch (error) {
        console.error("Migration failed:", error);
        return { success: false, error };
    }
};
