import { Alert } from "react-native";

import { setTaskCompleted } from "@/lib/database";

type AvailabilityFeedbackOptions = {
  silentSuccess?: boolean;
  successMessage?: string;
  errorMessage?: string;
  successTitle?: string;
  errorTitle?: string;
};

export async function updateAvailabilityWithFeedback(
  taskId: number,
  completed: boolean,
  options: AvailabilityFeedbackOptions = {}
) {
  const {
    silentSuccess = false,
    successMessage,
    errorMessage,
    successTitle = "Availability updated",
    errorTitle = "Update failed",
  } = options;

  const successBody = successMessage ?? (completed ? "Marked as complete." : "Moved back to active.");
  const errorBody = errorMessage ?? "Couldn't update availability. Please try again.";

  try {
    await setTaskCompleted(taskId, completed);

    if (!silentSuccess) {
      Alert.alert(successTitle, successBody);
    }

    return true;
  } catch (error) {
    console.error("Failed to update availability", error);
    Alert.alert(errorTitle, errorBody);
    return false;
  }
}
