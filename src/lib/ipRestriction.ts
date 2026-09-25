/**
 * IP Restriction Utility
 * Checks if the user is on the allowed WiFi network
 */

const ALLOWED_IP = "182.184.79.173";

/**
 * Get the user's current IP address
 */
export const getUserIP = async (): Promise<string> => {
  try {
    // Try multiple IP detection services for reliability
    const services = [
      "https://api.ipify.org?format=json",
      "https://api.my-ip.io/ip.json",
      "https://ipapi.co/json/",
    ];

    for (const service of services) {
      try {
        const response = await fetch(service);
        const data = await response.json();

        // Different services return IP in different formats
        const ip = data.ip || data.IP || data.query;
        if (ip) return ip;
      } catch (err) {
        console.warn(`Failed to fetch IP from ${service}`, err);
        continue;
      }
    }

    throw new Error("Could not determine IP address");
  } catch (error) {
    console.error("Error getting user IP:", error);
    throw new Error("Failed to verify network connection");
  }
};

/**
 * Check if the user is on the allowed WiFi network
 */
export const isOnAllowedNetwork = async (): Promise<boolean> => {
  try {
    const userIP = await getUserIP();
    console.log("User IP:", userIP, "Allowed IP:", ALLOWED_IP);
    return userIP === ALLOWED_IP;
  } catch (error) {
    console.error("Error checking network:", error);
    return false;
  }
};

/**
 * Verify network access and throw error if not allowed
 */
export const verifyNetworkAccess = async (): Promise<void> => {
  const isAllowed = await isOnAllowedNetwork();

  if (!isAllowed) {
    const userIP = await getUserIP();
    throw new Error(
      `Access denied. You must be connected to the office WiFi network to mark attendance. Your current IP: ${userIP}`
    );
  }
};

/**
 * Get the allowed IP address (for admin settings)
 */
export const getAllowedIP = (): string => {
  return ALLOWED_IP;
};
