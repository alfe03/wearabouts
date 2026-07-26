import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WardrobeApp } from "@/screens/WardrobeApp";

export default function App() {
  return (
    <SafeAreaProvider>
      <WardrobeApp />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
