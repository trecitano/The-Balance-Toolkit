import { useQueryClient } from "@tanstack/react-query";
import { events } from "@/bindings";
import { useTauriEvent } from "@/hooks/useTauriEvent";
import { ActivityStateQuery, LastSessionQuery, ReplayQuery, refreshDevices, refreshUsers } from "@/queries/toolkit";

/** Resource caches stay current even when the page that edits them is unmounted. */
export function ToolkitEvents() {
  const client = useQueryClient();
  const refreshSession = () => {
    void refreshUsers(client);
    void client.invalidateQueries(ActivityStateQuery);
    void client.invalidateQueries(LastSessionQuery);
  };
  useTauriEvent(events.newBoard, () => {
    void refreshDevices(client);
  });
  useTauriEvent(events.boardDisconnected, () => {
    void refreshDevices(client);
  });
  useTauriEvent(events.sessionStarted, refreshSession);
  useTauriEvent(events.sessionCompleted, refreshSession);
  useTauriEvent(events.sessionActivityChanged, () => {
    void client.invalidateQueries(ActivityStateQuery);
  });
  useTauriEvent(events.replayCompleted, () => {
    void client.invalidateQueries(ReplayQuery);
  });
  return null;
}
