import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
// PRIVACY RULE: only tagId and completed are extracted from Firestore documents.
// evaluatorOutput, justification, confidence, and criteria fields are NEVER
// sent to the client — they live in Firestore for audit purposes only.
export function useTagProgress(sessionId) {
    const [progress, setProgress] = useState([]);
    useEffect(() => {
        if (!sessionId)
            return;
        const q = query(collection(db, "tag_progress"), where("sessionId", "==", sessionId));
        const unsub = onSnapshot(q, (snap) => {
            setProgress(snap.docs.map((d) => ({
                tagId: d.data()["tagId"],
                completed: d.data()["completed"],
            })));
        });
        return unsub;
    }, [sessionId]);
    return progress;
}
