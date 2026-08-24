/**
 * 端口：IUserDeliveryInfoPort
 *
 * 函数作用：
 *   邮件通知所需的收件人信息读取端口：邮箱地址与邮件通知开关。
 */
export interface UserDeliveryInfo {
  email: string;
  emailNotificationsEnabled: boolean;
}

export interface IUserDeliveryInfoPort {
  getDeliveryInfo(userId: string): Promise<UserDeliveryInfo | null>;
}
