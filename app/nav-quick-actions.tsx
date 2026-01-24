import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNavQuickActions } from "@/hooks/use-nav-quick-actions";
import { NavItemId, QuickActionId, navItems, quickActionRegistry } from "@/lib/nav-config";
import { Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { NavQuickActionSelector } from "@/components/nav-quick-action-selector";

export default function NavQuickActionsScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const background = dark ? "#0F1117" : "#F5F6FA";
  const card = dark ? "#1C1C1E" : "#FFFFFF";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
  const text = dark ? "#F5F5F7" : "#0A0A0A";
  const subtext = dark ? "#9EA0A6" : "#5B5B63";
  const insets = useSafeAreaInsets();
  const EXTRA_BOTTOM_SPACE = 90; // keeps rows clear of the home indicator and tab bar

  const { mapping, setAction, loading } = useNavQuickActions();

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.safe, { backgroundColor: background }]}>
      <Stack.Screen
        options={{
          title: "Nav Quick Actions",
          headerBackTitle: "",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + EXTRA_BOTTOM_SPACE,
          gap: 14,
        }}
      >
        <Text style={[styles.helper, { color: subtext }]}>
          Choose what happens when you long-press a nav icon.
        </Text>

        {navItems.map((item) => {
          const selected = mapping[item.id] ?? item.defaultQuickAction;
          return (
            <View key={item.id} style={[styles.row, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.left}>
                <IconSymbol size={24} name={item.icon} color={text} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={[styles.label, { color: text }]}>{item.label}</Text>
                  <Text style={[styles.sublabel, { color: subtext }]}>Long-press action</Text>
                </View>
              </View>

              <NavQuickActionSelector
                disabled={loading}
                value={selected}
                options={
                  item.quickActions
                    .map((actionId) => {
                      const option = quickActionRegistry[actionId];
                      if (!option) return null;
                      return { id: actionId, label: option.label };
                    })
                    .filter(Boolean) as { id: QuickActionId; label: string }[]
                }
                onChange={(value) => setAction(item.id as NavItemId, value as QuickActionId)}
              />
            </View>
          );
        })}

        {loading && (
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <ActivityIndicator color={text} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  helper: {
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 4,
  },
  row: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  sublabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
