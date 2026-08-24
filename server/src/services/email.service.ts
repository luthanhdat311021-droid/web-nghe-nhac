import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  public isReady(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  private initTransporter() {
    const { user, pass, host, port, service, secure } = config.smtp;

    if (user && pass) {
      try {
        const isGmail =
          service === 'gmail' ||
          (host && host.includes('gmail')) ||
          user.endsWith('@gmail.com');

        const transportOptions: any = isGmail
          ? {
              service: 'gmail',
              auth: {
                user,
                pass,
              },
            }
          : {
              host: host || 'smtp.gmail.com',
              port: port || 587,
              secure: secure || port === 465,
              auth: {
                user,
                pass,
              },
              tls: {
                rejectUnauthorized: config.isProd,
              },
            };

        this.transporter = nodemailer.createTransport(transportOptions);
        this.isConfigured = true;

        console.log(`📧 [EMAIL SERVICE] SMTP Initialized (${isGmail ? 'Gmail Service' : host || 'Custom SMTP'}) for account: ${user}`);

        // Async verify connection
        this.transporter.verify((error) => {
          if (error) {
            console.error('❌ [EMAIL SERVICE] SMTP connection verification failed:', error.message);
            console.warn('💡 Gợi ý: Nếu dùng Gmail, hãy đảm bảo bạn sử dụng MẬT KHẨU ỨNG DỤNG (App Password 16 ký tự), không phải mật khẩu tài khoản chính.');
          } else {
            console.log('✅ [EMAIL SERVICE] SMTP server connection verified successfully. Ready to send emails!');
          }
        });
      } catch (err: any) {
        console.error('❌ [EMAIL SERVICE] Failed to initialize SMTP transporter:', err?.message || err);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      if (!config.isProd) {
        console.info(
          'ℹ️ [EMAIL SERVICE] Chưa cấu hình SMTP (SMTP_USER / SMTP_PASS). Đang dùng chế độ Development Logger (mã OTP sẽ in ra terminal).'
        );
      }
    }
  }

  /**
   * Send Password Reset OTP Email
   */
  async sendPasswordResetOtp(toEmail: string, otp: string, username?: string): Promise<boolean> {
    const subject = 'MusicWave — Mã xác thực đặt lại mật khẩu';
    const expiresMinutes = config.otp.expiresMinutes;

    const plainText = `
Xin chào ${username || 'bạn'},

Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản MusicWave (${toEmail}).

Mã xác thực của bạn là: ${otp}

Mã này có hiệu lực trong vòng ${expiresMinutes} phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.

Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu của bạn vẫn được an toàn.

Trân trọng,
Đội ngũ MusicWave
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c12; color: #e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0c12; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="480" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #12141c; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <div style="display: inline-block; width: 40px; height: 40px; line-height: 40px; background-color: #ffffff; color: #000000; border-radius: 10px; font-weight: 900; font-size: 20px; text-align: center; margin-bottom: 12px;">
                M
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">MusicWave</h1>
              <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Bảo mật tài khoản</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #cbd5e1;">
                Xin chào <strong style="color: #ffffff;">${username || 'bạn'}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #94a3b8;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản MusicWave của bạn. Hãy nhập mã xác thực OTP bên dưới để tiếp tục:
              </p>

              <!-- OTP Box -->
              <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #ffffff; font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; display: inline-block; padding-left: 10px;">
                  ${otp}
                </span>
                <p style="margin: 8px 0 0; font-size: 11px; color: #64748b;">
                  Mã có hiệu lực trong <strong>${expiresMinutes} phút</strong>
                </p>
              </div>

              <!-- Notice -->
              <p style="margin: 24px 0 0; font-size: 12px; line-height: 18px; color: #64748b;">
                ⚠️ <em>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn và không bị thay đổi.</em>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0e1017; border-top: 1px solid rgba(255, 255, 255, 0.04); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                MusicWave Streaming Platform • <a href="${config.clientUrl}" style="color: #64748b; text-decoration: underline;">musicwave-app.vercel.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    // 1. Production or when SMTP is configured
    if (this.isConfigured && this.transporter) {
      try {
        const fromHeader = config.smtp.from.includes('<')
          ? config.smtp.from
          : `MusicWave Security <${config.smtp.user || 'no-reply@musicwave.com'}>`;

        const info = await this.transporter.sendMail({
          from: fromHeader,
          to: toEmail,
          subject,
          text: plainText,
          html: htmlContent,
        });

        console.log(`✅ [EMAIL SERVICE] Đã gửi OTP thành công tới ${toEmail} (MessageId: ${info.messageId})`);
        return true;
      } catch (error: any) {
        console.error(`❌ [EMAIL SERVICE] Lỗi khi gửi email qua SMTP tới ${toEmail}:`, error?.message || error);
        // Fallback to dev log if in development
        if (!config.isProd) {
          console.log(`\n======================================================`);
          console.log(`📧 [EMAIL FALLBACK DEV LOG] MÃ OTP ĐẶT LẠI MẬT KHẨU`);
          console.log(`👤 Người nhận: ${toEmail}`);
          console.log(`🔢 Mã OTP 6 số: ${otp}`);
          console.log(`⏱️ Thời hạn: ${expiresMinutes} phút`);
          console.log(`======================================================\n`);
        }
        return false;
      }
    }

    // 2. Development mock logger when SMTP is not configured
    if (!config.isProd) {
      console.log(`\n======================================================`);
      console.log(`📧 [EMAIL SERVICE - DEV ONLY] MÃ OTP ĐẶT LẠI MẬT KHẨU`);
      console.log(`👤 Người nhận: ${toEmail}`);
      console.log(`🔢 Mã OTP 6 số: ${otp}`);
      console.log(`⏱️ Thời hạn: ${expiresMinutes} phút`);
      console.log(`💡 Lưu ý: Cấu hình SMTP_USER và SMTP_PASS trong file server/.env để gửi email thật.`);
      console.log(`======================================================\n`);
      return true;
    }

    // In production without SMTP configured, warn
    console.warn(`⚠️ [EMAIL WARNING] SMTP is not configured in production. Cannot send OTP to ${toEmail}`);
    return false;
  }
}

export const emailService = new EmailService();
