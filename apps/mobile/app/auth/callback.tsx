import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { session } from "../../src/api";

export default function AuthCallback() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  useEffect(() => {
    if (token) void session.set(token).then(() => router.replace("/"));
  }, [token]);
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}
