"""SMTP email utility — works with MailHog in dev, any SMTP in production."""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure."""
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)

        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(settings.EMAIL_FROM_ADDRESS, to_email, msg.as_string())
        server.quit()
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def build_password_reset_email(
    reset_url: str,
    user_name: str,
) -> tuple[str, str, str]:
    """Build password reset email subject + HTML + text bodies."""
    subject = "Reset your password — Cloudifyapps ERP"

    html_body = f"""\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }}
    .container {{ max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
    .header {{ background: #18181b; padding: 28px 32px; }}
    .header h1 {{ color: #ffffff; margin: 0; font-size: 18px; font-weight: 600; }}
    .body {{ padding: 32px; }}
    .body p {{ color: #3f3f46; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }}
    .cta {{ display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 8px 0 24px; }}
    .footer {{ padding: 20px 32px; border-top: 1px solid #e4e4e7; }}
    .footer p {{ color: #a1a1aa; font-size: 12px; margin: 0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cloudifyapps ERP</h1>
    </div>
    <div class="body">
      <p>Hi {user_name},</p>
      <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
      <a href="{reset_url}" class="cta">Reset Password</a>
      <p style="font-size:13px; color:#71717a;">This link will expire in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; Cloudifyapps ERP</p>
    </div>
  </div>
</body>
</html>"""

    text_body = (
        f"Hi {user_name},\n\n"
        f"We received a request to reset your password.\n\n"
        f"Reset your password: {reset_url}\n\n"
        f"This link expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n"
        f"If you didn't request this, you can safely ignore this email.\n"
    )

    return subject, html_body, text_body


def build_invitation_email(
    inviter_name: str,
    tenant_name: str,
    invite_url: str,
    role_name: str | None = None,
) -> tuple[str, str, str]:
    """Build invitation email subject + HTML + text bodies."""
    subject = f"You're invited to join {tenant_name} on Cloudifyapps ERP"

    role_line = f" as <strong>{role_name}</strong>" if role_name else ""

    html_body = f"""\
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 0; }}
    .container {{ max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
    .header {{ background: #18181b; padding: 28px 32px; }}
    .header h1 {{ color: #ffffff; margin: 0; font-size: 18px; font-weight: 600; }}
    .body {{ padding: 32px; }}
    .body p {{ color: #3f3f46; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }}
    .cta {{ display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 8px 0 24px; }}
    .footer {{ padding: 20px 32px; border-top: 1px solid #e4e4e7; }}
    .footer p {{ color: #a1a1aa; font-size: 12px; margin: 0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cloudifyapps ERP</h1>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p><strong>{inviter_name}</strong> has invited you to join <strong>{tenant_name}</strong>{role_line} on Cloudifyapps ERP.</p>
      <a href="{invite_url}" class="cta">Accept Invitation</a>
      <p style="font-size:13px; color:#71717a;">This invitation will expire in {settings.INVITATION_EXPIRE_HOURS} hours. If you didn't expect this, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; Cloudifyapps ERP</p>
    </div>
  </div>
</body>
</html>"""

    text_body = (
        f"Hi there,\n\n"
        f"{inviter_name} has invited you to join {tenant_name}"
        f"{f' as {role_name}' if role_name else ''} on Cloudifyapps ERP.\n\n"
        f"Accept the invitation: {invite_url}\n\n"
        f"This invitation expires in {settings.INVITATION_EXPIRE_HOURS} hours.\n"
    )

    return subject, html_body, text_body
