import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import type { TagProgressItem } from "@salvador/shared";

// PRIVACY RULE: only tagId and completed are extracted from Firestore documents.
// evaluatorOutput, justification, confidence, and criteria fields are NEVER
// sent to the client — they live in Firestore for audit purposes only.
//
// allTagIds seeds the bars immediately from the scenario's requiredTags so
// they appear on turn 1 rather than after Call B first writes to Firestore.
export function useTagProgress(sessionId: string, allTagIds: string[] = []): TagProgressItem[] {
  const [firestoreProgress, setFirestoreProgress] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!sessionId) return;

    const q = query(
      collection(db, "tag_progress"),
      where("sessionId", "==", sessionId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, boolean>();
      for (const d of snap.docs) {
        map.set(d.data()["tagId"] as string, d.data()["completed"] as boolean);
      }
      setFirestoreProgress(map);
    });

    return unsub;
  }, [sessionId]);

  // Merge: seed with allTagIds (completed=false), then overlay Firestore state.
  return useMemo(() => {
    const ids = allTagIds.length > 0
      ? allTagIds
      : Array.from(firestoreProgress.keys());
    return ids.map((tagId) => ({
      tagId,
      completed: firestoreProgress.get(tagId) ?? false,
    }));
  }, [allTagIds, firestoreProgress]);
}
