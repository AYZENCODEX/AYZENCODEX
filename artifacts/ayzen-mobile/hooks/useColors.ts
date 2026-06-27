import { useColorScheme } from "react-native";
import { colors, ColorScheme } from "@/constants/colors";

export function useColors(): ColorScheme {
  const scheme = useColorScheme();
  // AYZEN is always dark — ignore light scheme
  return colors.dark;
}
