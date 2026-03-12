import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { accentThemeList, accentThemes, hexToRgba } from "@/constants/accent-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useThemeOverride } from "@/hooks/useThemeOverride";

export default function ThemeSettingsScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const colors = useThemeColors();
  const { themeOverride, setThemeOverride, accentTheme, setAccentTheme, isReady } = useThemeOverride();

  const text = colors.textPrimary;
  const subtext = colors.textMuted;
  const card = colors.surface;
  const border = colors.borderSubtle;
  const activeAccentColor = dark ? accentThemes[accentTheme].darkColor : accentThemes[accentTheme].color;
  const activeThemeLabel = themeOverride === null ? `System (${scheme === "dark" ? "Dark" : "Light"})` : themeOverride;
  const activeAccentLabel = accentThemes[accentTheme].label;

  const previewBackground = useMemo(
    () => (dark ? "#111723" : "#F3F7FC"),
    [dark]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeaderWrap}>
          <Text style={[styles.sectionTitle, { color: text }]}>Theme</Text>
          <Text style={[styles.sectionSubtitle, { color: subtext }]}>
            Pick your mode and selected tab color.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={[styles.label, { color: text }]}>Mode</Text>
              <Text style={[styles.rowHint, { color: subtext }]}>Current: {activeThemeLabel}</Text>
            </View>
            {!isReady ? <ActivityIndicator size="small" color={activeAccentColor} /> : null}
          </View>

          <View style={styles.themeSelector}>
            <TouchableOpacity
              style={[
                styles.themeChip,
                { backgroundColor: dark ? "#1B2230" : "#EEF2F7", borderColor: border },
                themeOverride === null && {
                  borderColor: activeAccentColor,
                  backgroundColor: hexToRgba(activeAccentColor, dark ? 0.24 : 0.14),
                },
                !isReady && styles.disabled,
              ]}
              activeOpacity={0.86}
              disabled={!isReady}
              onPress={() => setThemeOverride(null)}
              accessibilityRole="button"
            >
              <Ionicons
                name="phone-portrait-outline"
                size={16}
                color={themeOverride === null ? activeAccentColor : subtext}
              />
              <Text style={[styles.themeChipText, { color: themeOverride === null ? activeAccentColor : text }]}>
                System
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeChip,
                { backgroundColor: dark ? "#1B2230" : "#EEF2F7", borderColor: border },
                themeOverride === "light" && {
                  borderColor: activeAccentColor,
                  backgroundColor: hexToRgba(activeAccentColor, dark ? 0.24 : 0.14),
                },
                !isReady && styles.disabled,
              ]}
              activeOpacity={0.86}
              disabled={!isReady}
              onPress={() => setThemeOverride("light")}
              accessibilityRole="button"
            >
              <Ionicons name="sunny-outline" size={16} color={themeOverride === "light" ? activeAccentColor : subtext} />
              <Text style={[styles.themeChipText, { color: themeOverride === "light" ? activeAccentColor : text }]}>
                Light
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeChip,
                { backgroundColor: dark ? "#1B2230" : "#EEF2F7", borderColor: border },
                themeOverride === "dark" && {
                  borderColor: activeAccentColor,
                  backgroundColor: hexToRgba(activeAccentColor, dark ? 0.24 : 0.14),
                },
                !isReady && styles.disabled,
              ]}
              activeOpacity={0.86}
              disabled={!isReady}
              onPress={() => setThemeOverride("dark")}
              accessibilityRole="button"
            >
              <Ionicons name="moon-outline" size={16} color={themeOverride === "dark" ? activeAccentColor : subtext} />
              <Text style={[styles.themeChipText, { color: themeOverride === "dark" ? activeAccentColor : text }]}>
                Dark
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={[styles.label, { color: text }]}>Color Theme</Text>
              <Text style={[styles.rowHint, { color: subtext }]}>Selected tab color: {activeAccentLabel}</Text>
            </View>
            <View style={[styles.currentAccentPill, { backgroundColor: hexToRgba(activeAccentColor, dark ? 0.25 : 0.12) }]}>
              <View style={[styles.accentDot, { backgroundColor: activeAccentColor }]} />
              <Text style={[styles.currentAccentText, { color: activeAccentColor }]}>{activeAccentLabel}</Text>
            </View>
          </View>

          <View style={styles.accentSelector}>
            {accentThemeList.map((option) => {
              const selected = accentTheme === option.id;
              const optionColor = dark ? option.darkColor : option.color;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.accentChip,
                    {
                      borderColor: selected ? optionColor : border,
                      backgroundColor: selected
                        ? hexToRgba(optionColor, dark ? 0.24 : 0.11)
                        : dark
                        ? "#1B2230"
                        : "#EEF2F7",
                    },
                    !isReady && styles.disabled,
                  ]}
                  activeOpacity={0.86}
                  disabled={!isReady}
                  onPress={() => setAccentTheme(option.id)}
                  accessibilityRole="button"
                >
                  <View style={[styles.accentDot, { backgroundColor: optionColor }]} />
                  <Text style={[styles.accentChipText, { color: selected ? optionColor : text }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={[styles.previewWrap, { borderColor: border, backgroundColor: previewBackground }]}>
            <Text style={[styles.previewLabel, { color: subtext }]}>Preview</Text>
            <View style={styles.previewBar}>
              <View style={[styles.previewTab, { backgroundColor: dark ? "#1D2431" : "#E8EEF6" }]} />
              <View style={[styles.previewTab, { backgroundColor: hexToRgba(activeAccentColor, dark ? 0.28 : 0.2) }]}>
                <View style={[styles.previewDotLarge, { backgroundColor: activeAccentColor }]} />
              </View>
              <View style={[styles.previewTab, { backgroundColor: dark ? "#1D2431" : "#E8EEF6" }]} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 42,
    gap: 14,
  },
  sectionHeaderWrap: {
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 2,
    overflow: "hidden",
  },
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  themeSelector: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 6,
  },
  themeChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.4,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  themeChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.65,
  },
  currentAccentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  currentAccentText: {
    fontSize: 12,
    fontWeight: "700",
  },
  accentSelector: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  accentChip: {
    width: "31.8%",
    borderRadius: 12,
    borderWidth: 1.4,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 4,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  accentChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  previewWrap: {
    marginHorizontal: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  previewBar: {
    flexDirection: "row",
    gap: 8,
  },
  previewTab: {
    flex: 1,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  previewDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 99,
  },
});
