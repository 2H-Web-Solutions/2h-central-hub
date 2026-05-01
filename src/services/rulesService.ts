import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type RuleCategory = 'global' | 'app' | 'website' | 'webshop';

export interface Rule {
    id: string;
    title: string;
    category: RuleCategory;
    content: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const RULES_COLLECTION = 'apps/2h_web_solutions_central_hub_v1/rules';

/**
 * Generates a slugified string from a title.
 * E.g., "Global App Rule" -> "global_app_rule"
 */
export const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')           // Replace spaces with _
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\_\_+/g, '_')         // Replace multiple _ with single _
        .replace(/^_+/, '')             // Trim _ from start of text
        .replace(/_+$/, '');            // Trim _ from end of text
};

export const rulesService = {
    /**
     * Fetch all rules, ordered by title
     */
    async getAllRules(): Promise<Rule[]> {
        const q = query(collection(db, RULES_COLLECTION), orderBy('title', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rule));
    },

    /**
     * Fetch a single rule by ID
     */
    async getRule(id: string): Promise<Rule | null> {
        const docRef = doc(db, RULES_COLLECTION, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Rule;
        }
        return null;
    },

    /**
     * Create a new rule. The ID is generated from the title using slugify.
     */
    async createRule(data: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const slugifiedId = slugify(data.title);
        const docRef = doc(db, RULES_COLLECTION, slugifiedId);
        
        const newRule = {
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(docRef, newRule);
        return slugifiedId;
    },

    /**
     * Update an existing rule
     */
    async updateRule(id: string, data: Partial<Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
        const docRef = doc(db, RULES_COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        });
    },

    /**
     * Delete a rule
     */
    async deleteRule(id: string): Promise<void> {
        const docRef = doc(db, RULES_COLLECTION, id);
        await deleteDoc(docRef);
    }
};
