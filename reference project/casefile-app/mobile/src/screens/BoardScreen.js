import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { api } from "../api";
import { STAGES, STAGE_META, COLORS } from "../constants";
import ApplicationCard from "../components/ApplicationCard";

export default function BoardScreen({ onOpenApp }) {
  const [apps, setApps] = useState([]);
  const [stage, setStage] = useState("applied");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await api.listApplications();
    setApps(data);
  }, []);

  // App.js mounts this screen fresh each time the "Board" tab is selected,
  // so a mount-time load keeps data current without needing a navigation
  // library's focus events.
  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = apps.filter(a => a.status === stage);
  const counts = STAGES.reduce((acc, s) => {
    acc[s] = apps.filter(a => a.status === s).length;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        {STAGES.map(s => {
          const meta = STAGE_META[s];
          const active = s === stage;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.chip,
                { borderColor: meta.color },
                active && { backgroundColor: meta.color }
              ]}
              onPress={() => setStage(s)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {meta.label} · {counts[s]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ApplicationCard app={item} onPress={() => onOpenApp(item.id)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No applications in this stage yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper, paddingHorizontal: 16, paddingTop: 14 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5
  },
  chipText: { fontSize: 12.5, color: COLORS.ink, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list: { flex: 1 },
  empty: { textAlign: "center", color: COLORS.muted, fontStyle: "italic", marginTop: 30, fontSize: 13 }
});
