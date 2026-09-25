import React, { createContext, useContext, useState, useEffect } from "react";
import { getPortalSettings } from "../lib/firestore";
import { PortalSettings } from "../types";

interface SettingsContextType {
  settings: PortalSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  currencySymbol: string;
  salaryStartDay: number;
  officeStartTime: string;
  officeEndTime: string;
  lateMarkAfterMinutes: number;
  enableCameraCapture: boolean;
  lightLogoUrl?: string;
  darkLogoUrl?: string;
  portalLightLogoUrl?: string;
  portalDarkLogoUrl?: string;
  loginLightLogoUrl?: string;
  loginDarkLogoUrl?: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const data = await getPortalSettings();
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const getCurrencySymbol = (currencyCode: string) => {
    switch (currencyCode) {
      case "USD":
        return "$";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      case "PKR":
        return "Rs";
      case "AED":
        return "AED";
      default:
        return "₹"; // Default to INR symbol if not found or if INR
    }
  };

  const currencySymbol = getCurrencySymbol(settings?.currency || "INR");
  const salaryStartDay = settings?.salaryStartDay || 6;
  const officeStartTime = settings?.officeStartTime || "10:00";
  const officeEndTime = settings?.officeEndTime || "18:00";
  const lateMarkAfterMinutes = settings?.lateMarkAfterMinutes || 15;

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        refreshSettings,
        currencySymbol,
        salaryStartDay,
        officeStartTime,
        officeEndTime,
        lateMarkAfterMinutes,
        enableCameraCapture: settings?.enableCameraCapture || false,
        lightLogoUrl: settings?.lightLogoUrl || settings?.logoUrl,
        darkLogoUrl: settings?.darkLogoUrl || settings?.logoUrl,
        portalLightLogoUrl:
          settings?.portalLightLogoUrl ||
          settings?.lightLogoUrl ||
          settings?.logoUrl,
        portalDarkLogoUrl:
          settings?.portalDarkLogoUrl ||
          settings?.darkLogoUrl ||
          settings?.logoUrl,
        loginLightLogoUrl:
          settings?.loginLightLogoUrl ||
          settings?.lightLogoUrl ||
          settings?.logoUrl,
        loginDarkLogoUrl:
          settings?.loginDarkLogoUrl ||
          settings?.darkLogoUrl ||
          settings?.logoUrl,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
