import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColorScheme } from "@/hooks/use-color-scheme";

type Option = { id: string; label: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  disabled?: boolean;
};

// Simple dropdown that opens a bottom sheet list; built to feel like system Settings.
export function NavQuickActionSelector({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const dark = scheme === "dark";

  const colors = useMemo(
    () => ({
      border: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
      text: dark ? "#F5F5F7" : "#0A0A0A",
      subtext: dark ? "#A0A0A7" : "#8E8E93",
      sheet: dark ? "#1C1C1E" : "#F8F8F8",
      separator: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
    }),
    [dark]
  );

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange]
  );

  const current = options.find((o) => o.id === value);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Select long-press action"
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderColor: colors.border }]}
      >
        <Text numberOfLines={1} style={[styles.triggerText, { color: colors.text }]}>
          {current?.label ?? "Choose"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.subtext} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 8, backgroundColor: colors.sheet }]}
            onPress={() => {}}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose action</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.8}
                >
                  <Text numberOfLines={1} style={[styles.optionLabel, { color: colors.text }]}>
                    {item.label}
                  </Text>
                  {item.id === value && <Ionicons name="checkmark" size={18} color="#0A84FF" />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
              showsVerticalScrollIndicator={false}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 170,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    color: "#0A0A0A",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#F8F8F8",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: "60%",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#1C1C1E",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 16,
    color: "#111",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
});
