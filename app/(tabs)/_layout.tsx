import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Tabs, usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, LayoutChangeEvent } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ROUTES = ["/index/index", "/tasks/tasks", "/planner/planner", "/calendar/calendar", "/settings/settings"] as const;
const TAB_COUNT = ROUTES.length;
const BUBBLE_WIDTH = 55;
const HALF_BUBBLE = BUBBLE_WIDTH / 2;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  const router = useRouter();
  const pathname = usePathname();
  const blurTint = dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight";

  // 🔵 Sliding bubble animation
  const sliderX = useRef(new Animated.Value(0)).current;

  // Flag to suppress tab press after a long-press quick action
  const taskQuickActionTriggered = useRef(false);

  // Width of the entire tab bar
  const tabWidth = useRef(0);

  const normalizePath = useCallback(
    (path: string) => {
      const withoutGroup = path.replace(/^\/\(tabs\)/, "") || "/index/index";
      if (withoutGroup === "/") return "/index/index";
      if (withoutGroup === "/index") return "/index/index";
      return withoutGroup;
    },
    []
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
      const routeIndex = ROUTES.findIndex((route) => route === normalized);
      animateToIndex(routeIndex === -1 ? 0 : routeIndex, animated);
    },
    [animateToIndex, normalizePath, pathname]
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
      const href = (`/(tabs)${ROUTES[clamped]}`) as Href;
      router.navigate(href);
    }
  };

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
              borderColor: dark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.08)",
              justifyContent: "center",
            }}
            onStartShouldSetResponder={() => true}
            onResponderMove={(e) => handleDrag(e.nativeEvent.locationX)}
            onResponderRelease={(e) => handleDrag(e.nativeEvent.locationX, true)}
          >
            {/* Glossy highlight for glass feel */}
            <LinearGradient
              pointerEvents="none"
              colors={
                dark
                  ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]
                  : ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.03)"]
              }
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
                backgroundColor: dark
                  ? "rgba(255,255,255,0.20)"
                  : "rgba(0,0,0,0.08)",
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
      {/* HOME — index 0 */}
      <Tabs.Screen
        name="index/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(e) => {
                animateToIndex(0);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />

      {/* TASKS — index 1 */}
      <Tabs.Screen
        name="tasks/tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="checklist" color={color} />
          ),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              delayLongPress={320}
              onLongPress={(e) => {
                taskQuickActionTriggered.current = true;
                router.push("/add-assignment");
                props.onLongPress?.(e);
              }}
              onPress={(e) => {
                if (taskQuickActionTriggered.current) {
                  taskQuickActionTriggered.current = false;
                  return;
                }
                animateToIndex(1);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />

      {/* PLANNER — index 2 */}
      <Tabs.Screen
        name="planner/planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="pencil.and.outline" color={color} />
          ),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(e) => {
                animateToIndex(2);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />

      {/* CALENDAR — index 3 */}
      <Tabs.Screen
        name="calendar/calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar" color={color} />
          ),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(e) => {
                animateToIndex(3);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />

      {/* SETTINGS — index 4 */}
      <Tabs.Screen
        name="settings/settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gearshape.fill" color={color} />
          ),
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(e) => {
                animateToIndex(4);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
