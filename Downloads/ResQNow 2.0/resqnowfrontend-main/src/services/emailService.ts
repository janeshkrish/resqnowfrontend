// Email is sent from the backend (Nodemailer). These stubs exist for compatibility.
export const emailService = {
  sendTechnicianApplicationEmail: async (_technicianData: unknown, _resumeUrl: string | null): Promise<boolean> => {
    return true;
  },
  sendTechnicianStatusEmail: async (_technicianEmail: string, _name: string, _isApproved: boolean): Promise<boolean> => {
    return true;
  },
};
