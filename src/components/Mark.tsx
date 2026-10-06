import { Image, StyleSheet, Text, View } from "react-native";
import { brand } from "../theme/brand";
import { colors } from "../theme/colors";

const logo = require("../../assets/logo-mark.png");

export function Mark({ size = 28 }: { size?: number }) {
  return <Image source={logo} style={{ width: size, height: size }} resizeMode="contain" />;
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
