import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../constants";

const TABS = [
  { key: "board", label: "Board", icon: "🗂" },
  { key: "add", label: "Add", icon: "＋" },
  { key: "resume", label: "Resume", icon: "📄" },
  { key: "reminders", label: "Follow-ups", icon: "⏰" }
];

export default function TabBar({ active, onChange }) {
  return (
    <View style={styles.bar}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={styles.tab}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.icon, active === tab.key && styles.iconActive]}>{tab.icon}</Text>
          <Text style={[styles.label, active === tab.key && styles.labelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: COLORS.navy,
    borderTopWidth: 3,
    borderTopColor: COLORS.offer,
    paddingBottom: 22,
    paddingTop: 10
  },
  tab: { flex: 1, alignItems: "center" },
  icon: { fontSize: 18, color: "#8894a3" },
  iconActive: { color: COLORS.manila },
  label: { fontSize: 10.5, color: "#8894a3", marginTop: 2 },
  labelActive: { color: COLORS.manila, fontWeight: "600" }
});
