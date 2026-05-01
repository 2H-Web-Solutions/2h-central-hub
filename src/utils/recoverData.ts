import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const recoverData = async () => {
    try {
        console.log("Starting recovery of design systems from old namespace...");
        const oldRef = collection(db, 'apps', '2h_web_solutions_central_hub_v1', 'design_systems');
        const oldSnap = await getDocs(oldRef);
        
        let migratedCount = 0;
        
        for (const ruleDoc of oldSnap.docs) {
            const data = ruleDoc.data();
            console.log(`Recovering: ${data.title} (${ruleDoc.id})`);
            
            // Write to new correct collection
            const newRef = doc(db, 'apps', '2h_hub_v1', 'design_systems', ruleDoc.id);
            await setDoc(newRef, {
                ...data,
                id: ruleDoc.id
            });
            
            migratedCount++;
        }
        
        console.log(`Recovery completed successfully! Recovered ${migratedCount} design systems.`);
        return { success: true, count: migratedCount };
    } catch (error) {
        console.error("Recovery failed:", error);
        return { success: false, error };
    }
};
