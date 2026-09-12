import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { STAGE_META, formatDate, todayStr } from "../constants";

export default function ApplicationCard({ app, onPress }) {
  const overdue = app.followUpDate && app.followUpDate <= todayStr() && app.status !== "rejected";
  const stageColor = STAGE_META[app.status]?.color || "#3A5A78";

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: stageColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.position}>{app.position}</Text>
      <Text style={styles.company}>{app.company}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{formatDate(app.dateApplied)}</Text>
        {app.location ? <Text style={styles.meta}>{app.location}</Text> : null}
      </View>
      {overdue ? (
        <View style={styles.flag}>
          <Text style={styles.flagText}>Follow up due</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F7F3E8",
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4
  },
  position: { fontWeight: "600", fontSize: 15, color: "#2A2118" },
  company: { fontSize: 13, color: "#786d59", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  meta: { fontSize: 11, color: "#786d59" },
  flag: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#A8503A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  flagText: { color: "#fff", fontSize: 10.5, fontWeight: "600" }
});
