from datetime import datetime


def build_password_reset_email_html(reset_code: str, username: str, reset_url: str) -> str:
    current_year = datetime.utcnow().year
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #232b36 0%, #3a4756 100%); color: white; padding: 20px; text-align: center; }}
            .content {{ background: #f9f9f9; padding: 30px; }}
            .reset-code {{ font-size: 24px; font-weight: bold; color: #007bff; text-align: center; padding: 20px; background: white; margin: 20px 0; border-radius: 5px; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>BracketWorks</h1>
                <h2>Password Reset Request</h2>
            </div>
            <div class="content">
                <p>Hello {username},</p>
                <p>You requested a password reset for your BracketWorks account. Use the following code to reset your password:</p>
                <div class="reset-code">{reset_code}</div>
                <p>Or click this secure link:</p>
                <p><a href="{reset_url}">{reset_url}</a></p>
                <p>This code will expire in 15 minutes for security reasons.</p>
                <p>If you didn't request this reset, please ignore this email.</p>
                <p>Thanks,<br>The BracketWorks Team</p>
            </div>
            <div class="footer">
                <p>&copy; {current_year} BracketWorks. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """


def build_password_reset_email_text(reset_code: str, username: str, reset_url: str) -> str:
    current_year = datetime.utcnow().year
    return (
        f"BracketWorks Password Reset\n\n"
        f"Hello {username},\n\n"
        f"You requested a password reset for your BracketWorks account.\n"
        f"Use this reset code: {reset_code}\n\n"
        f"Or open this secure link: {reset_url}\n\n"
        f"This code expires in 15 minutes. If you did not request this reset, you can ignore this email.\n\n"
        f"Thanks,\n"
        f"The BracketWorks Team\n\n"
        f"© {current_year} BracketWorks"
    )