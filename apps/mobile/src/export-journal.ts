import { Share } from "react-native";
export async function exportJournal(data: string) {
  await Share.share({ message: data, title: "Ownday" });
}
