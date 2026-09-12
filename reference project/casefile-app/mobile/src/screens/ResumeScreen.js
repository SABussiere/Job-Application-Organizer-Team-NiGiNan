import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { api } from "../api";
import { COLORS } from "../constants";

export default function ResumeScreen() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMasterResume().then(t => { setText(t); setLoading(false); });
  }, []);

  async function save() {
    await api.setMasterResume(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Master Resume</Text>
      <Text style={styles.hint}>
        Your source of truth. New applications start with a copy of this — edit
        that copy per-role without touching the master.
      </Text>
      {loading ? (
        <Text style={styles.hint}>Loading...</Text>
      ) : (
        <>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            placeholder="Paste or write your master resume here..."
          />
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save master resume"}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.paper, padding: 16 },
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.ink, marginBottom: 6 },
  hint: { fontSize: 12.5, color: COLORS.muted, marginBottom: 14 },
  textArea: {
    flex: 1, borderWidth: 1, borderColor: "#cfc3a3", borderRadius: 6,
    padding: 12, fontSize: 13.5, backgroundColor: "#fff", color: COLORS.ink
  },
  saveBtn: { backgroundColor: COLORS.navy, borderRadius: 6, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  saveBtnText: { color: COLORS.manila, fontWeight: "700", fontSize: 14 }
});
