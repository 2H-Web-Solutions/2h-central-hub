import { collection, doc, setDoc, deleteDoc, getDoc, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DesignSystem {
    id: string;
    title: string;
    content: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const COLLECTION_PATH = 'apps/2h_web_solutions_central_hub_v1/design_systems';

export const designSystemService = {
    // 1. Get all design systems
    async getAllDesignSystems(): Promise<DesignSystem[]> {
        const q = query(collection(db, COLLECTION_PATH), orderBy('title', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as DesignSystem[];
    },

    // 2. Get a single design system by ID
    async getDesignSystem(id: string): Promise<DesignSystem | null> {
        const docRef = doc(db, COLLECTION_PATH, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            } as DesignSystem;
        }
        return null;
    },

    // 3. Save (Create or Update) a design system
    async saveDesignSystem(id: string, data: Partial<DesignSystem>): Promise<void> {
        const docRef = doc(db, COLLECTION_PATH, id);
        
        const payload = {
            ...data,
            updatedAt: Timestamp.now()
        };

        if (!data.createdAt) {
            payload.createdAt = Timestamp.now();
        }

        await setDoc(docRef, payload, { merge: true });
    },

    // 4. Delete a design system
    async deleteDesignSystem(id: string): Promise<void> {
        const docRef = doc(db, COLLECTION_PATH, id);
        await deleteDoc(docRef);
    }
};
