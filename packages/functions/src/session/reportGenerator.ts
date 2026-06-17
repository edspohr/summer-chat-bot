// STUB — see docs/debt/0004-report-generation-stub.md
// Format and content depend on clinical decisions pending from Fundación Summer.
export interface SessionReport {
  sessionId: string;
  completedTags: string[];
  partialTags: string[];
  notObservedTags: string[];
  antiPatternsLogged: string[];
}

export async function generateReport(
  _sessionId: string
): Promise<SessionReport> {
  return {
    sessionId: _sessionId,
    completedTags: [],
    partialTags: [],
    notObservedTags: [],
    antiPatternsLogged: [],
  };
}
