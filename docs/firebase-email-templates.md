# CourseHub Branded Email Templates (Firebase Auth)

Use these templates in **Firebase Console → Authentication → Templates**.

> Recommended sender:
> - **Sender name:** `CourseHub`
> - **From email:** `no-reply@coursehub.online` (or a verified domain sender)
> - **Logo URL:** `https://coursehub.online/assets/images/logo.png`

---

## 1) Email verification (تحقق البريد)

### Subject (AR)
`فعّل حسابك في CourseHub`

### Subject (EN)
`Verify your CourseHub account`

### HTML body (bilingual)

```html
<div style="margin:0;padding:24px;background:#f4f7ff;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:24px;text-align:center;background:linear-gradient(135deg,#0f3fb8,#1d4ed8);">
        <img src="https://coursehub.online/assets/images/logo.png" alt="CourseHub" width="180" style="display:block;margin:0 auto 10px;max-width:100%;" />
        <h1 style="margin:0;color:#ffffff;font-size:22px;">CourseHub</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px 16px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">مرحبًا بك في CourseHub 👋</h2>
        <p style="margin:0 0 16px;line-height:1.8;">نحن سعداء بانضمامك إلينا. لتفعيل حسابك والبدء بالتعلم، اضغط الزر التالي:</p>

        <div style="text-align:center;margin:24px 0;">
          <a href="%LINK%" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;">تفعيل الحساب</a>
        </div>

        <p style="margin:0 0 10px;line-height:1.8;color:#4b5563;">إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة بأمان.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />

        <p style="margin:0 0 8px;font-weight:700;color:#111827;">Welcome to CourseHub 👋</p>
        <p style="margin:0 0 14px;line-height:1.8;color:#4b5563;">Please verify your email address to activate your account and start learning.</p>
        <p style="margin:0 0 4px;line-height:1.8;color:#6b7280;">If the button does not work, copy and open this link:</p>
        <p style="margin:0;word-break:break-all;color:#2563eb;">%LINK%</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;line-height:1.7;">
        © CourseHub — جميع الحقوق محفوظة<br/>
        This is an automated message, please do not reply directly.
      </td>
    </tr>
  </table>
</div>
```

---

## 2) Password reset (إعادة تعيين كلمة المرور)

### Subject (AR)
`إعادة تعيين كلمة المرور - CourseHub`

### Subject (EN)
`Reset your CourseHub password`

### HTML body (bilingual)

```html
<div style="margin:0;padding:24px;background:#f4f7ff;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:24px;text-align:center;background:linear-gradient(135deg,#0f3fb8,#1d4ed8);">
        <img src="https://coursehub.online/assets/images/logo.png" alt="CourseHub" width="180" style="display:block;margin:0 auto 10px;max-width:100%;" />
        <h1 style="margin:0;color:#ffffff;font-size:22px;">CourseHub</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px 16px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">طلب إعادة تعيين كلمة المرور</h2>
        <p style="margin:0 0 16px;line-height:1.8;">تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط الزر التالي لإكمال العملية:</p>

        <div style="text-align:center;margin:24px 0;">
          <a href="%LINK%" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;">إعادة تعيين كلمة المرور</a>
        </div>

        <p style="margin:0 0 10px;line-height:1.8;color:#4b5563;">إذا لم تطلب ذلك، تجاهل هذه الرسالة ولن يتم إجراء أي تغيير.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;" />

        <p style="margin:0 0 8px;font-weight:700;color:#111827;">Password reset request</p>
        <p style="margin:0 0 14px;line-height:1.8;color:#4b5563;">We received a request to reset your password. Click the button above to continue.</p>
        <p style="margin:0 0 4px;line-height:1.8;color:#6b7280;">If the button does not work, use this link:</p>
        <p style="margin:0;word-break:break-all;color:#2563eb;">%LINK%</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;line-height:1.7;">
        © CourseHub — جميع الحقوق محفوظة<br/>
        This is an automated message, please do not reply directly.
      </td>
    </tr>
  </table>
</div>
```

---

## 3) Verify-before-change email / email change (اختياري)

Use the same header/footer and replace CTA text based on action (confirm old email / confirm new email).

---

## Quick QA checklist

- Logo loads over HTTPS from `coursehub.online`.
- `%LINK%` placeholder is preserved exactly in template body.
- Sender domain is authenticated (SPF, DKIM, DMARC).
- Subject and body are concise and professional.
