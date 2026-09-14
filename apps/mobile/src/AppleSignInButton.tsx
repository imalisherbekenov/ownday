import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as Apple from "expo-apple-authentication";
export function AppleSignInButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === "ios")
      void Apple.isAvailableAsync()
        .then(setAvailable)
        .catch(() => {});
  }, []);
  if (!available) return null;
  return (
    <View
      pointerEvents={busy ? "none" : "auto"}
      accessibilityState={{ disabled: busy }}
      style={{ opacity: busy ? 0.5 : 1 }}
    >
      <Apple.AppleAuthenticationButton
        buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={{ width: 260, height: 48 }}
        onPress={onPress}
      />
    </View>
  );
}
