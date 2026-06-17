import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import type { TagProgressItem } from "@salvador/shared";

// PRIVACY RULE: only tagId and completed are extracted from Firestore documents.
// evaluatorOutput, justification, confidence, and criteria fields are NEVER
// sent to the client — they live in Firestore for audit purposes only.
export function useTagProgress(sessionId: string): TagProgressItem[] {
  const [progress, setProgress] = useState<TagProgressItem[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, "tag_progress"),
      where("sessionId", "==", sessionId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setProgress(
        snap.docs.map((d) => ({
          tagId: d.data()["tagId"] as string,
          completed: d.data()["completed"] as boolean,
        }))
      );
    });

    return unsub;
  }, [sessionId]);

  return progress;
}
