import confirmSignupHtml from "../../../../supabase/templates/auth/confirm_signup.html?raw"
import resetPasswordHtml from "../../../../supabase/templates/auth/reset_password.html?raw"
import magicLinkHtml from "../../../../supabase/templates/auth/magic_link.html?raw"
import changeEmailHtml from "../../../../supabase/templates/auth/change_email.html?raw"
import inviteHtml from "../../../../supabase/templates/auth/invite.html?raw"

/**
 * Template Auth Supabase (repo). Allineati a supabase/config.toml e npm run supabase:auth:email-templates.
 * Variabili Go template: {{ .ConfirmationURL }}, {{ .Email }}, {{ .SiteURL }}, ecc.
 */
export const AUTH_EMAIL_TEMPLATES = [
  {
    id: "confirmation",
    label: "Conferma registrazione",
    subject: "Conferma il tuo account PizzaManager",
    supabaseSubjectKey: "mailer_subjects_confirmation",
    supabaseContentKey: "mailer_templates_confirmation_content",
    file: "supabase/templates/auth/confirm_signup.html",
    html: confirmSignupHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}"],
  },
  {
    id: "recovery",
    label: "Reimposta password",
    subject: "Reimposta la password del tuo account",
    supabaseSubjectKey: "mailer_subjects_recovery",
    supabaseContentKey: "mailer_templates_recovery_content",
    file: "supabase/templates/auth/reset_password.html",
    html: resetPasswordHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}"],
  },
  {
    id: "magic_link",
    label: "Magic link / accesso rapido",
    subject: "Link di accesso rapido PizzaManager",
    supabaseSubjectKey: "mailer_subjects_magic_link",
    supabaseContentKey: "mailer_templates_magic_link_content",
    file: "supabase/templates/auth/magic_link.html",
    html: magicLinkHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}"],
  },
  {
    id: "email_change",
    label: "Cambio email",
    subject: "Conferma cambio email account",
    supabaseSubjectKey: "mailer_subjects_email_change",
    supabaseContentKey: "mailer_templates_email_change_content",
    file: "supabase/templates/auth/change_email.html",
    html: changeEmailHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .NewEmail }}", "{{ .SiteURL }}"],
  },
  {
    id: "invite",
    label: "Invito utente",
    subject: "Invito account PizzaManager",
    supabaseSubjectKey: "mailer_subjects_invite",
    supabaseContentKey: "mailer_templates_invite_content",
    file: "supabase/templates/auth/invite.html",
    html: inviteHtml,
    variables: ["{{ .ConfirmationURL }}", "{{ .Email }}", "{{ .SiteURL }}"],
  },
]
