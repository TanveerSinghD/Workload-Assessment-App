import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { Href, Stack, Tabs, usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  DeviceEventEmitter,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNavQuickActions } from "@/hooks/use-nav-quick-actions";
import { getTasks } from "@/lib/database";
import { DEFAULT_NAV_QUICK_ACTIONS, NavItemId, executeNavQuickAction, navItems } from "@/lib/nav-config";
import { loadNavQuickActions } from "@/lib/nav-quick-actions-store";
import { TAB_BAR_SCROLL_EVENT, TabBarScrollPayload } from "@/lib/tab-bar-scroll";

const TAB_COUNT = navItems.length;
const BUBBLE_WIDTH = 60;
const HALF_BUBBLE = BUBBLE_WIDTH / 2;
const LONG_PRESS_HINT_KEY = "nav_long_press_hint_seen_v2";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const blurTint = dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight";
  const { mapping: quickActions, loading: quickActionsLoading } = useNavQuickActions();

  const tabBarBottom = Math.max(10, insets.bottom + 6);
  const tabBarHeight = 68 + Math.min(insets.bottom, 10);

  const sliderX = useRef(new Animated.Value(0)).current;

  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const tabBarOpacity = useRef(new Animated.Value(1)).current;
  const tabBarHiddenRef = useRef(false);

  const [showLongPressHint, setShowLongPressHint] = useState(false);
  const longPressHintOpacity = useRef(new Animated.Value(0)).current;
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [taskBadge, setTaskBadge] = useState({ open: 0, overdue: 0 });

  const longPressTriggered = useRef(false);

  const tabWidth = useRef(0);
  const routePaths = useMemo(() => navItems.map((item) => item.routePath), []);

  const normalizePath = useCallback(
    (path: string) => {
      const withoutGroup = path.replace(/^\/\(tabs\)/, "") || routePaths[0];
      if (withoutGroup === "/") return routePaths[0];
      if (withoutGroup === "/index") return routePaths[0];
      return withoutGroup;
    },
    [routePaths]
  );

  const animateToIndex = useCallback(
    (index: number, animated = true) => {
      if (tabWidth.current === 0) return;

      const itemWidth = tabWidth.current / TAB_COUNT;
      const targetX = index * itemWidth + itemWidth / 2 - HALF_BUBBLE;

      if (!animated) {
        sliderX.setValue(targetX);
        return;
      }

      Animated.spring(sliderX, {
        toValue: targetX,
        useNativeDriver: true,
        speed: 17,
        bounciness: 4,
      }).start();
    },
    [sliderX]
  );

  const setTabBarHidden = useCallback(
    (hidden: boolean) => {
      if (tabBarHiddenRef.current === hidden) return;
      tabBarHiddenRef.current = hidden;

      Animated.parallel([
        Animated.timing(tabBarTranslateY, {
          toValue: hidden ? tabBarHeight + tabBarBottom + 20 : 0,
          duration: hidden ? 180 : 210,
          useNativeDriver: true,
        }),
        Animated.timing(tabBarOpacity, {
          toValue: hidden ? 0.15 : 1,
          duration: hidden ? 140 : 200,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [tabBarBottom, tabBarHeight, tabBarOpacity, tabBarTranslateY]
  );

  const syncToRoute = useCallback(
    (animated = true) => {
      const normalized = normalizePath(pathname);
      const routeIndex = routePaths.findIndex((route) => route === normalized);
      animateToIndex(routeIndex === -1 ? 0 : routeIndex, animated);
    },
    [animateToIndex, normalizePath, pathname, routePaths]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      tabWidth.current = event.nativeEvent.layout.width;
      syncToRoute(false);
    },
    [syncToRoute]
  );

  useEffect(() => {
    syncToRoute(true);
    setTabBarHidden(false);
  }, [setTabBarHidden, syncToRoute]);

  const handleDrag = useCallback(
    (locationX: number, release = false) => {
      if (!tabWidth.current) return;
      const itemWidth = tabWidth.current / TAB_COUNT;
      const clamped = Math.max(0, Math.min(TAB_COUNT - 1, Math.floor(locationX / itemWidth)));
      sliderX.setValue(clamped * itemWidth + itemWidth / 2 - HALF_BUBBLE);
      if (release) {
        const href = (`/(tabs)${routePaths[clamped]}`) as Href;
        router.navigate(href);
      }
    },
    [routePaths, router, sliderX]
  );

  const handleLongPress = useCallback(
    async (navId: NavItemId) => {
      if (quickActionsLoading) return;
      const latest = await loadNavQuickActions();
      const actionId = latest[navId] ?? quickActions[navId] ?? DEFAULT_NAV_QUICK_ACTIONS[navId];
      if (actionId === "none") return;
      longPressTriggered.current = true;
      executeNavQuickAction(navId, actionId, router);
      if (process.env.EXPO_OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [quickActions, quickActionsLoading, router]
  );

  const renderTabButton = useCallback(
    (navId: NavItemId, index: number) => {
      const TabButton = (props: BottomTabBarButtonProps) => (
        <HapticTab
          {...props}
          delayLongPress={320}
          onLongPress={(e) => {
            handleLongPress(navId);
            props.onLongPress?.(e);
          }}
          onPress={(e) => {
            if (longPressTriggered.current) {
              longPressTriggered.current = false;
              return;
            }
            animateToIndex(index);
            props.onPress?.(e);
          }}
        />
      );
      TabButton.displayName = `TabButton-${navId}`;
      return TabButton;
    },
    [animateToIndex, handleLongPress]
  );

  const loadTaskBadge = useCallback(async () => {
    try {
      const rows = await getTasks();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let open = 0;
      let overdue = 0;

      rows.forEach((task: any) => {
        if (task.completed) return;
        open += 1;
        if (!task.due_date) return;
        const due = new Date(`${task.due_date}T00:00:00`);
        if (!Number.isNaN(due.getTime()) && due.getTime() < today.getTime()) overdue += 1;
      });

      setTaskBadge({ open, overdue });
    } catch (error) {
      if (__DEV__) console.error("Failed to load tab badge stats", error);
      setTaskBadge({ open: 0, overdue: 0 });
    }
  }, []);

  useEffect(() => {
    loadTaskBadge();
  }, [loadTaskBadge, pathname]);

  useEffect(() => {
    const id = setInterval(loadTaskBadge, 60_000);
    return () => clearInterval(id);
  }, [loadTaskBadge]);

  useEffect(() => {
    let active = true;

    const maybeShowHint = async () => {
      try {
        const seen = await SecureStore.getItemAsync(LONG_PRESS_HINT_KEY);
        if (!active || seen) return;

        await SecureStore.setItemAsync(LONG_PRESS_HINT_KEY, "1");
        setShowLongPressHint(true);
        Animated.timing(longPressHintOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();

        hintTimeoutRef.current = setTimeout(() => {
          Animated.timing(longPressHintOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) setShowLongPressHint(false);
          });
        }, 4600);
      } catch (error) {
        if (__DEV__) console.warn("Failed to load nav hint state", error);
      }
    };

    maybeShowHint();

    return () => {
      active = false;
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, [longPressHintOpacity]);

  const lastScrollYBySource = useRef<Record<TabBarScrollPayload["source"], number>>({
    home: 0,
    tasks: 0,
    planner: 0,
  });

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(TAB_BAR_SCROLL_EVENT, (payload: TabBarScrollPayload) => {
      if (!payload || typeof payload.y !== "number") return;

      const prev = lastScrollYBySource.current[payload.source] ?? payload.y;
      const delta = payload.y - prev;
      lastScrollYBySource.current[payload.source] = payload.y;

      if (payload.y < 16) {
        setTabBarHidden(false);
        return;
      }

      if (payload.y > 84 && delta > 6) {
        setTabBarHidden(true);
        return;
      }

      if (delta < -5) {
        setTabBarHidden(false);
      }
    });

    return () => listener.remove();
  }, [setTabBarHidden]);

  const tasksBadgeCount = taskBadge.overdue > 0 ? taskBadge.overdue : taskBadge.open;
  const tasksBadgeColor = taskBadge.overdue > 0 ? "#FF453A" : "#0A84FF";

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: "" }} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: dark ? "#84BBFF" : "#0A84FF",
          tabBarInactiveTintColor: dark ? "#A2ABB7" : "#737A84",
          tabBarLabelPosition: "below-icon",
          tabBarItemStyle: {
            paddingVertical: 2,
          },

          tabBarBackground: () => (
            <BlurView
              tint={blurTint}
              intensity={34}
              experimentalBlurMethod="dimezisBlurView"
              blurReductionFactor={1.25}
              onLayout={onLayout}
              style={[
                styles.tabBarBackground,
                {
                  borderColor: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
                },
              ]}
              onStartShouldSetResponder={() => true}
              onResponderMove={(e) => handleDrag(e.nativeEvent.locationX)}
              onResponderRelease={(e) => handleDrag(e.nativeEvent.locationX, true)}
            >
              <LinearGradient
                pointerEvents="none"
                colors={
                  dark
                    ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.01)"]
                    : ["rgba(255,255,255,0.20)", "rgba(255,255,255,0.03)"]
                }
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />

              <Animated.View
                style={[
                  styles.activeBubble,
                  {
                    backgroundColor: dark ? "rgba(255,255,255,0.18)" : "rgba(10,132,255,0.12)",
                    transform: [{ translateX: sliderX }],
                  },
                ]}
              />
            </BlurView>
          ),

          tabBarStyle: {
            position: "absolute",
            bottom: tabBarBottom,
            marginHorizontal: 14,
            height: tabBarHeight,
            borderRadius: 36,
            backgroundColor: "transparent",
            borderWidth: 0,
            shadowColor: "#000",
            shadowOpacity: dark ? 0.22 : 0.1,
            shadowRadius: dark ? 16 : 12,
            shadowOffset: { width: 0, height: 7 },
            elevation: dark ? 14 : 9,
            paddingBottom: Math.max(6, insets.bottom > 0 ? 8 : 6),
            paddingTop: 6,
            borderTopWidth: 0,
            overflow: "hidden",
            transform: [{ translateY: tabBarTranslateY }],
            opacity: tabBarOpacity,
          },
        }}
      >
        {navItems.map((item, index) => (
          <Tabs.Screen
            key={item.id}
            name={item.routeName}
            options={{
              title: item.label,
              tabBarAccessibilityLabel:
                item.id === "tasks"
                  ? `Tasks tab, ${taskBadge.overdue} overdue, ${taskBadge.open} open`
                  : `${item.label} tab`,
              tabBarLabel: ({ focused, color }) => (
                <Text style={[styles.tabLabel, { color, fontWeight: focused ? "800" : "600" }]} numberOfLines={1}>
                  {item.label}
                </Text>
              ),
              tabBarIcon: ({ color, focused }) => {
                const showBadge = item.id === "tasks" && tasksBadgeCount > 0;
                return (
                  <View style={styles.iconWrap}>
                    <View
                      style={[
                        styles.activeIndicator,
                        { opacity: focused ? 1 : 0, backgroundColor: color },
                      ]}
                    />

                    <View style={{ transform: [{ scale: focused ? 1.08 : 1 }] }}>
                      <IconSymbol size={focused ? 28 : 26} name={item.icon} color={color} />
                    </View>

                    {showBadge ? (
                      <View style={[styles.badge, { backgroundColor: tasksBadgeColor }]}> 
                        <Text style={styles.badgeText}>{tasksBadgeCount > 99 ? "99+" : String(tasksBadgeCount)}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              },
              tabBarButton: renderTabButton(item.id, index),
            }}
          />
        ))}
      </Tabs>

      {showLongPressHint ? (
        <Animated.View
          style={[
            styles.quickHint,
            {
              bottom: tabBarBottom + tabBarHeight + 10,
              opacity: longPressHintOpacity,
              backgroundColor: dark ? "rgba(34,44,58,0.96)" : "rgba(235,242,252,0.98)",
              borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <Pressable
            onPress={() => {
              Animated.timing(longPressHintOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }).start(({ finished }) => {
                if (finished) setShowLongPressHint(false);
              });
            }}
            style={styles.quickHintInner}
          >
            <IoniconsHint dark={dark} />
            <Text style={[styles.quickHintText, { color: dark ? "#E6EBF2" : "#1F2733" }]}>Long press tabs for shortcuts</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

function IoniconsHint({ dark }: { dark: boolean }) {
  return (
    <View
      style={[
        styles.quickHintIcon,
        { backgroundColor: dark ? "rgba(255,255,255,0.14)" : "rgba(10,132,255,0.14)" },
      ]}
    >
      <Text style={[styles.quickHintIconText, { color: dark ? "#E6EBF2" : "#0A84FF" }]}>LP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBarBackground: {
    flex: 1,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 1,
    justifyContent: "center",
  },
  activeBubble: {
    position: "absolute",
    top: 7,
    width: BUBBLE_WIDTH,
    height: 52,
    borderRadius: 18,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: -2,
  },
  iconWrap: {
    width: 42,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  badge: {
    position: "absolute",
    right: -7,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
  quickHint: {
    position: "absolute",
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 80,
  },
  quickHintInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  quickHintIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  quickHintIconText: {
    fontSize: 11,
    fontWeight: "900",
  },
  quickHintText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
