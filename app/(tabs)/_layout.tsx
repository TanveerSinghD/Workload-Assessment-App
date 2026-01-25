import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Tabs, usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, LayoutChangeEvent } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNavQuickActions } from "@/hooks/use-nav-quick-actions";
import { DEFAULT_NAV_QUICK_ACTIONS, NavItemId, navItems, runQuickAction } from "@/lib/nav-config";

const TAB_COUNT = navItems.length;
const BUBBLE_WIDTH = 55;
const HALF_BUBBLE = BUBBLE_WIDTH / 2;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const router = useRouter();
  const pathname = usePathname();
  const blurTint = dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight";
  const { mapping: quickActions } = useNavQuickActions();

  // 🔵 Sliding bubble animation
  const sliderX = useRef(new Animated.Value(0)).current;

  // Flag to suppress tab press after a long-press quick action
  const longPressTriggered = useRef(false);

  // Width of the entire tab bar
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

      const ITEM_WIDTH = tabWidth.current / TAB_COUNT;
      const targetX = index * ITEM_WIDTH + ITEM_WIDTH / 2 - HALF_BUBBLE;

      if (!animated) {
        sliderX.setValue(targetX);
        return;
      }

      Animated.spring(sliderX, {
        toValue: targetX,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }).start();
    },
    [sliderX]
  );

  const syncToRoute = useCallback(
    (animated = true) => {
      const normalized = normalizePath(pathname);
      const routeIndex = routePaths.findIndex((route) => route === normalized);
      animateToIndex(routeIndex === -1 ? 0 : routeIndex, animated);
    },
    [animateToIndex, normalizePath, pathname, routePaths]
  );

  // 🔧 Fix initial off-centre bubble on first load
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      tabWidth.current = event.nativeEvent.layout.width;
      syncToRoute(false);
    },
    [syncToRoute]
  );

  useEffect(() => {
    syncToRoute(true);
  }, [syncToRoute]);

  // Allow dragging across the tab bar to move the bubble and navigate on release
  const handleDrag = (locationX: number, release = false) => {
    if (!tabWidth.current) return;
    const ITEM_WIDTH = tabWidth.current / TAB_COUNT;
    const clamped = Math.max(0, Math.min(TAB_COUNT - 1, Math.floor(locationX / ITEM_WIDTH)));
    sliderX.setValue(clamped * ITEM_WIDTH + ITEM_WIDTH / 2 - HALF_BUBBLE);
    if (release) {
      const href = (`/(tabs)${routePaths[clamped]}`) as Href;
      router.navigate(href);
    }
  };

  const handleLongPress = useCallback(
    (navId: NavItemId) => {
      // RN fires a dedicated longPress event; we mark it here so the subsequent onPress is ignored.
      const actionId = quickActions[navId] ?? DEFAULT_NAV_QUICK_ACTIONS[navId];
      if (actionId === "none") return;
      longPressTriggered.current = true;
      runQuickAction(actionId, router);
      // Only add a deeper haptic on deliberate long-press.
      if (process.env.EXPO_OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [quickActions, router]
  );

  const renderTabButton = useCallback(
    (navId: NavItemId, index: number) =>
      (props: BottomTabBarButtonProps) => (
        <HapticTab
          {...props}
          delayLongPress={320}
          onLongPress={(e) => {
            handleLongPress(navId);
            props.onLongPress?.(e);
          }}
          onPress={(e) => {
            // Skip the normal tap navigation if we just handled a long-press action.
            if (longPressTriggered.current) {
              longPressTriggered.current = false;
              return;
            }
            animateToIndex(index);
            props.onPress?.(e);
          }}
        />
      ),
    [animateToIndex, handleLongPress]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",

        // 🍏 Frosted glass tab bar
        tabBarBackground: () => (
          <BlurView
            tint={blurTint}
            intensity={30}
            experimentalBlurMethod="dimezisBlurView"
            blurReductionFactor={1.25}
            onLayout={onLayout}
            style={{
              flex: 1,
              borderRadius: 40,
              overflow: "hidden",
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
              justifyContent: "center",
            }}
            onStartShouldSetResponder={() => true}
            onResponderMove={(e) => handleDrag(e.nativeEvent.locationX)}
            onResponderRelease={(e) => handleDrag(e.nativeEvent.locationX, true)}
          >
            {/* Glossy highlight for glass feel */}
            <LinearGradient
              pointerEvents="none"
              colors={dark ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"] : ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.03)"]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />

            {/* 🔵 Bubble behind active tab */}
            <Animated.View
              style={{
                position: "absolute",
                top: 10,
                width: 55,
                height: 50,
                borderRadius: 20,
                backgroundColor: dark ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.08)",
                transform: [{ translateX: sliderX }],
              }}
            />
          </BlurView>
        ),

        tabBarStyle: {
          position: "absolute",
          bottom: 28,
          marginHorizontal: 16,
          height: 70,
          borderRadius: 40,
          backgroundColor: "transparent",
          borderWidth: 0,
          borderColor: "transparent",
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 10 },
          elevation: 20,
          paddingBottom: 10,
          paddingTop: 8,
          borderTopWidth: 0,
          overflow: "hidden",
        },
      }}
    >
      {navItems.map((item, index) => (
        <Tabs.Screen
          key={item.id}
          name={item.routeName}
          options={{
            title: item.label,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name={item.icon} color={color} />,
            tabBarButton: renderTabButton(item.id, index),
          }}
        />
      ))}
    </Tabs>
  );
}
