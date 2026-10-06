import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";

export function Edge({ height = 2 }: { height?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.edge, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  edge: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
