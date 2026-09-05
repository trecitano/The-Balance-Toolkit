import { commands } from "@/utils/requests.ts";

// Kept separate from the Devices page so that other pages can share the query without
// pulling the page (and everything it imports) into their chunk.
export const DEVICES_QUERY_KEY = ["devices"];
export const DevicesQuery = {
  queryKey: DEVICES_QUERY_KEY,
  queryFn: async () => {
    const [devices, selectedDevicesMacAddress, isScanning] = await Promise.all([
      commands.devices.fetchDevices(),
      commands.devices.selectedDevices(),
      commands.devices.isScanning(),
    ]);
    return { devices, selectedDevicesMacAddress, isScanning };
  },
};
