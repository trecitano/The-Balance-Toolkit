import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { commands } from "@/utils/requests";
import type { Activity, SessionSettings, User } from "@/types";

export const ActivitiesQuery = queryOptions({ queryKey: ["activities"], queryFn: commands.activity.getActivities });
export const BlocksQuery = queryOptions({
  queryKey: ["available-blocks"],
  queryFn: commands.activity.getAvailableTimeBlocks,
  staleTime: Infinity,
});
export const UsersQuery = queryOptions({ queryKey: ["users"], queryFn: commands.users.userPageInformation });
export const SessionQuery = queryOptions({
  queryKey: ["session_key"],
  queryFn: async () => ({ sessionInformation: await commands.session.sessionInfo() }),
});
export const ReplayQuery = queryOptions({ queryKey: ["replay_key"], queryFn: commands.replay.replayInfo });
export const LastSessionQuery = queryOptions({
  queryKey: ["last-session"],
  queryFn: commands.replay.loadLastSessionDetails,
});
export const SettingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => ({ loadedSettings: await commands.settings.getSettings() }),
});
export const DevicesQuery = queryOptions({
  queryKey: ["devices"],
  queryFn: async () => {
    const [devices, selectedDevicesMacAddress, isScanning] = await Promise.all([
      commands.devices.fetchDevices(),
      commands.devices.selectedDevices(),
      commands.devices.isScanning(),
    ]);
    return { devices, selectedDevicesMacAddress, isScanning };
  },
});
export const ActivityStateQuery = queryOptions({
  queryKey: ["session_activity_pop_up"],
  queryFn: commands.session.getActivityState,
});

export async function refreshUsers(client: QueryClient) {
  await Promise.all([client.invalidateQueries(UsersQuery), client.invalidateQueries(SessionQuery)]);
}
export async function refreshDevices(client: QueryClient) {
  await Promise.all([client.invalidateQueries(DevicesQuery), refreshUsers(client)]);
}
export async function refreshActivities(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries(ActivitiesQuery),
    client.invalidateQueries(SessionQuery),
    client.invalidateQueries(ActivityStateQuery),
  ]);
}
export function useSaveActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (activity: Activity) => commands.activity.updateActivity(activity),
    onSuccess: () => refreshActivities(client),
  });
}
export function useResetActivity() {
  const client = useQueryClient();
  return useMutation({ mutationFn: commands.activity.resetActivity, onSuccess: () => refreshActivities(client) });
}
export function useSaveUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => commands.users.updateUser(user),
    onSuccess: () => refreshUsers(client),
  });
}

// Commit a validated value, then fetch the backend's authoritative configuration.
// Both pages disable edits while saving, avoiding overlapping optimistic snapshots.
export function useSaveConfiguration(target: "session" | "replay") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: SessionSettings) =>
      target === "session" ? commands.session.updateSession(value) : commands.replay.updateReplay(value),
    onSuccess: async () => {
      if (target === "session") await refreshUsers(client);
      else await client.invalidateQueries(ReplayQuery);
    },
  });
}
