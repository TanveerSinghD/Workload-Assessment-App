import { DeviceEventEmitter } from "react-native";

export const TAB_BAR_SCROLL_EVENT = "tab-bar-scroll";

export type TabBarScrollPayload = {
  source: "home" | "tasks" | "planner";
  y: number;
};

export function emitTabBarScroll(payload: TabBarScrollPayload) {
  DeviceEventEmitter.emit(TAB_BAR_SCROLL_EVENT, payload);
}
