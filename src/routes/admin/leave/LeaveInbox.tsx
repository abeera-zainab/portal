import React from "react";
import { LeaveInbox } from "../../../components/leave/LeaveInbox";
import { getAllLeaveRequests } from "../../../lib/firestore";

export const AdminLeaveInbox: React.FC = () => {
  return (
    <LeaveInbox
      title="Leave requests"
      description="Review leave for all PSS employees."
      loadRequests={getAllLeaveRequests}
    />
  );
};
