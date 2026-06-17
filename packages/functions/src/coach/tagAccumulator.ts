import { FieldValue } from "firebase-admin/firestore";
import type { EvaluatorRawOutput, TagDefinition } from "@salvador/shared";
import { db } from "../config/firebase.js";

// 0.9 decay per turn: evidence accumulates but older turns contribute less.
const DECAY = 0.9;
const TAG_PROGRESS_COLLECTION = "tag_progress";

function docId(sessionId: string, tagId: string): string {
  return `${sessionId}_${tagId}`;
}

export async function accumulateTags(params: {
  sessionId: string;
  evaluatorOutput: EvaluatorRawOutput;
  pendingTags: TagDefinition[];
  turnNumber: number;
}): Promise<void> {
  const { sessionId, evaluatorOutput, pendingTags, turnNumber } = params;
  if (evaluatorOutput.evaluated_tags.length === 0) return;

  const tagDefMap = new Map<string, TagDefinition>(pendingTags.map((t) => [t.tagId, t]));

  await Promise.all(
    evaluatorOutput.evaluated_tags.map(async (evalTag) => {
      const tagDef = tagDefMap.get(evalTag.tag_id);
      if (tagDef === undefined) return; // skip tags not in pending list

      const docRef = db.collection(TAG_PROGRESS_COLLECTION).doc(docId(sessionId, evalTag.tag_id));

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);

        const existing = snap.exists
          ? (snap.data() as { cumulativeScore: number; observedBehaviors: string[]; completed: boolean })
          : { cumulativeScore: 0, observedBehaviors: [], completed: false };

        // Skip if already completed — no further accumulation needed.
        if (existing.completed) return;

        // 1. Decay existing score.
        const decayed = existing.cumulativeScore * DECAY;

        // 2. Weight: full credit if any MUSTs were met, half if only weak evidence.
        const weight = evalTag.musts_met.length > 0 ? 1.0 : evalTag.evidence_detected ? 0.5 : 0.0;

        // 3. Accumulate.
        const newScore = decayed + evalTag.confidence * weight;

        // 4. Completion check against the tag's threshold.
        const completed = newScore >= tagDef.confidenceThreshold;

        // 5. Merge new observed behaviors (deduplicated).
        const allBehaviors = [
          ...existing.observedBehaviors,
          ...evalTag.observed_behaviors,
        ];
        const uniqueBehaviors = [...new Set(allBehaviors)];

        const now = FieldValue.serverTimestamp();
        if (!snap.exists) {
          tx.set(docRef, {
            sessionId,
            tagId: evalTag.tag_id,
            cumulativeScore: newScore,
            completed,
            observedBehaviors: uniqueBehaviors,
            justification: evalTag.justification,
            ...(completed && { confidenceFinal: newScore, turnDetected: turnNumber }),
            evidenceTurns: [{ turnNumber, confidence: evalTag.confidence, weight }],
            updatedAt: now,
          });
        } else {
          tx.update(docRef, {
            cumulativeScore: newScore,
            completed,
            observedBehaviors: uniqueBehaviors,
            justification: evalTag.justification,
            ...(completed && { confidenceFinal: newScore, turnDetected: turnNumber }),
            evidenceTurns: FieldValue.arrayUnion({ turnNumber, confidence: evalTag.confidence, weight }),
            updatedAt: now,
          });
        }
      });
    })
  );
}
