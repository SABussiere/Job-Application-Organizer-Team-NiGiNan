import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert
} from "react-native";
import { api } from "../api";
import { STAGES, STAGE_META, COLORS, formatDate, todayStr } from "../constants";

const COMM_TYPES = ["note", "email", "call", "interview"];

export default function DetailScreen({ appId, onBack, onDeleted }) {
  const [tab, setTab] = useState("details");
  const [app, setApp] = useState(null);
  const [form, setForm] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [commType, setCommType] = useState("note");
  const [commDate, setCommDate] = useState(todayStr());
  const [commText, setCommText] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    api.getApplication(appId).then(data => {
      setApp(data);
      setForm({
        company: data.company,
        position: data.position,
        dateApplied: data.dateApplied || "",
        status: data.status,
        followUpDate: data.followUpDate || "",
        location: data.location || "",
        jobUrl: data.jobUrl || "",
        notes: data.notes || ""
      });
      setResumeText(data.resumeVersion || "");
    });
  }, [appId]);

  if (!app || !form) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Loading case...</Text>
      </View>
    );
  }

  async function saveDetails() {
    await api.updateApplication(appId, form);
    Alert.alert("Saved", "Case updated.");
  }

  async function deleteCase() {
    Alert.alert("Delete this case?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteApplication(appId);
          onDeleted();
        }
      }
    ]);
  }

  async function saveResume() {
    await api.updateApplication(appId, { resumeVersion: resumeText });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  async function resetFromMaster() {
    const master = await api.getMasterResume();
    setResumeText(master);
  }

  async function logComm() {
    if (!commText.trim()) return;
    const updated = await api.addCommunication(appId, { type: commType, date: commDate, text: commText.trim() });
    setApp(updated);
    setCommText("");
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backLink}>← Board</Text></TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {["details", "resume", "comms"].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tabBtn}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "details" ? "Details" : t === "resume" ? "Resume" : "Comms"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "details" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={styles.label}>Company</Text>
          <TextInput style={styles.input} value={form.company} onChangeText={t => setForm({ ...form, company: t })} />

          <Text style={styles.label}>Position</Text>
          <TextInput style={styles.input} value={form.position} onChangeText={t => setForm({ ...form, position: t })} />

          <Text style={styles.label}>Date applied (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={form.dateApplied} onChangeText={t => setForm({ ...form, dateApplied: t })} />

          <Text style={styles.label}>Stage</Text>
          <View style={styles.stageRow}>
            {STAGES.map(s => {
              const meta = STAGE_META[s];
              const active = form.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.stageChip, { borderColor: meta.color }, active && { backgroundColor: meta.color }]}
                  onPress={() => setForm({ ...form, status: s })}
                >
                  <Text style={[styles.stageChipText, active && { color: "#fff" }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Follow up on (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={form.followUpDate} onChangeText={t => setForm({ ...form, followUpDate: t })} placeholder="Optional" />

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} value={form.location} onChangeText={t => setForm({ ...form, location: t })} />

          <Text style={styles.label}>Job posting link</Text>
          <TextInput style={styles.input} value={form.jobUrl} onChangeText={t => setForm({ ...form, jobUrl: t })} autoCapitalize="none" />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={form.notes}
            onChangeText={t => setForm({ ...form, notes: t })}
            multiline
            placeholder="Referral, salary range, interview prep notes..."
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.dangerBtn} onPress={deleteCase}>
              <Text style={styles.dangerBtnText}>Delete case</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={saveDetails}>
              <Text style={styles.primaryBtnText}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {tab === "resume" && (
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={styles.hint}>Tailor this copy for the role. Editing here never touches your master resume.</Text>
          <TextInput
            style={styles.resumeInput}
            value={resumeText}
            onChangeText={setResumeText}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetFromMaster}>
              <Text style={styles.secondaryBtnText}>Reset from master</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={saveResume}>
              <Text style={styles.primaryBtnText}>{savedFlash ? "Saved ✓" : "Save resume"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {tab === "comms" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <View style={styles.stageRow}>
            {COMM_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.stageChip, { borderColor: COLORS.offer }, commType === t && { backgroundColor: COLORS.offer }]}
                onPress={() => setCommType(t)}
              >
                <Text style={[styles.stageChipText, commType === t && { color: "#fff" }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={commDate} onChangeText={setCommDate} />
          <Text style={styles.label}>What happened?</Text>
          <TextInput style={styles.input} value={commText} onChangeText={setCommText} placeholder="Recruiter called to schedule..." />
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 12, alignSelf: "flex-start" }]} onPress={logComm}>
            <Text style={styles.primaryBtnText}>Log</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 20 }}>
            {(app.communications || []).length === 0 && (
              <Text style={styles.hint}>No communications logged yet.</Text>
            )}
            {(app.communications || []).map(c => (
              <View key={c.id} style={styles.commItem}>
                <Text style={styles.commMeta}>{c.type} · {formatDate(c.date)}</Text>
                <Text style={{ color: COLORS.ink }}>{c.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper },
  topBar: { paddingHorizontal: 16, paddingTop: 14 },
  backLink: { color: COLORS.applied || "#3A5A78", fontWeight: "600", fontSize: 14 },
  tabsRow: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: COLORS.manilaDark, marginTop: 12, paddingHorizontal: 16 },
  tabBtn: { paddingVertical: 10, marginRight: 20 },
  tabBtnText: { fontSize: 13.5, fontWeight: "600", color: COLORS.muted },
  tabBtnTextActive: { color: COLORS.ink, borderBottomWidth: 2, borderBottomColor: COLORS.offer },
  hint: { color: COLORS.muted, fontSize: 12.5, marginBottom: 10 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.muted, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: "#cfc3a3", borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: "#fff", color: COLORS.ink
  },
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  stageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5 },
  stageChipText: { fontSize: 12.5, fontWeight: "600", color: COLORS.ink },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, gap: 10 },
  primaryBtn: { backgroundColor: COLORS.navy, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 18 },
  primaryBtnText: { color: COLORS.manila, fontWeight: "700", fontSize: 13.5 },
  secondaryBtn: { borderWidth: 1, borderColor: "#cfc3a3", borderRadius: 6, paddingVertical: 12, paddingHorizontal: 16 },
  secondaryBtnText: { color: COLORS.ink, fontSize: 13 },
  dangerBtn: { borderWidth: 1, borderColor: "#A8503A", borderRadius: 6, paddingVertical: 12, paddingHorizontal: 16 },
  dangerBtnText: { color: "#A8503A", fontSize: 13 },
  resumeInput: {
    flex: 1, borderWidth: 1, borderColor: "#cfc3a3", borderRadius: 6,
    padding: 12, fontSize: 13.5, backgroundColor: "#fff", color: COLORS.ink
  },
  commItem: { backgroundColor: COLORS.manila, borderRadius: 6, padding: 10, marginBottom: 8 },
  commMeta: { fontSize: 10.5, textTransform: "uppercase", color: COLORS.muted, marginBottom: 3 }
});
