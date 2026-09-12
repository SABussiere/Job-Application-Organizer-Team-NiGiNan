import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../api";
import { COLORS, formatDate, todayStr } from "../constants";

export default function RemindersScreen({ onOpenApp }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listApplications().then(data => { setApps(data); setLoading(false); });
  }, []);

  const today = todayStr();
  const withReminders = apps
    .filter(a => a.followUpDate && a.status !== "rejected")
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Follow-ups</Text>
      <Text style={styles.hint}>Overdue and upcoming check-ins across every open case.</Text>

      {loading ? (
        <Text style={styles.hint}>Loading...</Text>
      ) : withReminders.length === 0 ? (
        <Text style={styles.hint}>No follow-ups scheduled yet.</Text>
      ) : (
        <FlatList
          data={withReminders}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const overdue = item.followUpDate <= today;
            return (
              <TouchableOpacity
                style={[styles.row, overdue && styles.rowOverdue]}
                onPress={() => onOpenApp(item.id)}
              >
                <View>
                  <Text style={styles.pos}>{item.position}</Text>
                  <Text style={styles.co}>{item.company}</Text>
                </View>
                <Text style={styles.date}>{overdue ? "Overdue — " : ""}{formatDate(item.followUpDate)}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 16 },
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.ink, marginBottom: 4 },
  hint: { fontSize: 12.5, color: COLORS.muted, marginBottom: 14 },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 6, padding: 14, marginBottom: 8,
    borderLeftWidth: 4, borderLeftColor: COLORS.offer
  },
  rowOverdue: { borderLeftColor: "#A8503A" },
  pos: { fontWeight: "600", fontSize: 14, color: COLORS.ink },
  co: { fontSize: 12, color: COLORS.muted },
  date: { fontSize: 12, color: COLORS.muted }
});
