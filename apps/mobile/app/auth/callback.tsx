import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { completeMobileLogin } from "../../src/mobile-auth";

export default function AuthCallback() {
  const { code, state } = useLocalSearchParams<{ code?: string; state?: string }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!code || !state) {
      setFailed(true);
      return;
    }
    void completeMobileLogin(`ownday://auth/callback?${new URLSearchParams({ code, state })}`)
      .then(() => router.replace("/"))
      .catch(() => setFailed(true));
  }, [code, state]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
      {failed ? (
        <>
          <Text>
            Не удалось завершить вход. Попробуй ещё раз. / Could not finish sign-in. Please try
            again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/")}
            style={{ padding: 16 }}
          >
            <Text>Вернуться / Go back</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}
