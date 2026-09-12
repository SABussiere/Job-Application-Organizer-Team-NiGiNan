import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { api } from "../api";
import { STAGES, STAGE_META, COLORS, todayStr } from "../constants";

export default function AddApplicationScreen({ onCreated }) {
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [dateApplied, setDateApplied] = useState(todayStr());
  const [status, setStatus] = useState("applied");
  const [jobUrl, setJobUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!company.trim() || !position.trim()) {
      Alert.alert("Missing info", "Company and position are required.");
      return;
    }
    setSaving(true);
    try {
      const app = await api.createApplication({
        company: company.trim(),
        position: position.trim(),
        dateApplied,
        status,
        jobUrl: jobUrl.trim()
      });
      setCompany("");
      setPosition("");
      setJobUrl("");
      setDateApplied(todayStr());
      setStatus("applied");
      onCreated(app.id);
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.heading}>File a new application</Text>

      <Text style={styles.label}>Company</Text>
      <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="e.g. Northwind Traders" />

      <Text style={styles.label}>Position</Text>
      <TextInput style={styles.input} value={position} onChangeText={setPosition} placeholder="e.g. Frontend Engineer" />

      <Text style={styles.label}>Date applied (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={dateApplied} onChangeText={setDateApplied} placeholder="2026-09-12" />

      <Text style={styles.label}>Stage</Text>
      <View style={styles.stageRow}>
        {STAGES.map(s => {
          const meta = STAGE_META[s];
          const active = status === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.stageChip, { borderColor: meta.color }, active && { backgroundColor: meta.color }]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.stageChipText, active && { color: "#fff" }]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Job posting link (optional)</Text>
      <TextInput style={styles.input} value={jobUrl} onChangeText={setJobUrl} placeholder="https://..." autoCapitalize="none" />

      <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={saving}>
        <Text style={styles.submitBtnText}>{saving ? "Filing..." : "File this application"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.ink, marginBottom: 16 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.muted, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#cfc3a3",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: COLORS.ink
  },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5 },
  stageChipText: { fontSize: 12.5, fontWeight: "600", color: COLORS.ink },
  submitBtn: { backgroundColor: COLORS.navy, borderRadius: 6, paddingVertical: 13, alignItems: "center", marginTop: 24 },
  submitBtnText: { color: COLORS.manila, fontWeight: "700", fontSize: 14 }
});
