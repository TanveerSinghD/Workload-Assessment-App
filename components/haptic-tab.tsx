import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';

export function HapticTab(props: BottomTabBarButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <PlatformPressable
      {...props}
      accessibilityRole="tab"
      style={[
        props.style,
        {
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
      onPressIn={(ev) => {
        setPressed(true);
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        setPressed(false);
        props.onPressOut?.(ev);
      }}
    />
  );
}
