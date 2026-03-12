import { DeviceEventEmitter } from "react-native";

export const TAB_BAR_SCROLL_EVENT = "tab-bar-scroll";

export type TabBarScrollPayload = {
  source: "home" | "tasks" | "planner";
  y: number;
};

export function emitTabBarScroll(payload: TabBarScrollPayload) {
  DeviceEventEmitter.emit(TAB_BAR_SCROLL_EVENT, payload);
}

export const SCROLL_TO_TOP_EVENT = "scroll-to-top";

export type ScrollToTopPayload = {
  tabId: string;
};

export function emitScrollToTop(tabId: string) {
  DeviceEventEmitter.emit(SCROLL_TO_TOP_EVENT, { tabId } as ScrollToTopPayload);
}
