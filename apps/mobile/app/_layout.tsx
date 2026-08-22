import "../global.css";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { queryClient, queryPersister } from "../src/query";

export default function RootLayout() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
      <Stack screenOptions={{ headerShown: false }} />
    </PersistQueryClientProvider>
  );
}
