import { storage } from "./firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";

export const uploadAttendanceImage = async (
  userId: string,
  imageSrc: string // Base64 string
): Promise<string> => {
  try {
    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
    const storageRef = ref(storage, `attendance_images/${userId}/${timestamp}.jpg`);
    
    // Upload the base64 string (data_url)
    await uploadString(storageRef, imageSrc, "data_url");
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading attendance image:", error);
    throw new Error("Failed to upload attendance image");
  }
};
