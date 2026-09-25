import React from "react";
import { LeaveInbox } from "../../components/leave/LeaveInbox";
import { getPendingLeaveRequests } from "../../lib/firestore";
import { useAuth } from "../../context/AuthContext";

export const TeamLeaveInbox: React.FC = () => {
  const { user } = useAuth();

  return (
    <LeaveInbox
      title="Team leave requests"
      description="Approve or reject leave for people who report to you."
      loadRequests={async () => {
        if (!user) return [];
        return getPendingLeaveRequests(user.uid);
      }}
    />
  );
};
