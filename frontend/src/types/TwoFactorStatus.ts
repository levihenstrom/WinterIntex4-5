export interface TwoFactorStatus {
  sharedKey: string | null;
  recoveryCodesLeft: number;
  recoveryCodes: string[] | null;
  isTwoFactorEnabled: boolean;
  isMachineRemembered: boolean;
}
