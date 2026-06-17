import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
function getCallable(name) {
    const functions = getFunctions(getApp(), "southamerica-west1");
    return httpsCallable(functions, name);
}
export const callMentorChat = getCallable("mentorChat");
export const callCoachTurn = getCallable("coachTurn");
export const callTimerOverride = getCallable("timerOverride");
export const callLabChat = getCallable("labChat");
