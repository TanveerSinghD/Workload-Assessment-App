import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React, { useRef } from "react";
import { Animated, LayoutChangeEvent } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  // 🔵 Sliding bubble animation
  const sliderX = useRef(new Animated.Value(0)).current;

  // Width of the entire tab bar
  const tabWidth = useRef(0);
  const TABS = 5;

  // 🔧 Fix initial off-centre bubble on first load
  const onLayout = (event: LayoutChangeEvent) => {
    tabWidth.current = event.nativeEvent.layout.width;

    const ITEM_WIDTH = tabWidth.current / TABS;

    // ⭐ Centre bubble on Home immediately (no drift)
    sliderX.setValue(ITEM_WIDTH / 2 - 27.5);
  };

  // 🔧 Animate bubble when switching tabs
  const animateTo = (index: number) => {
    if (tabWidth.current === 0) return;

    const ITEM_WIDTH = tabWidth.current / TABS;

    Animated.spring(sliderX, {
      toValue: index * ITEM_WIDTH + ITEM_WIDTH / 2 - 27.5,
      useNativeDriver: true,
      speed: 12,
      bounciness: 6,
    }).start();
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ⭐ Blue icons when active
        tabBarActiveTintColor: "#007AFF",

        // 🍏 Frosted glass tab bar
        tabBarBackground: () => (
          <BlurView
            tint={dark ? "dark" : "light"}
            intensity={25}
            onLayout={onLayout}
            style={{
              flex: 1,
              borderRadius: 40,
              overflow: "hidden",
              justifyContent: "center",
            }}
          >
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
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: dark
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.10)",
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
                animateTo(0);
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
              onPress={(e) => {
                animateTo(1);
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
                animateTo(2);
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
                animateTo(3);
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
                animateTo(4);
                props.onPress?.(e);
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
