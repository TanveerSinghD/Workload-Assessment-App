import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolView, SymbolViewProps, SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { StyleProp, ViewStyle } from "react-native";

const MATERIAL_MAPPING: Record<string, ComponentProps<typeof MaterialIcons>["name"]> = {
  "house.fill": "home",
  checklist: "checklist",
  "checkmark.circle": "check-circle",
  "checkmark.circle.fill": "check-circle",
  "pencil.and.outline": "edit",
  calendar: "calendar-today",
  "gearshape.fill": "settings",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
};

const FALLBACK_ICON: ComponentProps<typeof MaterialIcons>["name"] = "help-outline";

const toMaterialName = (name: string) => MATERIAL_MAPPING[name] ?? FALLBACK_ICON;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = "regular",
}: {
  name: SymbolViewProps["name"];
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name}
      // Ensures icons still render in Expo Go / missing native modules.
      fallback={<MaterialIcons name={toMaterialName(name)} color={color} size={size} style={style as any} />}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
