import { useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, StatusBar } from "react-native";
import { COLORS } from "./src/constants";
import TabBar from "./src/components/TabBar";
import BoardScreen from "./src/screens/BoardScreen";
import AddApplicationScreen from "./src/screens/AddApplicationScreen";
import DetailScreen from "./src/screens/DetailScreen";
import ResumeScreen from "./src/screens/ResumeScreen";
import RemindersScreen from "./src/screens/RemindersScreen";

export default function App() {
  const [tab, setTab] = useState("board");
  const [selectedAppId, setSelectedAppId] = useState(null);

  function openApp(id) {
    setSelectedAppId(id);
    setTab("detail");
  }

  function backToBoard() {
    setSelectedAppId(null);
    setTab("board");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>CASEFILE</Text>
        <Text style={styles.headerSub}>an open case for every application</Text>
      </View>

      <View style={styles.body}>
        {tab === "board" && <BoardScreen onOpenApp={openApp} />}
        {tab === "add" && <AddApplicationScreen onCreated={openApp} />}
        {tab === "detail" && selectedAppId && (
          <DetailScreen appId={selectedAppId} onBack={backToBoard} onDeleted={backToBoard} />
        )}
        {tab === "resume" && <ResumeScreen />}
        {tab === "reminders" && <RemindersScreen onOpenApp={openApp} />}
      </View>

      <TabBar
        active={tab === "detail" ? "board" : tab}
        onChange={t => { setSelectedAppId(null); setTab(t); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0
  },
  headerTitle: { color: COLORS.manila, fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  headerSub: { color: "#C9BFA5", fontSize: 11, fontStyle: "italic", marginTop: 2 },
  body: { flex: 1, backgroundColor: COLORS.paper }
});
