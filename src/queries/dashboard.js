import { useQueries } from "@tanstack/react-query";
import { apiRequest } from "../api/client.js";

const STARTUP_QUERIES = [
  ["incidents", "/incidents", 0],
  ["users", "/users", 0],
  ["reportViewers", "/report-viewers", 60_000],
  ["cameras", "/cameras", 0],
  ["mapLayers", "/map-layers", 60_000],
  ["chatRooms", "/chat/rooms", 0],
  ["parties", "/parties", 5 * 60_000],
];

export function useDashboardQueries(session) {
  const userId = session?.user?.id;
  const token = session?.token;
  const results = useQueries({
    queries: STARTUP_QUERIES.map(([name, path, staleTime]) => ({
      queryKey: ["dashboard", userId, name],
      queryFn: ({ signal }) => apiRequest(path, token, { signal }),
      enabled: Boolean(userId && token),
      staleTime,
    })),
  });

  return Object.fromEntries(
    STARTUP_QUERIES.map(([name], index) => [name, results[index]]),
  );
}
