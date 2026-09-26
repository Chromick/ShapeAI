import { StyleSheet, Text, View } from "react-native";
import { brand } from "../theme/brand";
import { colors } from "../theme/colors";

const widths = [0.46, 0.72, 1];

export function Mark({ size = 28 }: { size?: number }) {
  const bar = Math.max(3, Math.round(size * 0.16));
  const gap = Math.max(2, Math.round(size * 0.1));
  return (
    <View style={{ width: size, height: bar * 3 + gap * 2, justifyContent: "center", gap }}>
      {widths.map((width) => (
        <View
          key={width}
          style={{
            width: size * width,
            height: bar,
            borderRadius: bar,
            backgroundColor: colors.primary,
            alignSelf: "center",
          }}
        />
      ))}
    </View>
  );
}

export function BrandLockup({ size = 36 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <Mark size={size} />
      <View>
        <Text style={[styles.name, { fontSize: Math.round(size * 0.72) }]}>{brand.name}</Text>
        <Text style={styles.line}>{brand.line}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: colors.text, fontWeight: "800", letterSpacing: -0.6 },
  line: {
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
