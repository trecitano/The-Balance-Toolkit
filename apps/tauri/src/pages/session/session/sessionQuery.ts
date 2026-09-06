import { commands } from "@/utils/requests.ts";
import { Activity, SessionInformation } from "@/types.ts";

// Kept separate from the Session page so the navigation bar can subscribe to the session
// state without pulling the page (and the plotting code) into the main chunk.
export const SESSION_QUERY_KEY = ["session_key"];
export type SessionQueryData = {
  sessionInformation: SessionInformation;
  activities: Activity[];
};
export const SessionQuery = {
  queryKey: SESSION_QUERY_KEY,
  queryFn: async () => {
    const [sessionInformation, activities] = await Promise.all([
      commands.session.sessionInfo(),
      commands.activity.getActivities(),
    ]);

    return { sessionInformation, activities };
  },
};
